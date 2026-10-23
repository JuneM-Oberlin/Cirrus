/* The globe's GPU renderer. It draws the satellite pictures onto the
   sphere with WebGL 2 at the screen's full resolution, smoothly filtered
   (mipmaps, plus anisotropic filtering where the browser has it), so the
   globe stays crisp even while it turns and zooms.

   The fragment shader runs the same inverse orthographic projection as
   placeAt() in globe.js: for each pixel it works out the latitude and
   longitude, samples the whole-world picture and up to two sharper
   close-up pictures (faded in at their edges so no seams show), then
   lights the sphere like a toy globe under a lamp: a soft sun from the
   upper left, a glint on the oceans, and a blue haze of atmosphere at the
   rim with a glow just outside it.

   create() returns null when WebGL 2 isn't available; globe.js then draws
   with its canvas 2D code instead. */

const CirrusGlobeGL = (function () {
    const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

    const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uSize;        // canvas size, device pixels
uniform vec2 uCenter;      // disc centre, device pixels from the top left
uniform float uRadius;     // disc radius, device pixels
uniform vec3 uFacing;      // sin(lat0), cos(lat0), lon0 in radians

uniform sampler2D uBase;
uniform sampler2D uDetailA;
uniform sampler2D uDetailB;
uniform vec4 uBoundsA;     // minLon, minLat, maxLon, maxLat in degrees
uniform vec4 uBoundsB;
uniform vec3 uHave;        // 1 when the base, detail A, detail B pictures are loaded

uniform vec3 uOcean;
uniform vec4 uGlow;
uniform vec3 uAtmosphere;
uniform vec3 uLight;       // direction toward the sun (x right, y up, z toward you)
uniform float uAmbient;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;
uniform float uRim;
uniform float uRimPower;
uniform float uSaturation;
uniform float uGlowWidth;

out vec4 outColor;

// Where (lonDeg, latDeg) falls in a picture covering bounds, as 0..1 coordinates.
vec2 pictureSpot(vec4 bounds, float lonDeg, float latDeg) {
    return vec2((lonDeg - bounds.x) / (bounds.z - bounds.x), (bounds.w - latDeg) / (bounds.w - bounds.y));
}

vec3 samplePicture(sampler2D picture, vec4 bounds, float lonDeg, float latDeg, vec2 stepX, vec2 stepY) {
    vec2 perDegree = vec2(1.0 / (bounds.z - bounds.x), -1.0 / (bounds.w - bounds.y));
    return textureGrad(picture, pictureSpot(bounds, lonDeg, latDeg), stepX * perDegree, stepY * perDegree).rgb;
}

// 1 inside a picture, fading to 0 across its outer 4% so it blends in.
float coverage(vec4 bounds, float lonDeg, float latDeg) {
    vec2 spot = pictureSpot(bounds, lonDeg, latDeg);
    vec2 fromEdge = min(spot, 1.0 - spot);
    return smoothstep(0.0, 0.04, min(fromEdge.x, fromEdge.y));
}

void main() {
    vec2 pixel = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    vec2 onDisc = vec2(pixel.x - uCenter.x, uCenter.y - pixel.y) / uRadius;
    float fromCentre = length(onDisc);

    // Pixels just outside the disc borrow its edge, so the edge can be smoothed.
    vec2 point = onDisc / max(fromCentre / 0.9999, 1.0);
    float z = sqrt(max(1.0 - dot(point, point), 0.0));
    float latDeg = degrees(asin(clamp(z * uFacing.x + point.y * uFacing.y, -1.0, 1.0)));
    float lonDeg = degrees(uFacing.z + atan(point.x, z * uFacing.y - point.y * uFacing.x));
    lonDeg = mod(lonDeg + 180.0, 360.0) - 180.0;

    // How far one pixel moves across the map, for smooth filtering. The
    // longitude jumps by 360 at the date line, so that jump is taken out.
    vec2 stepX = vec2(dFdx(lonDeg), dFdx(latDeg));
    vec2 stepY = vec2(dFdy(lonDeg), dFdy(latDeg));
    stepX.x -= 360.0 * round(stepX.x / 360.0);
    stepY.x -= 360.0 * round(stepY.x / 360.0);
    float edgeWidth = fwidth(fromCentre);

    vec3 color = uOcean;
    if (uHave.x > 0.5) {
        color = samplePicture(uBase, vec4(-180.0, -90.0, 180.0, 90.0), lonDeg, latDeg, stepX, stepY);
    }
    if (uHave.y > 0.5) {
        vec3 sharper = samplePicture(uDetailA, uBoundsA, lonDeg, latDeg, stepX, stepY);
        color = mix(color, sharper, coverage(uBoundsA, lonDeg, latDeg));
    }
    if (uHave.z > 0.5) {
        vec3 sharper = samplePicture(uDetailB, uBoundsB, lonDeg, latDeg, stepX, stepY);
        color = mix(color, sharper, coverage(uBoundsB, lonDeg, latDeg));
    }

    // a little more colour, like a printed globe
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, uSaturation);

    // a soft sun, never letting the far side go dark
    vec3 normal = vec3(point, z);
    float sunlight = uAmbient + uDiffuse * max(dot(normal, uLight), 0.0);
    // the oceans catch a glint of it
    float water = smoothstep(0.03, 0.16, color.b - max(color.r, color.g));
    vec3 halfway = normalize(uLight + vec3(0.0, 0.0, 1.0));
    float glint = pow(max(dot(normal, halfway), 0.0), uShininess) * uSpecular * water;
    color = color * sunlight + glint;

    // blue haze toward the rim, as if seen through the air
    float haze = clamp(pow(1.0 - z, uRimPower) * uRim, 0.0, 1.0);
    color = mix(color, uAtmosphere, haze);

    // the disc's edge is smoothed over about a pixel, with the glow beyond it
    float inside = clamp((1.0 - fromCentre) / max(edgeWidth, 0.00001) + 0.5, 0.0, 1.0);
    float glowFade = clamp((fromCentre - 1.0) / uGlowWidth, 0.0, 1.0);
    float glowAlpha = uGlow.a * (1.0 - glowFade) * (1.0 - glowFade);
    vec4 glow = vec4(uGlow.rgb * glowAlpha, glowAlpha);
    outColor = mix(glow, vec4(min(color, vec3(1.0)), 1.0), inside);
}`;

    const UNIFORMS = [
        "uSize", "uCenter", "uRadius", "uFacing", "uBase", "uDetailA", "uDetailB",
        "uBoundsA", "uBoundsB", "uHave", "uOcean", "uGlow", "uAtmosphere", "uLight",
        "uAmbient", "uDiffuse", "uSpecular", "uShininess", "uRim", "uRimPower",
        "uSaturation", "uGlowWidth",
    ];

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error("Globe shader: " + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function buildProgram(gl) {
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error("Globe program: " + gl.getProgramInfoLog(program));
        }
        return program;
    }

    // A real graphics chip only: without one the browser draws WebGL in
    // software, hundreds of times slower than the canvas 2D renderer.
    const CONTEXT_OPTIONS = { alpha: true, antialias: false, premultipliedAlpha: true, failIfMajorPerformanceCaveat: true };
    const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|software|basic render/i;

    function isSoftware(gl) {
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        if (!info) {
            return false;
        }
        return SOFTWARE_RENDERERS.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));
    }

    // Tried on a spare canvas first: once the real canvas has a WebGL
    // context it can never fall back to canvas 2D drawing.
    function supported() {
        try {
            const gl = document.createElement("canvas").getContext("webgl2", CONTEXT_OPTIONS);
            if (!gl || isSoftware(gl)) {
                return false;
            }
            buildProgram(gl);
            const loser = gl.getExtension("WEBGL_lose_context");
            if (loser) {
                loser.loseContext();
            }
            return true;
        } catch (err) {
            console.log("WebGL globe unavailable:", err);
            return false;
        }
    }

    function create(canvas) {
        if (!supported()) {
            return null;
        }
        const gl = canvas.getContext("webgl2", CONTEXT_OPTIONS);
        if (!gl) {
            return null;
        }

        // Pictures by slot ("base", "a", "b"): the image is kept so it can
        // be uploaded again if the browser drops the GPU context.
        const pictures = { base: null, a: null, b: null };
        const textures = {};
        let program = null;
        let uniforms = {};
        // a 1x1 stand-in for picture slots that are still empty
        let blank = null;
        let anisotropy = null;
        let lost = false;
        let onRestored = () => {};

        function setup() {
            program = buildProgram(gl);
            gl.useProgram(program);
            blank = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, blank);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
            uniforms = {};
            UNIFORMS.forEach((name) => {
                uniforms[name] = gl.getUniformLocation(program, name);
            });

            // one triangle big enough to cover the whole canvas
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const position = gl.getAttribLocation(program, "aPosition");
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

            anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
            gl.uniform1i(uniforms.uBase, 0);
            gl.uniform1i(uniforms.uDetailA, 1);
            gl.uniform1i(uniforms.uDetailB, 2);
            Object.keys(pictures).forEach((slot) => {
                textures[slot] = null;
                if (pictures[slot]) {
                    upload(slot);
                }
            });
        }

        function upload(slot) {
            const picture = pictures[slot];
            if (textures[slot]) {
                gl.deleteTexture(textures[slot]);
            }
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, picture.image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            // the world picture wraps around at the date line; close-ups stop at their edges
            let wrapAcross = gl.CLAMP_TO_EDGE;
            if (slot === "base") {
                wrapAcross = gl.REPEAT;
            }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapAcross);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            if (anisotropy) {
                const most = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, most));
            }
            textures[slot] = texture;
        }

        // slot is "base", "a", or "b"; picture is { image, minLon, minLat, maxLon, maxLat }
        function setPicture(slot, picture) {
            pictures[slot] = picture;
            if (!lost) {
                upload(slot);
            }
        }

        function boundsOf(picture) {
            if (!picture) {
                return [-180, -90, 180, 90];
            }
            return [picture.minLon, picture.minLat, picture.maxLon, picture.maxLat];
        }

        // frame: { width, height, cam (from globe.js camera()), look (colors and amounts) }
        function draw(frame) {
            if (lost) {
                return;
            }
            const look = frame.look;
            gl.viewport(0, 0, frame.width, frame.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);
            gl.uniform2f(uniforms.uSize, frame.width, frame.height);
            gl.uniform2f(uniforms.uCenter, frame.cam.cx, frame.cam.cy);
            gl.uniform1f(uniforms.uRadius, frame.cam.radius);
            gl.uniform3f(uniforms.uFacing, frame.cam.sinLat0, frame.cam.cosLat0, frame.cam.lon0 * Math.PI / 180);
            ["base", "a", "b"].forEach((slot, unit) => {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, textures[slot] || blank);
            });
            gl.uniform4fv(uniforms.uBoundsA, boundsOf(pictures.a));
            gl.uniform4fv(uniforms.uBoundsB, boundsOf(pictures.b));
            gl.uniform3f(uniforms.uHave, Number(Boolean(textures.base)), Number(Boolean(textures.a)), Number(Boolean(textures.b)));
            gl.uniform3fv(uniforms.uOcean, look.ocean);
            gl.uniform4fv(uniforms.uGlow, look.glow);
            gl.uniform3fv(uniforms.uAtmosphere, look.atmosphere);
            gl.uniform3fv(uniforms.uLight, look.light);
            gl.uniform1f(uniforms.uAmbient, look.ambient);
            gl.uniform1f(uniforms.uDiffuse, look.diffuse);
            gl.uniform1f(uniforms.uSpecular, look.specular);
            gl.uniform1f(uniforms.uShininess, look.shininess);
            gl.uniform1f(uniforms.uRim, look.rim);
            gl.uniform1f(uniforms.uRimPower, look.rimPower);
            gl.uniform1f(uniforms.uSaturation, look.saturation);
            gl.uniform1f(uniforms.uGlowWidth, look.glowWidth);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        canvas.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            lost = true;
        });
        canvas.addEventListener("webglcontextrestored", () => {
            lost = false;
            setup();
            onRestored();
        });

        setup();

        return {
            draw,
            setPicture,
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            whenRestored(callback) {
                onRestored = callback;
            },
        };
    }

    return { create };
})();
