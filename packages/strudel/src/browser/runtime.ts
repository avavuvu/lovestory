import type { Graph } from '@lovechild/core'
import { createRenderer, type CompiledGraph, type MediaElement } from '@lovechild/webgl'
import { Cyclist, Hap, setClockTime, setCpsFunc, setTime, silence, type Pattern } from '@strudel/core'
import { cleanupDraw } from '@strudel/draw'
import type { Widget } from '@strudel/transpiler'
import * as webaudio from '@strudel/webaudio'
import { compileCode } from '../evaluation/compile'
import type { ImagePreview, MiniLocation, PatternPreview } from '../evaluation/evaluate'
import { createValueReader, type ValueReader } from '../playback/values'
import type { Location, Warning, WarningList } from '../evaluation/warnings'
import { createAudio } from './audio'
import { createErrorReporter } from './errors'
import { createPixelOverlay } from './inspect'
import { createMediaCache } from './media'
import { createImagePreviews, type PreviewElement } from './image-previews'
import { createTextLayer, type TextLayer } from './text'

export type { PreviewElement } from './image-previews'

interface Visual {
    graph: CompiledGraph
    reader: ValueReader
    previews: ReadonlyArray<HTMLElement>
    media: ReadonlyArray<MediaElement>
    texts: ReadonlyArray<TextLayer>
}

export interface EvaluationResult {
    miniLocations: ReadonlyArray<MiniLocation>
    widgets: ReadonlyArray<Widget>
    imagePreviews: ReadonlyArray<PreviewElement>
    patternPreviews: ReadonlyArray<PatternPreview>
    transpiled: string
    graph: Graph | undefined
}

export interface RuntimeOptions {
    onFrame: (time: number, haps: ReadonlyArray<Hap>) => void
    onWarning?: (warning: Warning) => void
    onPlaybackError?: (error: Error, locations: ReadonlyArray<Location>) => void
    onBlockedSound?: () => void
    scope?: Record<string, unknown>
}

export interface Runtime {
    evaluate: (code: string) => Promise<EvaluationResult | undefined>
    unmute: () => Promise<void>
    mute: () => Promise<void>
    stop: () => void
    setResolution: (scale: number) => void
    destroy: () => void
}

const fillWhole = (hap: Hap) => hap.whole === undefined ? new Hap(hap.part, hap.part, hap.value, hap.context) : hap

export const createRuntime = (canvas: HTMLCanvasElement, options: RuntimeOptions): Runtime => {
    const renderer = createRenderer(canvas)
    const overlay = createPixelOverlay(canvas)
    const errors = createErrorReporter(options.onPlaybackError)
    const audio = createAudio(errors, options.onBlockedSound)
    const scheduler = new Cyclist({ getTime: audio.getTime, onSchedule: audio.play, onError: errors.report })
    const previews = createImagePreviews()
    const media = createMediaCache(renderer, errors)
    let sound: Pattern = silence
    let visual: Visual | undefined
    let frame = 0
    let evaluationId = 0
    let isDestroyed = false

    setTime(() => scheduler.now())
    setClockTime(audio.getTime)
    setCpsFunc(() => scheduler.cps)

    const getVisualTime = () => {
        const delay = scheduler.latency - scheduler.clock.duration + audio.getOutputLatency()
        return scheduler.now() - delay * scheduler.cps
    }

    const createTextLayers = (graph: Graph) => graph.media.flatMap((input) => {
        const element = media.get(input)
        return input.name === 'text' && element instanceof HTMLCanvasElement ? [createTextLayer(element, input.settings)] : []
    })

    const createVisual = (graph: Graph, shown: ReadonlyArray<ImagePreview>, warnings: WarningList): Visual => ({
        graph: renderer.compile(graph),
        reader: createValueReader(graph.uniforms, warnings),
        previews: shown.map((preview) => previews.getElement(preview.id)),
        media: graph.media.map(media.get),
        texts: createTextLayers(graph),
    })

    const readHaps = (read: () => Array<Hap>) => errors.attempt(read, []).map(fillWhole)

    const renderFrame = () => {
        if (isDestroyed) {
            return
        }

        frame = requestAnimationFrame(renderFrame)

        if (!scheduler.started) {
            return
        }

        const time = getVisualTime()
        const haps = sound.queryArc(time, time)
        const shown = visual

        if (shown) {
            haps.push(...readHaps(() => shown.reader.updateValues(time)))

            for (const text of shown.texts) {
                haps.push(...readHaps(() => text.update(time, canvas.width, canvas.height)))
            }

            const inspection = errors.attempt(() => renderer.draw(shown.graph, shown.reader.values, time, scheduler.cps, shown.previews, shown.media), undefined)
            overlay.draw(inspection)
        }

        options.onFrame(time, haps)
    }

    frame = requestAnimationFrame(renderFrame)

    return {
        evaluate: async (code) => {
            const currentId = ++evaluationId

            const { evaluation, graph, sound: compiled, warnings } = await compileCode(code, {
                setCps: (cps) => {
                    if (!isDestroyed && currentId === evaluationId) {
                        scheduler.setCps(cps)
                    }
                },
                libraries: [webaudio],
                scope: options.scope,
                onWarning: options.onWarning,
            })

            if (isDestroyed || currentId !== evaluationId) {
                return undefined
            }

            cleanupDraw(true)
            errors.clear()
            visual = graph && createVisual(graph, evaluation.imagePreviews, warnings)
            media.releaseUnused(graph?.media ?? [])
            sound = errors.guard(compiled)
            await scheduler.setPattern(sound)

            if (isDestroyed || currentId !== evaluationId) {
                return undefined
            }

            if (!visual) {
                renderer.clear()
                overlay.clear()
            }

            if (!scheduler.started) {
                await scheduler.start()
            }

            return {
                miniLocations: evaluation.miniLocations,
                widgets: evaluation.widgets,
                imagePreviews: previews.show(evaluation.imagePreviews),
                patternPreviews: evaluation.patternPreviews,
                transpiled: evaluation.transpiled,
                graph,
            }
        },
        unmute: audio.unmute,
        mute: audio.mute,
        stop: () => {
            evaluationId += 1
            scheduler.stop()
            cleanupDraw(true)
            options.onFrame(0, [])
        },
        setResolution: (scale) => renderer.setScale(scale),
        destroy: () => {
            isDestroyed = true
            evaluationId += 1
            cancelAnimationFrame(frame)
            errors.destroy()
            scheduler.stop()
            cleanupDraw(true)
            audio.mute().catch(() => {})
            media.releaseUnused([])
            overlay.destroy()
            renderer.destroy()
        },
    }
}
