import type { MediaName, TextSettings, Value } from '../operation'

export type Frame = 'current' | 'previous'

export interface Uniform { name: string, value: Value, defaultValue: number, encode: (value: unknown) => number, colorChannel?: number, isOnset?: boolean }

export interface BufferInput { name: string, buffer: number, frame: Frame }

export interface BufferSize { widthUniform: number, heightUniform: number }

export interface BufferDescription { size?: BufferSize, isNearest?: boolean }

export interface Inspection { buffer: number, hasAlpha: boolean }

export type MediaInput = { key: string } & ({ name: MediaName, source: string } | { name: 'text', settings: TextSettings })

export type Target = { kind: 'screen' } | { kind: 'buffer', index: number } | { kind: 'preview', index: number }

export interface Pass { source: string, target: Target, inputs: ReadonlyArray<BufferInput>, media: ReadonlyArray<number> }

export interface Graph { uniforms: ReadonlyArray<Uniform>, passes: ReadonlyArray<Pass>, bufferCount: number, buffers: ReadonlyArray<BufferDescription>, inspection?: Inspection, media: ReadonlyArray<MediaInput> }
