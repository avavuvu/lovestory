import { generateGraph, isImage, type Graph } from '@lovechild/core'
import * as strudel from '@strudel/core'
import { isPattern, silence, stack, type Pattern } from '@strudel/core'
import * as mini from '@strudel/mini'
import * as tonal from '@strudel/tonal'
import { evaluateCode, type EvaluatedScene } from './evaluate'
import { imageFunctions } from '../language/images'
import { getImagesByName, type ImageOrPattern } from './names'
import { patternFunctions } from '../language/patterns'
import { createWarningList, type Warning, type WarningList } from './warnings'
import { installPrototypes } from '../prototypes'

installPrototypes()

export interface CompileOptions {
    setCps: (cps: number) => void
    libraries?: ReadonlyArray<object>
    scope?: Record<string, unknown>
    inputs?: ReadonlyMap<string, ImageOrPattern>
    onWarning?: (warning: Warning) => void
}

export interface Compiled {
    evaluation: EvaluatedScene
    graph: Graph | undefined
    sound: Pattern
    warnings: WarningList
}

const readTempoValue = (value: unknown, name: string) => {
    const raw = isPattern(value) ? value.queryArc(0, 0)[0]?.value : value
    const number = Number(raw)

    if (!Number.isFinite(number) || number <= 0) {
        throw new Error(`${name} needs a positive number`)
    }

    return number
}

const createScope = ({ setCps, libraries = [], scope }: CompileOptions) => {
    const setTempo = (value: unknown) => {
        setCps(readTempoValue(value, 'setcps'))
        return silence
    }

    const setCpmTempo = (value: unknown) => {
        setCps(readTempoValue(value, 'setcpm') / 60)
        return silence
    }

    return {
        ...strudel,
        ...Object.assign({}, ...libraries),
        ...mini,
        ...tonal,
        ...imageFunctions,
        ...patternFunctions,
        ...scope,
        setcps: setTempo,
        setCps: setTempo,
        setcpm: setCpmTempo,
        setCpm: setCpmTempo,
    }
}

const layerImages = (onStage: ReadonlyArray<ImageOrPattern>) => {
    const images = onStage.filter(isImage)
    return images.length > 0 ? images.reduce((layered, next) => layered.layer(next)) : undefined
}

const buildSound = ({ onStage, allTransforms, eachTransforms }: EvaluatedScene) => {
    const sounds = onStage.filter(isPattern)
    const transformed = eachTransforms.reduce<ReadonlyArray<Pattern>>(
        (patterns, transform) => patterns.map((pattern) => {
            const next = transform(pattern)
            return isPattern(next) ? next : silence
        }),
        sounds,
    )
    const stacked = transformed.length > 0 ? stack(...transformed) : silence
    return allTransforms.reduce<Pattern>((pattern, transform) => {
        const next = transform(pattern)
        return isPattern(next) ? next : silence
    }, stacked)
}

const createGraph = ({ onStage, imagePreviews, imagesAndPatternsByName }: EvaluatedScene) => {
    const image = layerImages(onStage)

    if (image === undefined && imagePreviews.length === 0) {
        return undefined
    }

    return generateGraph(image, imagePreviews.map((preview) => preview.image), getImagesByName(imagesAndPatternsByName))
}

export const compileCode = async (code: string, options: CompileOptions): Promise<Compiled> => {
    let pendingCps: number | undefined
    const evaluation = await evaluateCode(code, createScope({ ...options, setCps: (cps) => { pendingCps = cps } }), options.inputs)
    const warnings = createWarningList(evaluation.sketch, options.onWarning)
    const sound = buildSound(evaluation)
    const graph = createGraph(evaluation)

    if (pendingCps !== undefined) {
        options.setCps(pendingCps)
    }

    for (const { details, place } of evaluation.reports) {
        warnings.add(details, place)
    }

    return {
        evaluation,
        graph,
        sound,
        warnings,
    }
}
