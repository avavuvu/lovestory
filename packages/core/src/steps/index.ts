import type { Argument, OperationName, Parameter } from '../operation'
import { colors } from './colors'
import { combines } from './combines'
import { coordinates } from './coordinates'
import type { Definition } from './definition'
import { sources } from './sources'

export type { Definition, Shape } from './definition'

export const definitions: Record<OperationName, Definition> = { ...sources, ...coordinates, ...colors, ...combines }

const getNames = <Name extends string>(group: Record<Name, Definition>) => Object.keys(group) as Array<Name>

export const sourceNames = getNames(sources)

export const coordinateNames = getNames(coordinates)

export const colorNames = getNames(colors)

export const combineNames = getNames(combines)

export const getFunctionName = (name: OperationName) => definitions[name].functionName ?? name

const isDefined = (value: Parameter | undefined): value is Parameter => value !== undefined

export const createArguments = (name: OperationName, values: ReadonlyArray<Parameter | undefined>): ReadonlyArray<Argument> => {
    const { parameters, neutral } = definitions[name]
    const filled = parameters.map((parameter, index) => values[index] ?? parameter.default)
    const given = filled.filter(isDefined)

    if (neutral === undefined || given.length === 1) {
        return given
    }

    return [neutral.map((fallback, index) => filled[index] ?? fallback)]
}
