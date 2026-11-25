const vertexSource = [
    '#version 300 es',
    'void main() {',
    '    gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);',
    '}',
].join('\n')

const compileShader = (gl: WebGL2RenderingContext, type: GLenum, source: string) => {
    const shader = gl.createShader(type)!

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(log ?? 'shader compile failed')
    }

    return shader
}

export const createVertexShader = (gl: WebGL2RenderingContext) => compileShader(gl, gl.VERTEX_SHADER, vertexSource)

export const createProgram = (gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentSource: string) => {
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()!

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.detachShader(program, fragmentShader)
    gl.deleteShader(fragmentShader)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program)
        gl.deleteProgram(program)
        throw new Error(log ?? 'program link failed')
    }

    return program
}
