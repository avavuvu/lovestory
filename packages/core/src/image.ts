import type { Amount, ColorName, CombineName, CoordinateName, Keyword, Operation, Paint, Parameter, Pattern, Scalar, SourceName } from './operation'
import { createArguments } from './steps'

type Values = ReadonlyArray<Parameter | undefined>

const isPattern = (value: unknown): value is Pattern => typeof value === 'object' && value !== null && 'queryArc' in value

const isScalar = (value: unknown): value is Scalar => typeof value === 'number' || isPattern(value)

const findPixelateSize = (operation: Operation): { width: Scalar, height: Scalar } | undefined => {
    if (operation.kind === 'pixelate') {
        return { width: operation.width, height: operation.height }
    }

    if ('input' in operation) {
        return findPixelateSize(operation.input)
    }

    return undefined
}

export class Image {
    readonly operation: Operation

    constructor(operation: Operation) {
        this.operation = operation
    }

    rotate(turns?: Amount) {
        return this.#transformCoordinate('rotate', [turns])
    }

    scale(x?: Amount, y?: Amount) {
        return this.#transformCoordinate('scale', [x, y])
    }

    scaleX(amount?: Amount) {
        return this.scale(amount, 1)
    }

    scaleY(amount?: Amount) {
        return this.scale(1, amount)
    }

    move(x?: Amount, y?: Amount) {
        return this.#transformCoordinate('move', [x, y])
    }

    moveX(amount?: Amount) {
        return this.move(amount, 0)
    }

    moveY(amount?: Amount) {
        return this.move(0, amount)
    }

    scroll(x?: Amount, y?: Amount) {
        return this.#transformCoordinate('scroll', [x, y])
    }

    scrollX(speed?: Amount) {
        return this.scroll(speed, 0)
    }

    scrollY(speed?: Amount) {
        return this.scroll(0, speed)
    }

    spin(speed?: Amount) {
        return this.#transformCoordinate('spin', [speed])
    }

    kaleid(sides?: Amount) {
        return this.#transformCoordinate('kaleid', [sides])
    }

    kaleidMove(push?: Amount, sides?: Amount) {
        return this.#transformCoordinate('kaleidMove', [push, sides])
    }

    stretch() {
        return this.#transformCoordinate('stretch', [])
    }

    polar() {
        return this.#transformCoordinate('polar', [])
    }

    pixelate(x?: Amount, y?: Amount) {
        return this.#transformCoordinate('pixelate', [x, y])
    }

    pixelateX(cells?: Amount) {
        return this.pixelate(cells, 0)
    }

    pixelateY(cells?: Amount) {
        return this.pixelate(0, cells)
    }

    pixelateTo(width?: Scalar, height?: Scalar) {
        const columns = width ?? 8
        return new Image({ kind: 'pixelate', input: this.operation, width: columns, height: height ?? columns, isInspected: false, hasAlpha: false })
    }

    inspectPixels(hasAlpha?: boolean) {
        if (this.operation.kind === 'pixelate') {
            return new Image({ ...this.operation, isInspected: true, hasAlpha: Boolean(hasAlpha) })
        }

        const size = findPixelateSize(this.operation)
        return new Image({ kind: 'pixelate', input: this.operation, width: size?.width ?? 8, height: size?.height ?? 8, isInspected: true, hasAlpha: Boolean(hasAlpha) })
    }

    nearest() {
        return this.#transformCoordinate('nearest', [])
    }

    nearestNeighbour() {
        return this.nearest()
    }

    nearestNeighbor() {
        return this.nearest()
    }

    crisp() {
        return this.nearest()
    }

    repeat(x?: Amount, y?: Amount) {
        return this.#transformCoordinate('repeat', [x, y])
    }

    repeatX(times?: Amount) {
        return this.repeat(times, 0)
    }

    repeatY(times?: Amount) {
        return this.repeat(0, times)
    }

    invert(amount?: Amount) {
        return this.#transformColor('invert', [amount])
    }

    brightness(amount?: Amount) {
        return this.#transformColor('brightness', [amount])
    }

    contrast(amount?: Amount) {
        return this.#transformColor('contrast', [amount])
    }

    saturate(amount?: Amount) {
        return this.#transformColor('saturate', [amount])
    }

    hue(turns?: Amount) {
        return this.#transformColor('hue', [turns])
    }

