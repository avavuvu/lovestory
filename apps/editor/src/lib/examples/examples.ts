import { getFileName } from '../files'

const indexFiles = import.meta.glob<string>('./index/*.js', { query: '?raw', import: 'default', eager: true })
const otherFiles = import.meta.glob<string>('./other/*.js', { query: '?raw', import: 'default', eager: true })

const readEntries = (files: Record<string, string>) => Object.entries(files)
    .map(([path, code]): [string, string] => [getFileName(path), code])
    .sort(([first], [second]) => first.localeCompare(second))

const indexEntries = readEntries(indexFiles)
const allEntries = [...indexEntries, ...readEntries(otherFiles)].sort(([first], [second]) => first.localeCompare(second))

export const indexExamples = new Map(indexEntries)
export const indexExampleNames = Array.from(indexExamples.keys())

export const examples = new Map(allEntries)
export const exampleNames = Array.from(examples.keys())

const pickFrom = (names: ReadonlyArray<string>, excluded?: string) => {
    const candidates = excluded && names.length > 1 ? names.filter((name) => name !== excluded) : names
    return candidates[Math.floor(Math.random() * candidates.length)]
}

export const pickIndexExampleName = (excluded?: string) => pickFrom(indexExampleNames, excluded)

export const pickExampleName = (excluded?: string) => pickFrom(exampleNames, excluded)

const runHint = '// alt+enter to run'

export const addRunHint = (code: string) => {
    const trimmed = code.trimStart()

    if (trimmed.startsWith(runHint)) {
        return code
    }

    return `${runHint}\n\n${trimmed}`
}
