import type { Uniform } from '@lovechild/core'
import { isPattern, pure, type Hap, type Pattern } from '@strudel/core'
import { readColor } from './colors'
import type { Location, WarningList } from '../evaluation/warnings'

export interface ValueReader {
    values: ReadonlyArray<number>
    updateValues: (time: number) => Array<Hap>
}

const fallbackColor: ReadonlyArray<number> = [0, 0, 0, 1]

const maximumOnsetSearch = 1

export const createValueReader = (uniforms: ReadonlyArray<Uniform>, warnings: WarningList): ValueReader => {
    const patterns = uniforms.map((uniform) => isPattern(uniform.value) ? uniform.value : pure(uniform.value))
    const values = uniforms.map((uniform) => uniform.defaultValue)

    const encodeColor = (value: unknown, channel: number, locations: ReadonlyArray<Location>) => {
        const color = readColor(value)

        if (!color) {
            warnings.add({ kind: 'invalidColor', value }, { locations, search: typeof value === 'string' ? { text: value } : undefined })
        }

        return (color ?? fallbackColor)[channel] ?? 0
    }

    const encodeValue = (uniform: Uniform, hap: Hap) => {
        const encoded = uniform.colorChannel === undefined
            ? uniform.encode(hap.value)
            : encodeColor(hap.value, uniform.colorChannel, hap.context.locations ?? [])

        return Number.isFinite(encoded) ? encoded : uniform.defaultValue
    }

    for (const uniform of uniforms) {
        if (uniform.colorChannel !== undefined && !isPattern(uniform.value)) {
            encodeColor(uniform.value, uniform.colorChannel, [])
        }
    }

    let lastTime: number | undefined

    const hasOnset = (pattern: Pattern, from: number, time: number, isFirst: boolean) => pattern.queryArc(from, time)
        .some((hap) => {
            if (hap.whole === undefined) {
                return false
            }

            const begin = Number(hap.whole.begin)
            return isFirst ? begin === time : begin >= from && begin < time
        })

    const updateValues = (time: number) => {
        const isFirst = lastTime === undefined
        const from = isFirst || lastTime! > time ? time : Math.max(lastTime!, time - maximumOnsetSearch)
        lastTime = time

        return patterns.flatMap((pattern, index) => {
            const found = pattern.queryArc(time, time)

            if (uniforms[index].isOnset) {
                values[index] = hasOnset(pattern, from, time, isFirst) ? 1 : 0
                return found
            }

            if (found.length > 0) {
                values[index] = encodeValue(uniforms[index], found[0])
            }

            return found
        })
    }

    return { values, updateValues }
}
