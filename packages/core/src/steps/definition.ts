import type { Helper } from '../glsl/helpers'

export type Shape = 'scalar' | 'xy' | 'rgb' | 'rgba'

export interface ParameterDefinition {
    name: string
    default?: number | string
}

export interface Definition {
    parameters: ReadonlyArray<ParameterDefinition>
    shapes: ReadonlyArray<Shape>
    neutral?: ReadonlyArray<number>
    helpers?: ReadonlyArray<Helper>
    encode?: (value: unknown) => number
    hasColorChannels?: boolean
    isInternal?: boolean
    isOnset?: boolean
    functionName?: string
    glsl: string
}
