import type { Hap } from '@strudel/core'
import { aliasBank, getAudioContext, initAudio, registerSynthSounds, samples, webaudioOutput } from '@strudel/webaudio'
import type { ErrorReporter } from './errors'

const sampleHost = 'https://strudel.b-cdn.net'

let audioReady: Promise<void> | undefined
let hasLoadedSamples = false

const loadSamples = () => {
    if (hasLoadedSamples) {
        return
    }

    hasLoadedSamples = true
    registerSynthSounds()
    samples('github:tidalcycles/dirt-samples')
    samples(sampleHost + '/tidal-drum-machines.json', sampleHost + '/tidal-drum-machines/machines/')
        .then(() => aliasBank(sampleHost + '/tidal-drum-machines-alias.json'))
}

const isSilentValue = (value: unknown) => {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const gain = 'gain' in value ? Number(value.gain) : 1
    const postgain = 'postgain' in value ? Number(value.postgain) : 1
    return gain === 0 || postgain === 0
}

export const createAudio = (errors: ErrorReporter, onBlockedSound?: () => void) => {
    const context = getAudioContext()
    let shouldBeMuted = true
    let isMuted = true
    let audioOffset = 0
    let muteOffset = 0

    const getTime = () => isMuted ? performance.now() / 1000 + muteOffset : context.currentTime + audioOffset

    const play = (hap: Hap, time: number, cps: number) => {
        const { onSchedule, dominantSchedule, locations } = hap.context

        if (!(onSchedule && dominantSchedule)) {
            if (isMuted) {
                if (!isSilentValue(hap.value)) {
                    onBlockedSound?.()
                }
            } else {
                webaudioOutput(hap, time - audioOffset, cps).catch((error) => errors.report(error, locations))
            }
        }

        if (onSchedule) {
            Promise.resolve(onSchedule(hap, time, cps)).catch((error) => errors.report(error, locations))
        }
    }

    const unmute = async () => {
        shouldBeMuted = false
        await context.resume()

        audioReady ??= initAudio().catch((error: unknown) => {
            audioReady = undefined
            throw error
        })

        await audioReady

        if (shouldBeMuted) {
            await context.suspend()
            return
        }

        audioOffset = getTime() - context.currentTime
        isMuted = false
    }

    const mute = async () => {
        shouldBeMuted = true

        if (!isMuted) {
            muteOffset = context.currentTime + audioOffset - performance.now() / 1000
            isMuted = true
        }

        await context.suspend()
    }

    loadSamples()

    return { getTime, play, unmute, mute, getOutputLatency: () => context.outputLatency || 0 }
}
