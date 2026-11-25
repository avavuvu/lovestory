const channelIndexes: Record<string, number> = { r: 0, g: 1, b: 2, a: 3, x: 0, y: 1, z: 2, w: 3 }

const isChannelOrder = (value: unknown): value is string => typeof value === 'string' && (/^[rgba]{1,4}$/.test(value) || /^[xyzw]{1,4}$/.test(value))

export const encodeChannels = (value: unknown) => {
    const order = isChannelOrder(value) ? value : 'rgba'
    const indexes = Array.from(order, (letter) => channelIndexes[letter] ?? 0)
    return indexes.reduce((code, channel, position) => code + channel * 4 ** position, 0) + (order.length - 1) * 256
}
