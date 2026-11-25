import type { BufferDescription, BufferInput, Graph, Inspection, Target } from '@lovechild/core'
import { createFeedbackBuffer, deleteFeedbackBuffer, resizeFeedbackBuffer, updateMipmaps, type FeedbackBuffer } from './buffer'
import { createEmptyTexture, createMediaTexture, deleteMediaTexture, getCurrentTexture, stopWatchingFrames, updateMediaTexture, type MediaElement, type MediaTexture } from './media'
import { createProgram, createVertexShader } from './program'

interface CompiledPass {
    program: WebGLProgram
    target: Target
    inputs: ReadonlyArray<BufferInput>
    areaSizeLocation: WebGLUniformLocation | null
    timeLocation: WebGLUniformLocation | null
    previousTimeLocation: WebGLUniformLocation | null
    cpsLocation: WebGLUniformLocation | null
    isFirstFrameLocation: WebGLUniformLocation | null
    originLocation: WebGLUniformLocation | null
    bufferResolutionLocation: WebGLUniformLocation | null
    parameterLocations: ReadonlyArray<WebGLUniformLocation | null>
    inputLocations: ReadonlyArray<WebGLUniformLocation | null>
    media: ReadonlyArray<number>
    mediaLocations: ReadonlyArray<MediaLocation>
}

interface MediaLocation {
    image: WebGLUniformLocation | null
    size: WebGLUniformLocation | null
}

interface BufferSlot {
    buffer: FeedbackBuffer
    width: number
    height: number
    isNearest: boolean
}

export interface PixelInspection {
    width: number
    height: number
    pixels: Uint8Array
    hasAlpha: boolean
}

export interface CompiledGraph {
    passes: ReadonlyArray<CompiledPass>
    bufferCount: number
    buffers: ReadonlyArray<BufferDescription>
    inspection?: Inspection
}

export interface Renderer {
    compile: (graph: Graph) => CompiledGraph
    draw: (graph: CompiledGraph, values: ReadonlyArray<number>, time: number, cps: number, previews: ReadonlyArray<HTMLElement>, media: ReadonlyArray<MediaElement>) => PixelInspection | undefined
    clear: () => void
    setScale: (scale: number) => void
    release: (element: MediaElement) => void
    destroy: () => void
}

const maximumInspectionSize = 32

