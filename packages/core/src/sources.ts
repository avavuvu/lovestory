import { Image, isImage } from './image'
import type { Amount, Paint, Parameter, SourceName } from './operation'
import { createArguments } from './steps'

const createSource = (name: SourceName, values: ReadonlyArray<Parameter | undefined>) => new Image({ kind: 'source', name, parameters: createArguments(name, values) })

export const paint = (color: Paint) => createSource('paint', [color, color, color, color])

const shape = (sides?: Amount, softness?: Amount) => createSource('shape', [sides, softness])

const solid = (red?: Paint, green?: Amount, blue?: Amount, alpha?: Amount) => {
    const isSingle = green === undefined && blue === undefined && alpha === undefined

    if (isSingle && red !== undefined && !isImage(red)) {
        return paint(red)
    }

    return createSource('solid', [red, green, blue, alpha])
}

const pixels = (count?: Amount) => createSource('pixels', [count])

export const sourceFunctions = {
    osc: (frequency?: Amount, phase?: Amount) => createSource('osc', [frequency, phase]),
    shape,
    polygon: shape,
    solid,
    color: solid,
    colour: solid,
    rgb: solid,
    xyz: solid,
    white: () => solid(1, 1, 1),
    black: () => solid(0, 0, 0),
    hsv: (hue?: Amount, saturation?: Amount, value?: Amount, alpha?: Amount) => createSource('hsv', [hue, saturation, value, alpha]),
    oklch: (lightness?: Amount, chroma?: Amount, hue?: Amount, alpha?: Amount) => createSource('oklch', [lightness, chroma, hue, alpha]),
    noise: (scale?: Amount, speed?: Amount) => createSource('noise', [scale, speed]),
    simplex: (scale?: Amount, phase?: Amount, offset?: Amount) => createSource('simplex', [scale, phase, offset]),
    voronoi: (scale?: Amount, speed?: Amount, blending?: Amount) => createSource('voronoi', [scale, speed, blending]),
    gradient: () => createSource('gradient', []),
    pixels,
    px: pixels,
    resolution: () => createSource('resolution', []),
    fps: (rate?: Amount) => createSource('fps', [rate]),
    seconds: (duration?: Amount) => createSource('seconds', [duration]),
}

export const previous = (imageName?: string) => new Image({ kind: 'previous', imageName })

export const camera = () => new Image({ kind: 'media', name: 'camera', source: '' })

export const video = (source: string) => new Image({ kind: 'media', name: 'video', source })

export const picture = (source: string) => new Image({ kind: 'media', name: 'picture', source })
