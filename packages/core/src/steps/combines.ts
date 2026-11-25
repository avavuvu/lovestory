import type { Definition } from './definition'

export const combines = {
    add: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 add(vec4 color, vec4 other) {
    return vec4(color.rgb + other.rgb, clamp(color.a + other.a, 0.0, 1.0));
}`,
    },
    sub: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 sub(vec4 color, vec4 other) {
    return vec4(color.rgb - other.rgb, color.a);
}`,
    },
    mult: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 mult(vec4 color, vec4 other) {
    return color * other;
}`,
    },
    div: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 div(vec4 color, vec4 other) {
    vec3 isSafe = step(0.0001, abs(other.rgb));
    return vec4(isSafe * (color.rgb / mix(vec3(1.0), other.rgb, isSafe)), color.a);
}`,
    },
    min: {
        parameters: [],
        shapes: [],
        functionName: 'minStep',
        glsl: `
vec4 minStep(vec4 color, vec4 other) {
    return min(color, other);
}`,
    },
    max: {
        parameters: [],
        shapes: [],
        functionName: 'maxStep',
        glsl: `
vec4 maxStep(vec4 color, vec4 other) {
    return max(color, other);
}`,
    },
    pow: {
        parameters: [],
        shapes: [],
        functionName: 'powStep',
        glsl: `
vec4 powStep(vec4 color, vec4 other) {
    vec3 base = max(color.rgb, 0.0);
    vec3 isInvalid = (1.0 - step(0.000001, base)) * (1.0 - step(0.000001, other.rgb));
    vec3 safeBase = mix(base, vec3(1.0), isInvalid);
    return vec4(mix(pow(safeBase, other.rgb), vec3(0.0), isInvalid), color.a);
}`,
    },
    mod: {
        parameters: [],
        shapes: [],
        functionName: 'modStep',
        glsl: `
vec4 modStep(vec4 color, vec4 other) {
    vec3 isSafe = step(0.0001, abs(other.rgb));
    return vec4(isSafe * mod(color.rgb, mix(vec3(1.0), other.rgb, isSafe)), color.a);
}`,
    },
    diff: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 diff(vec4 color, vec4 other) {
    return vec4(abs(color.rgb - other.rgb), max(color.a, other.a));
}`,
    },
    layer: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 layer(vec4 color, vec4 other) {
    return vec4(mix(color.rgb, other.rgb, other.a), clamp(color.a + other.a, 0.0, 1.0));
}`,
    },
    mask: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 mask(vec4 color, vec4 other) {
    float amount = dot(other.rgb, vec3(0.2125, 0.7154, 0.0721));
    return vec4(color.rgb, color.a * amount);
}`,
    },
    key: {
        parameters: [{ name: 'tolerance', default: 0.3 }],
        shapes: ['scalar'],
        glsl: `
vec4 key(vec4 color, vec4 other, float tolerance) {
    const float softness = 0.1;
    float amount = smoothstep(tolerance, tolerance + softness, distance(color.rgb, other.rgb));
    return vec4(color.rgb, color.a * amount);
}`,
    },
    blend: {
        parameters: [{ name: 'amount', default: 0.5 }],
        shapes: ['scalar'],
        glsl: `
vec4 blend(vec4 color, vec4 other, float amount) {
    return mix(color, other, amount);
}`,
    },
    screen: {
        parameters: [],
        shapes: [],
        glsl: `
vec4 screen(vec4 color, vec4 other) {
    vec4 first = clamp(color, 0.0, 1.0);
    vec4 second = clamp(other, 0.0, 1.0);
    return 1.0 - (1.0 - first) * (1.0 - second);
}`,
    },
} satisfies Record<string, Definition>
