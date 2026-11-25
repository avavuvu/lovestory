export interface FeedbackBuffer {
    textures: ReadonlyArray<WebGLTexture>
    framebuffers: ReadonlyArray<WebGLFramebuffer>
}

const floatSupport = new WeakMap<WebGL2RenderingContext, boolean>()

const hasFloatColor = (gl: WebGL2RenderingContext) => {
    const cached = floatSupport.get(gl)

    if (cached !== undefined) {
        return cached
    }

    const isSupported = gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null
    floatSupport.set(gl, isSupported)
    return isSupported
}

const allocateTexture = (gl: WebGL2RenderingContext, texture: WebGLTexture, width: number, height: number, isFloat: boolean, isNearest: boolean) => {
    gl.bindTexture(gl.TEXTURE_2D, texture)

    if (isFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
    } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }

    if (!isNearest) {
        gl.generateMipmap(gl.TEXTURE_2D)
    }
}

const createTexture = (gl: WebGL2RenderingContext, width: number, height: number, isFloat: boolean, isNearest: boolean) => {
    const texture = gl.createTexture()!

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, isNearest ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, isNearest ? gl.NEAREST : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, isNearest ? gl.CLAMP_TO_EDGE : gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, isNearest ? gl.CLAMP_TO_EDGE : gl.REPEAT)
    allocateTexture(gl, texture, width, height, isFloat, isNearest)

    return texture
}

const createFramebuffer = (gl: WebGL2RenderingContext, texture: WebGLTexture) => {
    const framebuffer = gl.createFramebuffer()!

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

    return framebuffer
}

const isFramebufferComplete = (gl: WebGL2RenderingContext, framebuffer: WebGLFramebuffer) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    const isComplete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return isComplete
}

export const createFeedbackBuffer = (gl: WebGL2RenderingContext, width: number, height: number, isNearest = false): FeedbackBuffer => {
    const isFloat = !isNearest && hasFloatColor(gl)
    const textures = [createTexture(gl, width, height, isFloat, isNearest), createTexture(gl, width, height, isFloat, isNearest)]
    const framebuffers = textures.map((texture) => createFramebuffer(gl, texture))

    if (isFloat && !isFramebufferComplete(gl, framebuffers[0])) {
        floatSupport.set(gl, false)

        for (const texture of textures) {
            allocateTexture(gl, texture, width, height, false, isNearest)
        }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { textures, framebuffers }
}

export const updateMipmaps = (gl: WebGL2RenderingContext, buffer: FeedbackBuffer, index: number) => {
    gl.bindTexture(gl.TEXTURE_2D, buffer.textures[index])
    gl.generateMipmap(gl.TEXTURE_2D)
}

export const resizeFeedbackBuffer = (gl: WebGL2RenderingContext, buffer: FeedbackBuffer, width: number, height: number, isNearest = false) => {
    const isFloat = !isNearest && hasFloatColor(gl)

    for (const texture of buffer.textures) {
        allocateTexture(gl, texture, width, height, isFloat, isNearest)
    }
}

export const deleteFeedbackBuffer = (gl: WebGL2RenderingContext, buffer: FeedbackBuffer) => {
    for (const framebuffer of buffer.framebuffers) {
        gl.deleteFramebuffer(framebuffer)
    }

    for (const texture of buffer.textures) {
        gl.deleteTexture(texture)
    }
}