export const createRenderer = (canvas: HTMLCanvasElement): Renderer => {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false })

    if (!gl) {
        throw new Error('WebGL 2 is not available')
    }

    let vertexShader = createVertexShader(gl)
    let emptyTexture = createEmptyTexture(gl)
    let maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    const programs = new Map<string, WebGLProgram>()
    const buffers: Array<BufferSlot> = []
    const mediaTextures = new Map<MediaElement, MediaTexture>()
    const graphSources = new WeakMap<CompiledGraph, { source: Graph, generation: number }>()
    let generation = 0
    let writeIndex = 0
    let drawnGraph: CompiledGraph | undefined
    let previousTime = 0
    let wasResized = false
    let isContextLost = false
    let isDestroyed = false

    const getProgram = (source: string) => {
        const existing = programs.get(source)

        if (existing) {
            return existing
        }

        const program = createProgram(gl, vertexShader, source)
        programs.set(source, program)
        return program
    }

    const deleteUnusedPrograms = (graph: CompiledGraph) => {
        const used = new Set(graph.passes.map((pass) => pass.program))

        for (const [source, program] of programs) {
            if (!used.has(program)) {
                gl.deleteProgram(program)
                programs.delete(source)
            }
        }
    }

    let size = { width: Math.max(1, canvas.width), height: Math.max(1, canvas.height) }
    let bounds = { width: canvas.clientWidth, height: canvas.clientHeight }
    let scale = 1

    const measure = () => {
        if (bounds.width <= 0 || bounds.height <= 0) {
            return
        }

        const ratio = window.devicePixelRatio * scale

        size = {
            width: Math.min(maxTextureSize, Math.max(1, Math.round(bounds.width * ratio))),
            height: Math.min(maxTextureSize, Math.max(1, Math.round(bounds.height * ratio))),
        }
    }

    measure()

    const observer = new ResizeObserver((entries) => {
        const entry = entries[0]

        if (!entry) {
            return
        }

        bounds = { width: entry.contentRect.width, height: entry.contentRect.height }
        measure()
    })

    observer.observe(canvas)

    const handleContextLost = (event: Event) => {
        event.preventDefault()
        isContextLost = true
    }

    const handleContextRestored = () => {
        if (isDestroyed) {
            return
        }

        isContextLost = false
        generation += 1
        programs.clear()
        buffers.length = 0

        for (const element of mediaTextures.keys()) {
            stopWatchingFrames(element)
        }

        mediaTextures.clear()
        drawnGraph = undefined
        wasResized = true
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
        vertexShader = createVertexShader(gl)
        emptyTexture = createEmptyTexture(gl)
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    const clampDimension = (value: number) => {
        if (!Number.isFinite(value)) {
            return 1
        }

        return Math.min(maxTextureSize, Math.max(1, Math.round(value)))
    }

    const resizeCanvas = () => {
        const { width, height } = size

        if (canvas.width === width && canvas.height === height) {
            return
        }

        canvas.width = width
        canvas.height = height
        wasResized = true
    }

    const syncBuffers = (descriptions: ReadonlyArray<BufferDescription>, values: ReadonlyArray<number>) => {
        while (buffers.length > descriptions.length) {
            const removed = buffers.pop()

            if (removed) {
                deleteFeedbackBuffer(gl, removed.buffer)
            }
        }

        for (let index = 0; index < descriptions.length; index++) {
            const description = descriptions[index]
            const width = description.size ? clampDimension(values[description.size.widthUniform]) : canvas.width
            const height = description.size ? clampDimension(values[description.size.heightUniform]) : canvas.height
            const isNearest = Boolean(description.isNearest)
            const existing = buffers[index]

            if (!existing) {
                buffers.push({ buffer: createFeedbackBuffer(gl, width, height, isNearest), width, height, isNearest })
                continue
            }

            if (existing.isNearest !== isNearest) {
                deleteFeedbackBuffer(gl, existing.buffer)
                buffers[index] = { buffer: createFeedbackBuffer(gl, width, height, isNearest), width, height, isNearest }
                continue
            }

            if (existing.width !== width || existing.height !== height) {
                resizeFeedbackBuffer(gl, existing.buffer, width, height, isNearest)
                existing.width = width
                existing.height = height
            }
        }
    }

    const getTexture = (input: BufferInput) => {
        const index = input.frame === 'current' ? writeIndex : 1 - writeIndex
        return buffers[input.buffer].buffer.textures[index]
    }

    const updateMedia = (element: MediaElement) => {
        let media = mediaTextures.get(element)

        if (!media) {
            media = createMediaTexture(gl)
            mediaTextures.set(element, media)
        }

        return updateMediaTexture(gl, media, element) ? media : undefined
    }

    const clearScreen = () => {
        if (isDestroyed || isContextLost) {
            return
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clear(gl.COLOR_BUFFER_BIT)
    }

    const getArea = (target: Target, previews: ReadonlyArray<HTMLElement>, canvasBounds: DOMRect | undefined) => {
        if (target.kind === 'buffer') {
            const slot = buffers[target.index]
            return { x: 0, y: 0, width: slot.width, height: slot.height }
        }

        if (target.kind !== 'preview') {
            return { x: 0, y: 0, width: canvas.width, height: canvas.height }
        }

        const element = previews[target.index]

        if (!element || !element.isConnected || !canvasBounds || canvasBounds.width <= 0 || canvasBounds.height <= 0) {
            return undefined
        }

        const rectangle = element.getBoundingClientRect()
        const scaleX = canvas.width / canvasBounds.width
        const scaleY = canvas.height / canvasBounds.height
        const area = {
            x: Math.round((rectangle.left - canvasBounds.left) * scaleX),
            y: Math.round((canvasBounds.bottom - rectangle.bottom) * scaleY),
            width: Math.round(rectangle.width * scaleX),
            height: Math.round(rectangle.height * scaleY),
        }
        const isVisible = area.width > 0 && area.height > 0 && area.x < canvas.width && area.y < canvas.height && area.x + area.width > 0 && area.y + area.height > 0

        return isVisible ? area : undefined
    }

    const readInspection = (inspection: Inspection | undefined): PixelInspection | undefined => {
        if (!inspection) {
            return undefined
        }

        const slot = buffers[inspection.buffer]

        if (!slot || slot.width > maximumInspectionSize || slot.height > maximumInspectionSize) {
            return undefined
        }

        const pixels = new Uint8Array(slot.width * slot.height * 4)
        gl.bindFramebuffer(gl.FRAMEBUFFER, slot.buffer.framebuffers[writeIndex])
        gl.readPixels(0, 0, slot.width, slot.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        return { width: slot.width, height: slot.height, pixels, hasAlpha: inspection.hasAlpha }
    }

    const compileGraph = (graph: Graph): CompiledGraph => {
        if (isDestroyed || isContextLost) {
            const empty: CompiledGraph = { passes: [], bufferCount: graph.bufferCount, buffers: graph.buffers, inspection: graph.inspection }
            graphSources.set(empty, { source: graph, generation: -1 })
            return empty
        }

        const compiled: CompiledGraph = {
            bufferCount: graph.bufferCount,
            buffers: graph.buffers,
            inspection: graph.inspection,
            passes: graph.passes.map((pass) => {
                const program = getProgram(pass.source)

                return {
                    program,
                    target: pass.target,
                    inputs: pass.inputs,
                    areaSizeLocation: gl.getUniformLocation(program, 'areaSize'),
                    timeLocation: gl.getUniformLocation(program, 'time'),
                    previousTimeLocation: gl.getUniformLocation(program, 'previousTime'),
                    cpsLocation: gl.getUniformLocation(program, 'cps'),
                    isFirstFrameLocation: gl.getUniformLocation(program, 'isFirstFrame'),
                    originLocation: gl.getUniformLocation(program, 'origin'),
                    bufferResolutionLocation: gl.getUniformLocation(program, 'bufferResolution'),
                    parameterLocations: graph.uniforms.map((uniform) => gl.getUniformLocation(program, uniform.name)),
                    inputLocations: pass.inputs.map((input) => gl.getUniformLocation(program, input.name)),
                    media: pass.media,
                    mediaLocations: pass.media.map((index) => ({
                        image: gl.getUniformLocation(program, `media${index}`),
                        size: gl.getUniformLocation(program, `media${index}Size`),
                    })),
                }
            }),
        }

        graphSources.set(compiled, { source: graph, generation })
        return compiled
    }

    return {
        compile: compileGraph,
        draw: (graph, values, time, cps, previews, media) => {
            if (isDestroyed || isContextLost) {
                return undefined
            }

            let activeGraph = graph
            const record = graphSources.get(graph)

            if (record && record.generation !== generation) {
                activeGraph = compileGraph(record.source)
                graph.passes = activeGraph.passes
                graphSources.set(graph, { source: record.source, generation })
            }

            resizeCanvas()
            syncBuffers(activeGraph.buffers, values)
            const isNewGraph = graph !== drawnGraph
            const isFirstFrame = isNewGraph || wasResized

            if (isNewGraph) {
                deleteUnusedPrograms(activeGraph)
            }

            const lastTime = isFirstFrame ? time : previousTime
            const readyMedia = media.map(updateMedia)
            const hasScreenPass = activeGraph.passes.some((pass) => pass.target.kind === 'screen')
            const hasPreviewPass = activeGraph.passes.some((pass) => pass.target.kind === 'preview')
            const canvasBounds = hasPreviewPass ? canvas.getBoundingClientRect() : undefined

            if (!hasScreenPass) {
                clearScreen()
            }

            for (const pass of activeGraph.passes) {
                const { target } = pass
                const area = getArea(target, previews, canvasBounds)

                if (!area) {
                    continue
                }

                const slot = target.kind === 'buffer' ? buffers[target.index] : undefined
                const framebuffer = slot ? slot.buffer.framebuffers[writeIndex] : null

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
                gl.viewport(area.x, area.y, area.width, area.height)
                gl.useProgram(pass.program)
                gl.uniform2f(pass.areaSizeLocation, area.width, area.height)
                gl.uniform2f(pass.originLocation, area.x, area.y)
                gl.uniform2f(pass.bufferResolutionLocation, canvas.width, canvas.height)
                gl.uniform1f(pass.timeLocation, time)
                gl.uniform1f(pass.previousTimeLocation, lastTime)
                gl.uniform1f(pass.cpsLocation, cps)
                gl.uniform1f(pass.isFirstFrameLocation, isFirstFrame ? 1 : 0)

                for (let index = 0; index < values.length; index++) {
                    const location = pass.parameterLocations[index]

                    if (location !== null) {
                        gl.uniform1f(location, values[index])
                    }
                }

                for (let unit = 0; unit < pass.inputs.length; unit++) {
                    gl.activeTexture(gl.TEXTURE0 + unit)
                    gl.bindTexture(gl.TEXTURE_2D, getTexture(pass.inputs[unit]))
                    gl.uniform1i(pass.inputLocations[unit], unit)
                }

                for (let position = 0; position < pass.media.length; position++) {
                    const index = pass.media[position]
                    const unit = pass.inputs.length + position
                    const ready = readyMedia[index]
                    const location = pass.mediaLocations[position]

                    gl.activeTexture(gl.TEXTURE0 + unit)
                    gl.bindTexture(gl.TEXTURE_2D, ready ? getCurrentTexture(ready) : emptyTexture)
                    gl.uniform1i(location.image, unit)
                    gl.uniform2f(location.size, ready?.width ?? 1, ready?.height ?? 1)
                }

                gl.drawArrays(gl.TRIANGLES, 0, 3)

                if (slot) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

                    if (!slot.isNearest) {
                        updateMipmaps(gl, slot.buffer, writeIndex)
                    }
                }
            }

            const inspection = readInspection(activeGraph.inspection)
            writeIndex = 1 - writeIndex
            drawnGraph = graph
            previousTime = time
            wasResized = false
            return inspection
        },
        clear: clearScreen,
        setScale: (next) => {
            if (!Number.isFinite(next) || next <= 0) {
                return
            }

            scale = next
            measure()
        },
        release: (element) => {
            stopWatchingFrames(element)
            const media = mediaTextures.get(element)

            if (media) {
                if (!isDestroyed && !isContextLost) {
                    deleteMediaTexture(gl, media)
                }

                mediaTextures.delete(element)
            }
        },
        destroy: () => {
            if (isDestroyed) {
                return
            }

            isDestroyed = true
            observer.disconnect()
            canvas.removeEventListener('webglcontextlost', handleContextLost)
            canvas.removeEventListener('webglcontextrestored', handleContextRestored)

            for (const element of mediaTextures.keys()) {
                stopWatchingFrames(element)
            }

            if (!isContextLost) {
                for (const program of programs.values()) {
                    gl.deleteProgram(program)
                }

                for (const slot of buffers) {
                    deleteFeedbackBuffer(gl, slot.buffer)
                }

                for (const media of mediaTextures.values()) {
                    deleteMediaTexture(gl, media)
                }

                gl.deleteTexture(emptyTexture)
                gl.deleteShader(vertexShader)
            }

            programs.clear()
            buffers.length = 0
            mediaTextures.clear()
            drawnGraph = undefined
        },
    }
}