    colorama(amount?: Amount) {
        return this.#transformColor('colorama', [amount])
    }

    shift(red?: Amount, green?: Amount, blue?: Amount) {
        return this.#transformColor('shift', [red, green, blue])
    }

    grey() {
        return this.#transformColor('grey', [])
    }

    gray() {
        return this.grey()
    }

    posterize(levels?: Amount) {
        return this.#transformColor('posterize', [levels])
    }

    posterise(levels?: Amount) {
        return this.posterize(levels)
    }

    abs() {
        return this.#transformColor('abs', [])
    }

    fract() {
        return this.#transformColor('fract', [])
    }

    smoothstep(start?: Amount, end?: Amount) {
        return this.#transformColor('smoothstep', [start, end])
    }

    thresh(threshold?: Amount, tolerance?: Amount) {
        return this.#transformColor('thresh', [threshold, tolerance])
    }

    opacity(amount?: Amount) {
        return this.#transformColor('opacity', [amount])
    }

    luma(threshold?: Amount) {
        return this.#transformColor('luma', [threshold])
    }

    channels(order?: Keyword) {
        return this.#transformColor('channels', [order])
    }

    range(minimum?: Amount, maximum?: Amount) {
        return this.#transformColor('range', [minimum, maximum])
    }

    between(minimum?: Amount, maximum?: Amount) {
        return this.range(minimum, maximum)
    }

    split(x?: Amount, y?: Amount) {
        const amount = x ?? 0.02
        const red = this.move(amount, y).mult(this.#createSource('solid', [1, 0, 0, 1]))
        const green = this.mult(this.#createSource('solid', [0, 1, 0, 1]))
        const blue = this.move(this.#negate(amount), y === undefined ? undefined : this.#negate(y)).mult(this.#createSource('solid', [0, 0, 1, 1]))
        return red.add(green).add(blue)
    }

    splitX(amount?: Amount) {
        return this.split(amount, 0)
    }

    splitY(amount?: Amount) {
        return this.split(0, amount)
    }

    add(other: Paint) {
        return this.#combineWith('add', this.#toImage(other, 0), [])
    }

    sub(other: Paint) {
        return this.#combineWith('sub', this.#toImage(other, 1), [])
    }

    subtract(other: Paint) {
        return this.sub(other)
    }

    mult(other: Paint) {
        return this.#combineWith('mult', this.#toImage(other, 1), [])
    }

    color(red?: Paint, green?: Amount, blue?: Amount, alpha?: Amount) {
        const isSingle = green === undefined && blue === undefined && alpha === undefined

        if (isSingle && red !== undefined) {
            return this.mult(this.#toImage(red, 1))
        }

        return this.mult(this.#createSource('solid', [red ?? 1, green ?? 1, blue ?? 1, alpha ?? 1]))
    }

    colour(red?: Paint, green?: Amount, blue?: Amount, alpha?: Amount) {
        return this.color(red, green, blue, alpha)
    }

    multiply(other: Paint) {
        return this.mult(other)
    }

    div(other: Paint) {
        return this.#combineWith('div', this.#toImage(other, 1), [])
    }

    divide(other: Paint) {
        return this.div(other)
    }

    min(other: Paint) {
        return this.#combineWith('min', this.#toImage(other, 1), [])
    }

    max(other: Paint) {
        return this.#combineWith('max', this.#toImage(other, 0), [])
    }

    pow(other: Paint) {
        return this.#combineWith('pow', this.#toImage(other, 1), [])
    }

    mod(other: Paint) {
        return this.#combineWith('mod', this.#toImage(other, 1), [])
    }

    diff(other: Paint) {
        return this.#combineWith('diff', this.#toImage(other, 0), [])
    }

    difference(other: Paint) {
        return this.diff(other)
    }

    layer(other: Paint) {
        return this.#combineWith('layer', this.#toImage(other, 1), [])
    }

    mask(other: Paint) {
        return this.#combineWith('mask', this.#toImage(other, 1), [])
    }

    screen(other: Paint) {
        return this.#combineWith('screen', this.#toImage(other, 1), [])
    }

    key(color?: Paint, tolerance?: Amount) {
        return this.#combineWith('key', this.#toImage(color ?? '#00ff00', 1), [tolerance])
    }

    blend(other: Paint, amount?: Amount) {
        return this.#combineWith('blend', this.#toImage(other, 1), [amount])
    }

    mix(other: Paint, amount?: Amount) {
        return this.blend(other, amount)
    }

    chromaMove(other: Image, amount?: Amount) {
        if (!isImage(other)) {
            throw new Error('chromaMove needs an image')
        }

        const pixel = new Image({ kind: 'source', name: 'pixels', parameters: createArguments('pixels', [amount]) })
        const red = new Image({ kind: 'swizzle', input: other.operation, channels: 'r' })
        const green = new Image({ kind: 'swizzle', input: other.operation, channels: 'g' })
        const blue = new Image({ kind: 'swizzle', input: other.operation, channels: 'b' })

        return this.move(red.sub(green).mult(pixel), green.sub(blue).mult(pixel))
    }

    capture(gate?: Amount | boolean) {
        const amount = typeof gate === 'boolean' ? Number(gate) : gate ?? 0
        return this.#captureWith(this.#fillWith(amount, 1).thresh(0.5))
    }

    posteriseTime(rate?: Amount, offset?: Amount) {
        return this.#captureWith(this.#createSource('ticks', [rate, offset]))
    }

    posterizeTime(rate?: Amount, offset?: Amount) {
        return this.posteriseTime(rate, offset)
    }

    stutter(rhythm?: Scalar) {
        if (rhythm === undefined || typeof rhythm === 'number') {
            return this.posteriseTime(rhythm)
        }

        return this.#captureWith(this.#createSource('onsets', [rhythm]))
    }

    lag(duration?: Amount) {
        return this.#captureWith(this.#createSource('catchUp', [duration]))
    }

    hush() {
        return new Image({ kind: 'source', name: 'empty', parameters: [] })
    }

    #captureWith(gate: Image) {
        return new Image({ kind: 'capture', input: this.operation, gate: gate.operation })
    }

    #createSource(name: SourceName, values: Values) {
        return new Image({ kind: 'source', name, parameters: createArguments(name, values) })
    }

    #transformCoordinate(name: CoordinateName, values: Values) {
        return new Image({ kind: 'coordinate', name, input: this.operation, parameters: createArguments(name, values) })
    }

    #transformColor(name: ColorName, values: Values) {
        return new Image({ kind: 'color', name, input: this.operation, parameters: createArguments(name, values) })
    }

    #negate(amount: Amount) {
        return typeof amount === 'number' ? -amount : this.#fillWith(amount, 1).mult(-1)
    }

