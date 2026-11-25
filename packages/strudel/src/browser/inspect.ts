import type { PixelInspection } from '@lovechild/webgl'

export interface PixelOverlay {
    draw: (inspection: PixelInspection | undefined) => void
    clear: () => void
    destroy: () => void
}

const minimumFontSize = 9
const maximumFontSize = 64
const lineHeightScale = 1.25

export const createPixelOverlay = (canvas: HTMLCanvasElement): PixelOverlay => {
    const overlay = document.createElement('canvas')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.width = '100%'
    overlay.style.height = '100%'
    overlay.style.zIndex = '-1'
    overlay.style.pointerEvents = 'none'
    canvas.after(overlay)

    const context = overlay.getContext('2d')
    let hasContent = false

    const clear = () => {
        if (!hasContent || !context) {
            return
        }

        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, overlay.width, overlay.height)
        hasContent = false
    }

    const draw = (inspection: PixelInspection | undefined) => {
        if (!inspection || !context) {
            clear()
            return
        }

        const width = canvas.clientWidth
        const height = canvas.clientHeight

        if (width <= 0 || height <= 0) {
            clear()
            return
        }

        const cellWidth = width / inspection.width
        const cellHeight = height / inspection.height
        const lineCount = inspection.hasAlpha ? 4 : 3
        const maximumByHeight = (cellHeight * 0.78) / (lineCount * lineHeightScale)
        const maximumByWidth = (cellWidth * 0.8) / 2.5
        const fontSize = Math.floor(Math.min(maximumFontSize, maximumByHeight, maximumByWidth))

        if (fontSize < minimumFontSize) {
            clear()
            return
        }

        const ratio = window.devicePixelRatio || 1
        const backingWidth = Math.max(1, Math.round(width * ratio))
        const backingHeight = Math.max(1, Math.round(height * ratio))

        if (overlay.width !== backingWidth || overlay.height !== backingHeight) {
            overlay.width = backingWidth
            overlay.height = backingHeight
        }

        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        context.clearRect(0, 0, width, height)

        if (inspection.width > 1 || inspection.height > 1) {
            context.strokeStyle = 'rgba(128, 128, 128, 0.35)'
            context.lineWidth = 1
            context.beginPath()

            for (let column = 1; column < inspection.width; column++) {
                const x = column * cellWidth
                context.moveTo(x, 0)
                context.lineTo(x, height)
            }

            for (let row = 1; row < inspection.height; row++) {
                const y = row * cellHeight
                context.moveTo(0, y)
                context.lineTo(width, y)
            }

            context.stroke()
        }

        const lineHeight = fontSize * lineHeightScale
        const startOffset = -((lineCount - 1) * lineHeight) / 2

        context.font = `${fontSize}px FiraCode, monospace`
        context.textAlign = 'center'
        context.textBaseline = 'middle'

        for (let row = 0; row < inspection.height; row++) {
            const sourceRow = inspection.height - 1 - row
            const centerY = (row + 0.5) * cellHeight

            for (let column = 0; column < inspection.width; column++) {
                const offset = (sourceRow * inspection.width + column) * 4
                const red = inspection.pixels[offset] / 255
                const green = inspection.pixels[offset + 1] / 255
                const blue = inspection.pixels[offset + 2] / 255
                const alpha = inspection.pixels[offset + 3] / 255
                const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) * alpha
                const centerX = (column + 0.5) * cellWidth

                context.fillStyle = luminance > 0.5 ? '#000000' : '#ffffff'
                context.fillText(red.toFixed(2), centerX, centerY + startOffset)
                context.fillText(green.toFixed(2), centerX, centerY + startOffset + lineHeight)
                context.fillText(blue.toFixed(2), centerX, centerY + startOffset + lineHeight * 2)

                if (inspection.hasAlpha) {
                    context.fillText(alpha.toFixed(2), centerX, centerY + startOffset + lineHeight * 3)
                }
            }
        }

        hasContent = true
    }

    return {
        draw,
        clear,
        destroy: () => {
            overlay.remove()
        },
    }
}
