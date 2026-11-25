import type { Definition } from './definition'

export const coordinates = {
    rotate: {
        parameters: [{ name: 'turns', default: 0.125 }],
        shapes: ['scalar'],
        glsl: `
vec2 rotate(vec2 coordinate, float turns) {
    float angle = turns * TAU;
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * (coordinate - 0.5) + 0.5;
}`,
    },
    scale: {
        parameters: [{ name: 'x', default: 1.5 }, { name: 'y' }],
        shapes: ['xy'],
        neutral: [1, 1],
        glsl: `
vec2 scale(vec2 coordinate, vec2 amount) {
    vec2 safe = vec2(abs(amount.x) < 0.0001 ? 0.0001 : amount.x, abs(amount.y) < 0.0001 ? 0.0001 : amount.y);
    return (coordinate - 0.5) / safe + 0.5;
}`,
    },
    move: {
        parameters: [{ name: 'x', default: 0.5 }, { name: 'y' }],
        shapes: ['xy'],
        neutral: [0, 0],
        glsl: `
vec2 move(vec2 coordinate, vec2 offset) {
    return coordinate - offset;
}`,
    },
    scroll: {
        parameters: [{ name: 'x', default: 0.1 }, { name: 'y' }],
        shapes: ['xy'],
        neutral: [0, 0],
        glsl: `
vec2 scroll(vec2 coordinate, vec2 speed) {
    return coordinate - speed * time;
}`,
    },
    spin: {
        parameters: [{ name: 'speed', default: 0.1 }],
        shapes: ['scalar'],
        glsl: `
vec2 spin(vec2 coordinate, float speed) {
    float angle = fract(speed * time) * TAU;
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * (coordinate - 0.5) + 0.5;
}`,
    },
    kaleid: {
        parameters: [{ name: 'sides', default: 4 }],
        shapes: ['scalar'],
        glsl: `
vec2 kaleid(vec2 coordinate, float sides) {
    vec2 point = coordinate - 0.5;
    float segment = TAU / max(abs(sides), 0.0001);
    float angle = abs(mod(atan(point.y, point.x), segment) - segment / 2.0);
    return length(point) * vec2(cos(angle), sin(angle)) + 0.5;
}`,
    },
    kaleidMove: {
        parameters: [{ name: 'push', default: 0.1 }, { name: 'sides', default: 4 }],
        shapes: ['scalar', 'scalar'],
        glsl: `
vec2 kaleidMove(vec2 coordinate, float push, float sides) {
    vec2 point = coordinate - 0.5;
    float segment = TAU / max(abs(sides), 0.0001);
    float angle = abs(mod(atan(point.y, point.x), segment) - segment / 2.0);
    return (length(point) + push) * vec2(cos(angle), sin(angle)) + 0.5;
}`,
    },
    stretch: {
        parameters: [],
        shapes: [],
        glsl: `
vec2 stretch(vec2 coordinate) {
    return (coordinate - 0.5) * min(areaSize.x, areaSize.y) / areaSize + 0.5;
}`,
    },
    polar: {
        parameters: [],
        shapes: [],
        glsl: `
vec2 polar(vec2 coordinate) {
    vec2 point = coordinate - 0.5;
    return vec2(atan(point.y, point.x) / TAU + 0.5, length(point));
}`,
    },
    nearest: {
        parameters: [],
        shapes: [],
        glsl: `
vec2 nearest(vec2 coordinate) {
    float unit = min(bufferResolution.x, bufferResolution.y);
    vec2 texel = (coordinate - 0.5) * unit + 0.5 * bufferResolution;
    return (floor(texel) + 0.5 - 0.5 * bufferResolution) / unit + 0.5;
}`,
    },
    pixelate: {
        parameters: [{ name: 'x', default: 20 }, { name: 'y' }],
        shapes: ['xy'],
        neutral: [0, 0],
        glsl: `
vec2 pixelate(vec2 coordinate, vec2 cells) {
    vec2 safe = max(cells, 0.0001);
    vec2 pixelated = floor((coordinate - 0.5) * safe + 0.5) / safe + 0.5;
    return mix(coordinate, pixelated, step(0.0001, cells));
}`,
    },
    repeat: {
        parameters: [{ name: 'x', default: 3 }, { name: 'y' }],
        shapes: ['xy'],
        neutral: [0, 0],
        glsl: `
vec2 repeat(vec2 coordinate, vec2 times) {
    vec2 repeated = fract((coordinate - 0.5) * times + 0.5);
    return mix(coordinate, repeated, step(0.0001, times));
}`,
    },
} satisfies Record<string, Definition>
