import type { TextSettings, Value } from '@lovechild/core'
import { markCanvasChanged } from '@lovechild/webgl'
import { isPattern, type Hap } from '@strudel/core'

export interface TextLayer {
    update: (time: number, width: number, height: number) => Array<Hap>
}

interface TextValues {
    content: string
    font: string
    outline: number
    wrap: number
}

const defaults: TextValues = { content: '', font: 'sans-serif', outline: 0, wrap: 1 }

const emojiFont = 'Twemoji'

const emojiSampleGlyph = '♥'

const genericFonts = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded'])

const glyphColor = '#ffffff'

const measureSize = 100

const lineHeight = 1.2

const margin = 0.05

const outlineScale = 0.05

const toText = (value: unknown, fallback: string) => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback

const toNumber = (value: unknown, fallback: number) => {
    const number = Number(value)
    return value !== undefined && Number.isFinite(number) ? number : fallback
}

const formatPrimaryFont = (font: string) => {
    const trimmed = font.trim()

    if (trimmed === '' || genericFonts.has(trimmed.toLowerCase()) || trimmed.includes(',') || trimmed.includes('"') || trimmed.includes("'")) {
        return trimmed || defaults.font
    }

    return JSON.stringify(trimmed)
}

const formatFontFamily = (font: string) => `${JSON.stringify(emojiFont)}, ${formatPrimaryFont(font)}`

const wrapParagraph = (context: CanvasRenderingContext2D, paragraph: string, limit: number) => {
    const lines: Array<string> = []
    let line = ''

    for (const word of paragraph.split(' ')) {
        const candidate = line === '' ? word : line + ' ' + word

        if (line !== '' && context.measureText(candidate).width > limit) {
            lines.push(line)
            line = word
        } else {
            line = candidate
        }
    }

    return [...lines, line]
}

const getLines = (context: CanvasRenderingContext2D, values: TextValues) => {
    const paragraphs = values.content.split('\n')

    if (values.wrap >= 1) {
        return paragraphs
    }

    const widest = Math.max(...paragraphs.map((paragraph) => context.measureText(paragraph).width))
    return paragraphs.flatMap((paragraph) => wrapParagraph(context, paragraph, widest * Math.max(0.01, values.wrap)))
}

const drawText = (context: CanvasRenderingContext2D, values: TextValues, width: number, height: number) => {
    const targetHeight = height * 2

    if (context.canvas.width !== width || context.canvas.height !== targetHeight) {
        context.canvas.width = width
        context.canvas.height = targetHeight
    } else {
        context.clearRect(0, 0, width, targetHeight)
    }

    const family = formatFontFamily(values.font)
    context.font = `${measureSize}px ${family}`

    const lines = getLines(context, values)
    const outline = Math.max(0, values.outline) * outlineScale
    const textWidth = Math.max(...lines.map((line) => context.measureText(line).width)) + outline * measureSize * 2
    const textHeight = lines.length * lineHeight * measureSize + outline * measureSize * 2

    if (lines.every((line) => line === '') || textWidth <= 0 || textHeight <= 0) {
        return
    }

    const size = measureSize * Math.min(width * (1 - 2 * margin) / textWidth, height * (1 - 2 * margin) / textHeight)

    context.font = `${size}px ${family}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.fillStyle = glyphColor
    context.strokeStyle = glyphColor
    context.lineWidth = outline * size * 2

    for (const [index, line] of lines.entries()) {
        const y = height / 2 + (index - (lines.length - 1) / 2) * lineHeight * size
        context.fillText(line, width / 2, y)

        if (outline > 0) {
            context.strokeText(line, width / 2, height + y)
        }
    }
}

export const createTextLayer = (canvas: HTMLCanvasElement, settings: TextSettings): TextLayer => {
    const context = canvas.getContext('2d')
    const attemptedFonts = new Set<string>()
    let current = defaults
    let drawn = ''

    const redraw = () => {
        drawn = ''
    }

    const ensureFont = (family: string, text?: string) => {
        const key = `${family}\0${text ?? ''}`

        if (attemptedFonts.has(key)) {
            return
        }

        attemptedFonts.add(key)
        const sample = `${measureSize}px ${family}`

        if (!document.fonts.check(sample, text)) {
            document.fonts.load(sample, text).then((faces) => {
                if (faces.length > 0) {
                    redraw()
                }
            }, () => {})
        }
    }

    const loadFont = (font: string) => {
        ensureFont(JSON.stringify(emojiFont), emojiSampleGlyph)
        ensureFont(formatPrimaryFont(font))
    }

    return {
        update: (time, width, height) => {
            const found: Array<Hap> = []

            const read = (value: Value | undefined) => {
                if (!isPattern(value)) {
                    return value
                }

                const haps = value.queryArc(time, time)
                found.push(...haps)
                return haps[0]?.value
            }

            current = {
                content: toText(read(settings.content), current.content),
                font: toText(read(settings.font), current.font),
                outline: toNumber(read(settings.outline), current.outline),
                wrap: toNumber(read(settings.wrap), current.wrap),
            }

            const signature = JSON.stringify([current, width, height])

            if (context && signature !== drawn) {
                drawn = signature
                loadFont(current.font)
                drawText(context, current, width, height)
                markCanvasChanged(canvas)
            }

            return found
        },
    }
}
