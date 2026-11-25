import { Image, isImage } from './image'
import { paint as createPaint } from './sources'
import type { Keyword, Operation, Paint, Scalar, TextSettings, Value } from './operation'

interface TextParts {
    settings: TextSettings
    fill: Operation
    stroke: Operation
}

const defaultOutline = 0.5

const defaultWrap = 0.5

const emptyOperation: Operation = { kind: 'source', name: 'empty', parameters: [] }

const toOperation = (paint: Paint): Operation => isImage(paint) ? paint.operation : createPaint(paint).operation

export class TextImage extends Image {
    readonly parts: TextParts
    readonly isHushed: boolean

    constructor(parts: TextParts, isHushed = false) {
        super(isHushed ? emptyOperation : { kind: 'text', ...parts })
        this.parts = parts
        this.isHushed = isHushed
    }

    font(family: Keyword) {
        return this.#change({ settings: { ...this.parts.settings, font: family } })
    }

    fill(paint: Paint) {
        return this.#change({ fill: toOperation(paint) })
    }

    stroke(paint: Paint) {
        const { settings } = this.parts
        return this.#change({ stroke: toOperation(paint), settings: { ...settings, outline: settings.outline ?? defaultOutline } })
    }

    outline(width?: Scalar) {
        return this.#change({ settings: { ...this.parts.settings, outline: width ?? defaultOutline } })
    }

    wrap(width?: Scalar) {
        return this.#change({ settings: { ...this.parts.settings, wrap: width ?? defaultWrap } })
    }

    hush() {
        return new TextImage(this.parts, true)
    }

    #change(parts: Partial<TextParts>) {
        return new TextImage({ ...this.parts, ...parts }, this.isHushed)
    }
}

export const textStyleNames: ReadonlyArray<string> = Object.getOwnPropertyNames(TextImage.prototype).filter((name) => !(name in Image.prototype))

const textStyles: ReadonlySet<string> = new Set(textStyleNames)

export const isTextStyle = (name: string) => textStyles.has(name)

export const text = (content?: Value) => new TextImage({ settings: { content: content ?? '' }, fill: toOperation('white'), stroke: toOperation('black') })