    #fillWith(value: Image | Scalar, alpha: number) {
        if (!isScalar(value)) {
            return value
        }

        return this.#createSource('solid', [value, value, value, alpha])
    }

    #toImage(value: Paint, alpha: number): Image {
        if (typeof value === 'number') {
            return this.#createSource('solid', [value, value, value, alpha])
        }

        if (typeof value === 'string' || isPattern(value)) {
            const painted = this.#createSource('paint', [value, value, value, value])
            return alpha === 0 ? painted.opacity(0) : painted
        }

        return value
    }

    #combineWith(name: CombineName, other: Image, values: Values) {
        if (!isImage(other)) {
            throw new Error(`${name} needs an image`)
        }

        return new Image({ kind: 'combine', name, input: this.operation, other: other.operation, parameters: createArguments(name, values) })
    }
}

export const isImage = (value: unknown): value is Image => value instanceof Image

export const selectImage = (selector: Parameter, options: ReadonlyArray<Image>) => {
    return new Image({ kind: 'select', options: options.map((option) => option.operation), parameters: [selector] })
}

const createSwizzleNames = (letters: string) => {
    const lengths = [Array.from(letters)]

    while (lengths.length < letters.length) {
        lengths.push(lengths[lengths.length - 1].flatMap((prefix) => Array.from(letters, (letter) => prefix + letter)))
    }

    return lengths.flat()
}

for (const channels of ['rgba', 'xyzw'].flatMap(createSwizzleNames)) {
    Object.defineProperty(Image.prototype, channels, {
        value: function (this: Image) {
            return new Image({ kind: 'swizzle', input: this.operation, channels })
        },
        configurable: true,
        writable: true,
    })
}

export const imageMethodNames: ReadonlyArray<string> = Object.getOwnPropertyNames(Image.prototype).filter((name) => name !== 'constructor')
