/* ===================================
   MotionUX - ambient motion, scroll feedback
   and micro-interactions for PRTS Design.
   Exposed as window.MotionUX and re-initialised
   on every SPA page swap via main.js initPage().
   =================================== */
(function () {
    'use strict';

    const lerp = (a, b, t) => a + (b - a) * t;
    const REFERENCE_FRAME_MS = 1000 / 60;
    const MAX_DELTA_MS = 50;
    const frameAlpha = (alphaAt60Hz, deltaFrames) =>
        1 - Math.pow(1 - alphaAt60Hz, deltaFrames);

    const finePointer =
        window.matchMedia &&
        window.matchMedia('(pointer: fine)').matches;

    const EASE_INOUT = 'cubic-bezier(0.7, 0, 0.2, 1)';

    /*
     * ================================================================
     * Orb 连续流体参数
     * ------------------------------------------------
     * 可直接修改下方默认值；也可以在 motion.js 加载前设置：
     *
     * window.ORB_FLUID_CONFIG = {
     *     gravityPerFrame: -0.004,
     *     pointerForce: 0.55
     * };
     *
     * 页面会用你提供的字段覆盖默认值。除特别注明外，涉及时间的
     * 数值均以 60 FPS 的“一帧”为基准。
     * ================================================================
     */
    const ORB_FLUID_CONFIG = Object.assign(
        {
            // 总开关。false 时关闭流体背景，只保留其余背景效果。
            enabled: true,

            // 是否在移动/粗指针设备上关闭模拟。
            disableOnMobile: true,

            // 是否服从系统的“减少动态效果”设置。
            respectReducedMotion: true,

            // 触控设备宽度不超过此值时直接关闭模拟。
            mobileMaxWidth: 1024,

            // GPU 模拟网格：越高越细腻，开销近似按纹理面积增加。
            gridHeight: 32,
            gridMinWidth: 64,
            gridMaxWidth: 128,

            // 流体求解帧率上限；不影响页面和原始 Orb 的渲染 FPS。
            simulationFps: 60,

            // GPU 流体使用浮点纹理；关闭后不绘制流体层。
            preferFloatTexture: true,

            // 启动后的性能检测时长与保留流体所需最低平均 FPS。
            autoDisableOnLowFps: true,
            performanceTestMs: 1500,
            minimumAverageFps: 55,

            // 单帧时间钳制，避免切回页面时模拟一次跨越太远。
            minimumDeltaMs: 4,
            maximumDeltaMs: 40,

            // 速度扩散：越大越黏、更平滑，也越不容易形成细碎涡流。
            velocityViscosity: 0.02,

            // 每帧速度保留率。越接近 1，惯性持续越久。
            velocityDamping: 0.99,

            // 网格坐标中的重力；负值表示向屏幕下方。
            gravityPerFrame: -0.01,

            // 压力投影迭代次数。越高越接近不可压缩流体，但更耗性能。
            projectionIterationsBeforeAdvection: 3,
            projectionIterationsAfterAdvection: 2,

            // 散度与压力梯度系数；通常保持相同，越大投影越强。
            divergenceScale: 0.8,
            pressureGradientScale: 0.8,

            // 平流位移倍率；提高会让流体随速度移动得更远。
            advectionStrength: 1,

            // 每帧密度保留率。越接近 1，流体尾迹停留越久。
            densityDecay: 0.99,

            // Orb 每帧向密度场补充的速度。
            sourceFollow: 0.1,

            // 流体源相对 CSS Orb 透明度的倍率。
            sourceDensityScale: 1,

            // 最终密度纹理的显示倍率，只改变可见度，不改变模拟。
            renderOpacityScale: 1.5,

            // 源的高斯衰减。越大边缘越集中，越小范围越宽。
            sourceProfileFalloff: 8.35,

            // 三个连续流体源的半径，按 viewport 最大边比例计算。
            sourceRadiusScales: [0.34, 0.29, 0.38],

            // 鼠标速度场作用半径，占网格短边的比例。
            pointerRadiusRatio: 0.15,

            // 平滑高斯作用尺度倍率；不会产生有限半径的硬裁切。
            pointerReachMultiplier: 0.8,

            // 鼠标场的高斯衰减范围；越大影响分布越宽。
            pointerFalloffScale: 0.45,

            // 鼠标向速度场注入的力度。
            pointerForce: 0.5,

            // false 时鼠标不再影响速度场，但流体仍会自行运动。
            pointerEnabled: true,

            // 开启后鼠标移动轨迹也会补充流体密度。
            pointerAddsDensity: true,

            // 鼠标补充流体的强度；仅在 pointerAddsDensity 为 true 时生效。
            pointerDensity: 0.001,

            // 单次鼠标位移上限（CSS 像素），防止噪声产生巨大速度。
            pointerMaxDelta: 72,

            // 一帧前最多保留的鼠标输入数量。
            pointerQueueLimit: 8
        },
        window.ORB_FLUID_CONFIG || {}
    );

    window.ORB_FLUID_CONFIG = ORB_FLUID_CONFIG;

    /* ---------- Global ambient loop (runs once) ---------- */
    let ambientStarted = false;
    let orbGLStarted = false;
    let artCols = [];

    function initOrbGL() {
        const layer = document.querySelector('.bg-orbs');

        if (!layer) return false;
        if (orbGLStarted) return true;

        const canvas = document.createElement('canvas');

        canvas.className = 'orb-gl-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        layer.appendChild(canvas);

        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false
        });

        if (!gl) {
            canvas.remove();
            return false;
        }

        const mobileFluidDisabled =
            ORB_FLUID_CONFIG.disableOnMobile &&
            Boolean(
                (
                    window.matchMedia &&
                    window.matchMedia(
                        '(pointer: coarse)'
                    ).matches
                ) ||
                (
                    navigator.maxTouchPoints > 0 &&
                    window.innerWidth <=
                        ORB_FLUID_CONFIG.mobileMaxWidth
                )
            );
        const vertexSource = `
attribute vec2 aPosition;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

        const fragmentSource = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uAccent;
uniform vec3 uOrbAlpha;
uniform sampler2D uOrbFluidMap;
uniform float uOrbFluidEnabled;
uniform float uOrbFluidOpacityScale;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    float fluidAlpha = 0.0;

    if (uOrbFluidEnabled > 0.5) {
        fluidAlpha = texture2D(
            uOrbFluidMap,
            gl_FragCoord.xy / uResolution
        ).r * uOrbFluidOpacityScale;
    }

    /*
     * 三个 Orb 只在流体求解 shader 中作为连续密度源，不再直接显示
     * Gaussian 本体；最终画面完全来自被平流和压力投影后的流体场。
     */
    float alpha = fluidAlpha;

    /*
     * Subtractive triangular dither has zero mean and a maximum amplitude of
     * one RGBA8 step. It is evaluated at physical-pixel coordinates and stays
     * spatially fixed, so it breaks bands without visible grain or shimmer.
     */
    float triangularNoise =
        hash12(gl_FragCoord.xy) -
        hash12(gl_FragCoord.yx + vec2(19.19, 73.73));

    float ditherGate =
        smoothstep(0.0, 0.008, alpha);

    alpha = clamp(
        alpha +
        triangularNoise *
        (1.0 / 255.0) *
        ditherGate,
        0.0,
        1.0
    );

    gl_FragColor = vec4(uAccent * alpha, alpha);
}
`;

        function compile(type, source) {
            const shader = gl.createShader(type);

            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (
                !gl.getShaderParameter(
                    shader,
                    gl.COMPILE_STATUS
                )
            ) {
                console.warn(
                    'Orb shader compile failed:',
                    gl.getShaderInfoLog(shader)
                );

                gl.deleteShader(shader);
                return null;
            }

            return shader;
        }

        const vertexShader =
            compile(gl.VERTEX_SHADER, vertexSource);

        const fragmentShader =
            compile(gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) {
            canvas.remove();
            return false;
        }

        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (
            !gl.getProgramParameter(
                program,
                gl.LINK_STATUS
            )
        ) {
            console.warn(
                'Orb shader link failed:',
                gl.getProgramInfoLog(program)
            );

            canvas.remove();
            return false;
        }

        gl.useProgram(program);

        const buffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1
            ]),
            gl.STATIC_DRAW
        );

        const positionLocation =
            gl.getAttribLocation(
                program,
                'aPosition'
            );

        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(
            positionLocation,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );

        const resolutionLocation =
            gl.getUniformLocation(
                program,
                'uResolution'
            );

        const timeLocation =
            gl.getUniformLocation(
                program,
                'uTime'
            );

        const accentLocation =
            gl.getUniformLocation(
                program,
                'uAccent'
            );

        const alphaLocation =
            gl.getUniformLocation(
                program,
                'uOrbAlpha'
            );

        const orbFluidMapLocation =
            gl.getUniformLocation(
                program,
                'uOrbFluidMap'
            );

        const orbFluidEnabledLocation =
            gl.getUniformLocation(
                program,
                'uOrbFluidEnabled'
            );

        const orbFluidOpacityScaleLocation =
            gl.getUniformLocation(
                program,
                'uOrbFluidOpacityScale'
            );

        let width = 0;
        let height = 0;
        let currentTheme = '';
        let orbAlphaValues = [0, 0, 0];

        function resize() {
            const dpr = Math.min(
                window.devicePixelRatio || 1,
                2
            );
            const rect =
                layer.getBoundingClientRect();

            const nextWidth = Math.max(
                1,
                Math.round(rect.width * dpr)
            );

            const nextHeight = Math.max(
                1,
                Math.round(rect.height * dpr)
            );

            if (
                nextWidth === width &&
                nextHeight === height
            ) {
                return;
            }

            width = nextWidth;
            height = nextHeight;
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
            gl.uniform2f(
                resolutionLocation,
                width,
                height
            );
        }

        function updateTheme() {
            const theme =
                document.documentElement.dataset.theme ||
                'light';

            if (theme === currentTheme) return;
            currentTheme = theme;

            const style =
                getComputedStyle(
                    document.documentElement
                );

            const accent = style
                .getPropertyValue(
                    '--orb-fluid-rgb'
                )
                .split(',')
                .map(value =>
                    Number.parseFloat(value) / 255
                );

            const alpha = [1, 2, 3].map(index =>
                Number.parseFloat(
                    style.getPropertyValue(
                        `--orb-alpha-${index}`
                    )
                )
            );
            orbAlphaValues = alpha.map(value =>
                Number.isFinite(value) ? value : 0
            );

            gl.uniform3f(
                accentLocation,
                accent[0] || 0,
                accent[1] || 0,
                accent[2] || 0
            );

            gl.uniform3f(
                alphaLocation,
                orbAlphaValues[0],
                orbAlphaValues[1],
                orbAlphaValues[2]
            );
        }

        const reducedMotion =
            window.matchMedia &&
            window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches;

        let orbFluidEnabled =
            ORB_FLUID_CONFIG.enabled &&
            !mobileFluidDisabled &&
            (
                !ORB_FLUID_CONFIG
                    .respectReducedMotion ||
                !reducedMotion
            );
        let fluidGridWidth = 0;
        let fluidGridHeight = 0;
        let density = new Float32Array(0);
        let nextDensity = new Float32Array(0);
        let velocityX = new Float32Array(0);
        let velocityY = new Float32Array(0);
        let nextVelocityX = new Float32Array(0);
        let nextVelocityY = new Float32Array(0);
        let divergence = new Float32Array(0);
        let pressure = new Float32Array(0);
        let nextPressure = new Float32Array(0);
        let fluidPixels = new Uint8Array(1);
        let pendingFluidForces = [];
        let lastFluidPointerX = null;
        let lastFluidPointerY = null;
        let lastFluidFrameTime = 0;
        let lastFluidRenderTime = 0;
        let fluidSimulationAccumulator = 0;
        let fluidPerformanceStart = 0;
        let fluidPerformanceFrames = 0;
        let fluidPerformanceChecked = false;

        const fluidTexture = gl.createTexture();
        const floatTextureExtension =
            gl.getExtension('OES_texture_float');
        const floatLinearExtension =
            gl.getExtension(
                'OES_texture_float_linear'
            );
        const floatRenderExtension =
            gl.getExtension(
                'WEBGL_color_buffer_float'
            );
        const useGpuFluid = Boolean(
            ORB_FLUID_CONFIG.preferFloatTexture &&
            floatTextureExtension &&
            floatLinearExtension &&
            floatRenderExtension
        );
        const useFloatFluidTexture = useGpuFluid;
        const fluidTextureType =
            useFloatFluidTexture
                ? gl.FLOAT
                : gl.UNSIGNED_BYTE;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fluidTexture);
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR
        );
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            gl.LINEAR
        );
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_S,
            gl.CLAMP_TO_EDGE
        );
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_T,
            gl.CLAMP_TO_EDGE
        );
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            1,
            1,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            fluidPixels
        );
        gl.uniform1i(orbFluidMapLocation, 0);

        /*
         * GPU 后端的数据布局：
         * state.r = 密度，state.g = X 速度，state.b = Y 速度；
         * pressure.r = 压力，pressure.g = 散度。
         * 所有平流、扩散和压力投影都在小尺寸浮点 framebuffer 上完成，
         * CPU 只传入参数与最多 8 个鼠标速度脉冲。
         */
        const gpuFluidVertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
        const gpuFluidAdvectSource = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uTime;
uniform float uFrameScale;
uniform float uViscosity;
uniform float uVelocityDamping;
uniform float uGravity;
uniform float uAdvectionStrength;
uniform float uDensityDecay;
uniform float uSourceFollow;
uniform float uSourceDensityScale;
uniform float uSourceProfileFalloff;
uniform vec3 uSourceRadii;
uniform vec3 uOrbAlpha;
uniform float uPointerRadius;
uniform float uPointerFalloffScale;
uniform float uPointerReachMultiplier;
uniform float uPointerForce;
uniform float uPointerVelocityEnabled;
uniform float uPointerAddsDensity;
uniform float uPointerDensity;
uniform float uPointerCount;
uniform vec4 uPointers[8];

float sourceProfile(
    vec2 screenUv,
    vec2 center,
    float radius
) {
    vec2 delta =
        (screenUv - center) * uResolution;
    float distanceToCenter =
        length(delta) /
        (max(uResolution.x, uResolution.y) * radius);

    return exp2(
        -uSourceProfileFalloff *
        distanceToCenter *
        distanceToCenter
    );
}

void main() {
    vec4 state = texture2D(uState, vUv);
    vec2 velocity = state.gb;
    vec2 sourceUv = clamp(
        vUv -
        velocity *
        uTexel *
        uFrameScale *
        uAdvectionStrength,
        uTexel * 0.5,
        vec2(1.0) - uTexel * 0.5
    );
    vec4 advected = texture2D(uState, sourceUv);
    vec2 neighbourVelocity =
        (
            texture2D(uState, vUv - vec2(uTexel.x, 0.0)).gb +
            texture2D(uState, vUv + vec2(uTexel.x, 0.0)).gb +
            texture2D(uState, vUv - vec2(0.0, uTexel.y)).gb +
            texture2D(uState, vUv + vec2(0.0, uTexel.y)).gb
        ) * 0.25;

    velocity = mix(
        advected.gb,
        neighbourVelocity,
        uViscosity
    );
    velocity.y += uGravity;
    float pointerDensity = 0.0;
    vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);

    for (int pointerIndex = 0; pointerIndex < 8; pointerIndex++) {
        if (float(pointerIndex) >= uPointerCount) {
            break;
        }

        vec4 pointer = uPointers[pointerIndex];
        vec2 gridDelta =
            (vUv - pointer.xy) / uTexel;
        float distanceSq = dot(gridDelta, gridDelta);
        float radiusSq =
            uPointerRadius * uPointerRadius;

        float reach = max(
            uPointerReachMultiplier,
            0.001
        );
        float effectiveRadiusSq =
            radiusSq * reach * reach;
        float influence = exp(
            -distanceSq /
            max(
                effectiveRadiusSq *
                uPointerFalloffScale,
                0.001
            )
        );

        velocity +=
            pointer.zw *
            influence *
            uPointerForce *
            uPointerVelocityEnabled;
        pointerDensity = max(
            pointerDensity,
            influence *
            uPointerDensity *
            uPointerAddsDensity
        );
    }

    velocity *= uVelocityDamping;

    vec2 center1 =
        vec2(0.15, 0.19) +
        vec2(
            sin(uTime * 0.071 + 0.7) * 0.13,
            cos(uTime * 0.093 + 1.1) * 0.11
        );
    vec2 center2 =
        vec2(0.88, 0.43) +
        vec2(
            cos(uTime * 0.083 + 2.4) * 0.12,
            sin(uTime * 0.107 + 0.2) * 0.13
        );
    vec2 center3 =
        vec2(0.40, 0.88) +
        vec2(
            sin(uTime * 0.063 + 4.0) * 0.15,
            cos(uTime * 0.079 + 2.8) * 0.10
        );
    float sourceDensity = max(
        sourceProfile(
            screenUv,
            center1,
            uSourceRadii.x
        ) * uOrbAlpha.x,
        max(
            sourceProfile(
                screenUv,
                center2,
                uSourceRadii.y
            ) * uOrbAlpha.y,
            sourceProfile(
                screenUv,
                center3,
                uSourceRadii.z
            ) * uOrbAlpha.z
        )
    ) * uSourceDensityScale;
    float density = mix(
        advected.r * uDensityDecay,
        sourceDensity,
        uSourceFollow
    );
    density = clamp(
        density + pointerDensity,
        0.0,
        1.0
    );
    float edge =
        step(uTexel.x, vUv.x) *
        step(uTexel.y, vUv.y) *
        step(vUv.x, 1.0 - uTexel.x) *
        step(vUv.y, 1.0 - uTexel.y);

    gl_FragColor = vec4(
        clamp(density, 0.0, 1.0),
        velocity * edge,
        1.0
    );
}
`;
        const gpuFluidDivergenceSource = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uDivergenceScale;

void main() {
    float left =
        texture2D(
            uState,
            vUv - vec2(uTexel.x, 0.0)
        ).g;
    float right =
        texture2D(
            uState,
            vUv + vec2(uTexel.x, 0.0)
        ).g;
    float bottom =
        texture2D(
            uState,
            vUv - vec2(0.0, uTexel.y)
        ).b;
    float top =
        texture2D(
            uState,
            vUv + vec2(0.0, uTexel.y)
        ).b;
    float divergence =
        -uDivergenceScale *
        (right - left + top - bottom);

    gl_FragColor = vec4(0.0, divergence, 0.0, 1.0);
}
`;
        const gpuFluidPressureSource = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uPressure;
uniform vec2 uTexel;

void main() {
    vec4 field = texture2D(uPressure, vUv);
    float pressure =
        (
            field.g +
            texture2D(
                uPressure,
                vUv - vec2(uTexel.x, 0.0)
            ).r +
            texture2D(
                uPressure,
                vUv + vec2(uTexel.x, 0.0)
            ).r +
            texture2D(
                uPressure,
                vUv - vec2(0.0, uTexel.y)
            ).r +
            texture2D(
                uPressure,
                vUv + vec2(0.0, uTexel.y)
            ).r
        ) * 0.25;

    gl_FragColor = vec4(
        pressure,
        field.g,
        0.0,
        1.0
    );
}
`;
        const gpuFluidProjectSource = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uState;
uniform sampler2D uPressure;
uniform vec2 uTexel;
uniform float uPressureGradientScale;

void main() {
    vec4 state = texture2D(uState, vUv);
    float left =
        texture2D(
            uPressure,
            vUv - vec2(uTexel.x, 0.0)
        ).r;
    float right =
        texture2D(
            uPressure,
            vUv + vec2(uTexel.x, 0.0)
        ).r;
    float bottom =
        texture2D(
            uPressure,
            vUv - vec2(0.0, uTexel.y)
        ).r;
    float top =
        texture2D(
            uPressure,
            vUv + vec2(0.0, uTexel.y)
        ).r;
    vec2 velocity =
        state.gb -
        uPressureGradientScale *
        vec2(right - left, top - bottom);

    gl_FragColor = vec4(
        state.r,
        velocity,
        1.0
    );
}
`;

        function linkGpuFluidProgram(source) {
            const vertex = compile(
                gl.VERTEX_SHADER,
                gpuFluidVertexSource
            );
            const fragment = compile(
                gl.FRAGMENT_SHADER,
                source
            );

            if (!vertex || !fragment) return null;

            const fluidProgram = gl.createProgram();
            gl.attachShader(fluidProgram, vertex);
            gl.attachShader(fluidProgram, fragment);
            gl.linkProgram(fluidProgram);

            if (
                !gl.getProgramParameter(
                    fluidProgram,
                    gl.LINK_STATUS
                )
            ) {
                console.warn(
                    'Orb fluid shader link failed:',
                    gl.getProgramInfoLog(fluidProgram)
                );
                return null;
            }

            return fluidProgram;
        }

        const gpuFluidPrograms = useGpuFluid
            ? {
                advect: linkGpuFluidProgram(
                    gpuFluidAdvectSource
                ),
                divergence: linkGpuFluidProgram(
                    gpuFluidDivergenceSource
                ),
                pressure: linkGpuFluidProgram(
                    gpuFluidPressureSource
                ),
                project: linkGpuFluidProgram(
                    gpuFluidProjectSource
                )
            }
            : null;
        const gpuProgramsReady = Boolean(
            gpuFluidPrograms &&
            gpuFluidPrograms.advect &&
            gpuFluidPrograms.divergence &&
            gpuFluidPrograms.pressure &&
            gpuFluidPrograms.project
        );
        const gpuStateTextures = [
            fluidTexture,
            gl.createTexture()
        ];
        const gpuStateFramebuffers = [
            gl.createFramebuffer(),
            gl.createFramebuffer()
        ];
        const gpuPressureTextures = [
            gl.createTexture(),
            gl.createTexture()
        ];
        const gpuPressureFramebuffers = [
            gl.createFramebuffer(),
            gl.createFramebuffer()
        ];
        const gpuPointerData = new Float32Array(8 * 4);
        let gpuStateReadIndex = 0;
        let gpuPressureReadIndex = 0;

        orbFluidEnabled =
            orbFluidEnabled &&
            useGpuFluid &&
            gpuProgramsReady;

        if (orbFluidEnabled) {
            layer.dataset.orbFluidBackend = 'gpu';
        }

        if (!orbFluidEnabled) {
            layer.dataset.orbFluid =
                !ORB_FLUID_CONFIG.enabled
                    ? 'config-disabled'
                    : mobileFluidDisabled
                        ? 'mobile-disabled'
                        : (
                            ORB_FLUID_CONFIG
                                .respectReducedMotion &&
                            reducedMotion
                        )
                            ? 'reduced-motion-disabled'
                            : 'gpu-unsupported';
        }

        function disableOrbFluid(reason) {
            if (!orbFluidEnabled) return;

            orbFluidEnabled = false;
            density = new Float32Array(0);
            nextDensity = new Float32Array(0);
            velocityX = new Float32Array(0);
            velocityY = new Float32Array(0);
            nextVelocityX = new Float32Array(0);
            nextVelocityY = new Float32Array(0);
            pendingFluidForces.length = 0;
            gl.uniform1f(
                orbFluidEnabledLocation,
                0
            );
            layer.dataset.orbFluid = 'disabled';

            console.info(
                `[OrbFluid] disabled: ${reason}`
            );
        }

        function configureGpuFluidTexture(
            texture,
            framebuffer,
            filter
        ) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MIN_FILTER,
                filter
            );
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MAG_FILTER,
                filter
            );
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_S,
                gl.CLAMP_TO_EDGE
            );
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_T,
                gl.CLAMP_TO_EDGE
            );
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                fluidGridWidth,
                fluidGridHeight,
                0,
                gl.RGBA,
                gl.FLOAT,
                null
            );
            gl.bindFramebuffer(
                gl.FRAMEBUFFER,
                framebuffer
            );
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                texture,
                0
            );

            const complete =
                gl.checkFramebufferStatus(
                    gl.FRAMEBUFFER
                ) === gl.FRAMEBUFFER_COMPLETE;

            if (complete) {
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }

            return complete;
        }

        function bindGpuFluidProgram(fluidProgram) {
            gl.useProgram(fluidProgram);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

            const fluidPositionLocation =
                gl.getAttribLocation(
                    fluidProgram,
                    'aPosition'
                );

            gl.enableVertexAttribArray(
                fluidPositionLocation
            );
            gl.vertexAttribPointer(
                fluidPositionLocation,
                2,
                gl.FLOAT,
                false,
                0,
                0
            );
        }

        function bindGpuTexture(
            fluidProgram,
            uniformName,
            texture,
            textureUnit
        ) {
            gl.activeTexture(
                gl.TEXTURE0 + textureUnit
            );
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(
                gl.getUniformLocation(
                    fluidProgram,
                    uniformName
                ),
                textureUnit
            );
        }

        function drawGpuFluidPass(
            fluidProgram,
            framebuffer
        ) {
            gl.bindFramebuffer(
                gl.FRAMEBUFFER,
                framebuffer
            );
            gl.viewport(
                0,
                0,
                fluidGridWidth,
                fluidGridHeight
            );
            bindGpuFluidProgram(fluidProgram);
        }

        function finishGpuFluidPass() {
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        function swapGpuState() {
            gpuStateReadIndex = 1 - gpuStateReadIndex;
        }

        function projectGpuFluid(iterations) {
            const texelX = 1 / fluidGridWidth;
            const texelY = 1 / fluidGridHeight;
            const divergenceProgram =
                gpuFluidPrograms.divergence;

            drawGpuFluidPass(
                divergenceProgram,
                gpuPressureFramebuffers[0]
            );
            bindGpuTexture(
                divergenceProgram,
                'uState',
                gpuStateTextures[gpuStateReadIndex],
                0
            );
            gl.uniform2f(
                gl.getUniformLocation(
                    divergenceProgram,
                    'uTexel'
                ),
                texelX,
                texelY
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    divergenceProgram,
                    'uDivergenceScale'
                ),
                ORB_FLUID_CONFIG.divergenceScale
            );
            finishGpuFluidPass();
            gpuPressureReadIndex = 0;

            const pressureProgram =
                gpuFluidPrograms.pressure;
            const pressureIterations = Math.max(
                0,
                Math.round(iterations)
            );

            for (
                let iteration = 0;
                iteration < pressureIterations;
                iteration++
            ) {
                const writeIndex =
                    1 - gpuPressureReadIndex;

                drawGpuFluidPass(
                    pressureProgram,
                    gpuPressureFramebuffers[
                        writeIndex
                    ]
                );
                bindGpuTexture(
                    pressureProgram,
                    'uPressure',
                    gpuPressureTextures[
                        gpuPressureReadIndex
                    ],
                    0
                );
                gl.uniform2f(
                    gl.getUniformLocation(
                        pressureProgram,
                        'uTexel'
                    ),
                    texelX,
                    texelY
                );
                finishGpuFluidPass();
                gpuPressureReadIndex = writeIndex;
            }

            const projectProgram =
                gpuFluidPrograms.project;
            const stateWriteIndex =
                1 - gpuStateReadIndex;

            drawGpuFluidPass(
                projectProgram,
                gpuStateFramebuffers[
                    stateWriteIndex
                ]
            );
            bindGpuTexture(
                projectProgram,
                'uState',
                gpuStateTextures[gpuStateReadIndex],
                0
            );
            bindGpuTexture(
                projectProgram,
                'uPressure',
                gpuPressureTextures[
                    gpuPressureReadIndex
                ],
                1
            );
            gl.uniform2f(
                gl.getUniformLocation(
                    projectProgram,
                    'uTexel'
                ),
                texelX,
                texelY
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    projectProgram,
                    'uPressureGradientScale'
                ),
                ORB_FLUID_CONFIG
                    .pressureGradientScale
            );
            finishGpuFluidPass();
            swapGpuState();
        }

        function advectGpuFluid(time, frameScale) {
            const advectProgram =
                gpuFluidPrograms.advect;
            const stateWriteIndex =
                1 - gpuStateReadIndex;
            const pointerCount =
                (
                    ORB_FLUID_CONFIG.pointerEnabled ||
                    ORB_FLUID_CONFIG.pointerAddsDensity
                )
                    ? Math.min(
                        pendingFluidForces.length,
                        8
                    )
                    : 0;
            gpuPointerData.fill(0);

            for (
                let pointerIndex = 0;
                pointerIndex < pointerCount;
                pointerIndex++
            ) {
                const force =
                    pendingFluidForces[pointerIndex];
                const offset = pointerIndex * 4;
                gpuPointerData[offset] = force.x;
                gpuPointerData[offset + 1] = force.y;
                gpuPointerData[offset + 2] = force.vx;
                gpuPointerData[offset + 3] = force.vy;
            }

            pendingFluidForces.length = 0;

            drawGpuFluidPass(
                advectProgram,
                gpuStateFramebuffers[
                    stateWriteIndex
                ]
            );
            bindGpuTexture(
                advectProgram,
                'uState',
                gpuStateTextures[gpuStateReadIndex],
                0
            );
            gl.uniform2f(
                gl.getUniformLocation(
                    advectProgram,
                    'uTexel'
                ),
                1 / fluidGridWidth,
                1 / fluidGridHeight
            );
            gl.uniform2f(
                gl.getUniformLocation(
                    advectProgram,
                    'uResolution'
                ),
                width,
                height
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uTime'
                ),
                time
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uFrameScale'
                ),
                frameScale
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uViscosity'
                ),
                frameAlpha(
                    ORB_FLUID_CONFIG
                        .velocityViscosity,
                    frameScale
                )
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uVelocityDamping'
                ),
                Math.pow(
                    ORB_FLUID_CONFIG
                        .velocityDamping,
                    frameScale
                )
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uGravity'
                ),
                ORB_FLUID_CONFIG
                    .gravityPerFrame *
                    frameScale
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uAdvectionStrength'
                ),
                ORB_FLUID_CONFIG
                    .advectionStrength
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uDensityDecay'
                ),
                Math.pow(
                    ORB_FLUID_CONFIG.densityDecay,
                    frameScale
                )
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uSourceFollow'
                ),
                frameAlpha(
                    ORB_FLUID_CONFIG.sourceFollow,
                    frameScale
                )
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uSourceDensityScale'
                ),
                ORB_FLUID_CONFIG
                    .sourceDensityScale
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uSourceProfileFalloff'
                ),
                ORB_FLUID_CONFIG
                    .sourceProfileFalloff
            );
            gl.uniform3f(
                gl.getUniformLocation(
                    advectProgram,
                    'uSourceRadii'
                ),
                ORB_FLUID_CONFIG
                    .sourceRadiusScales[0],
                ORB_FLUID_CONFIG
                    .sourceRadiusScales[1],
                ORB_FLUID_CONFIG
                    .sourceRadiusScales[2]
            );
            gl.uniform3f(
                gl.getUniformLocation(
                    advectProgram,
                    'uOrbAlpha'
                ),
                orbAlphaValues[0],
                orbAlphaValues[1],
                orbAlphaValues[2]
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerRadius'
                ),
                Math.min(
                    fluidGridWidth,
                    fluidGridHeight
                ) *
                ORB_FLUID_CONFIG.pointerRadiusRatio
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerFalloffScale'
                ),
                ORB_FLUID_CONFIG
                    .pointerFalloffScale
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerReachMultiplier'
                ),
                ORB_FLUID_CONFIG
                    .pointerReachMultiplier
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerForce'
                ),
                ORB_FLUID_CONFIG.pointerForce
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerVelocityEnabled'
                ),
                ORB_FLUID_CONFIG.pointerEnabled
                    ? 1
                    : 0
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerAddsDensity'
                ),
                ORB_FLUID_CONFIG
                    .pointerAddsDensity
                    ? 1
                    : 0
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerDensity'
                ),
                Math.max(
                    0,
                    ORB_FLUID_CONFIG.pointerDensity
                )
            );
            gl.uniform1f(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointerCount'
                ),
                pointerCount
            );
            gl.uniform4fv(
                gl.getUniformLocation(
                    advectProgram,
                    'uPointers[0]'
                ),
                gpuPointerData
            );
            finishGpuFluidPass();
            swapGpuState();
        }

        function stepGpuFluid(time, frameScale) {
            projectGpuFluid(
                ORB_FLUID_CONFIG
                    .projectionIterationsBeforeAdvection
            );
            advectGpuFluid(time, frameScale);
            projectGpuFluid(
                ORB_FLUID_CONFIG
                    .projectionIterationsAfterAdvection
            );
        }

        function restoreOrbRenderTarget() {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(
                positionLocation,
                2,
                gl.FLOAT,
                false,
                0,
                0
            );
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(
                gl.TEXTURE_2D,
                gpuStateTextures[gpuStateReadIndex]
            );
        }

        function resetOrbFluidField() {
            if (!orbFluidEnabled) return;

            fluidGridHeight =
                ORB_FLUID_CONFIG.gridHeight;
            fluidGridWidth = Math.max(
                ORB_FLUID_CONFIG.gridMinWidth,
                Math.min(
                    ORB_FLUID_CONFIG.gridMaxWidth,
                    Math.round(
                        fluidGridHeight *
                        width /
                        Math.max(height, 1)
                    )
                )
            );

            if (useGpuFluid) {
                gpuStateReadIndex = 0;
                gpuPressureReadIndex = 0;

                const targetsComplete = [
                    configureGpuFluidTexture(
                        gpuStateTextures[0],
                        gpuStateFramebuffers[0],
                        gl.LINEAR
                    ),
                    configureGpuFluidTexture(
                        gpuStateTextures[1],
                        gpuStateFramebuffers[1],
                        gl.LINEAR
                    ),
                    configureGpuFluidTexture(
                        gpuPressureTextures[0],
                        gpuPressureFramebuffers[0],
                        gl.NEAREST
                    ),
                    configureGpuFluidTexture(
                        gpuPressureTextures[1],
                        gpuPressureFramebuffers[1],
                        gl.NEAREST
                    )
                ].every(Boolean);

                restoreOrbRenderTarget();

                if (!targetsComplete) {
                    disableOrbFluid(
                        'incomplete GPU framebuffer'
                    );
                }

                return;
            }

            const cellCount =
                fluidGridWidth *
                fluidGridHeight;

            density = new Float32Array(cellCount);
            nextDensity =
                new Float32Array(cellCount);
            velocityX =
                new Float32Array(cellCount);
            velocityY =
                new Float32Array(cellCount);
            nextVelocityX =
                new Float32Array(cellCount);
            nextVelocityY =
                new Float32Array(cellCount);
            divergence =
                new Float32Array(cellCount);
            pressure =
                new Float32Array(cellCount);
            nextPressure =
                new Float32Array(cellCount);
            fluidPixels = useFloatFluidTexture
                ? new Float32Array(cellCount)
                : new Uint8Array(cellCount);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(
                gl.TEXTURE_2D,
                fluidTexture
            );
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.LUMINANCE,
                fluidGridWidth,
                fluidGridHeight,
                0,
                gl.LUMINANCE,
                fluidTextureType,
                fluidPixels
            );
        }

        function sampleFluidField(field, x, y) {
            const clampedX = clamp(
                x,
                0.5,
                fluidGridWidth - 1.5
            );
            const clampedY = clamp(
                y,
                0.5,
                fluidGridHeight - 1.5
            );
            const x0 = Math.floor(clampedX);
            const y0 = Math.floor(clampedY);
            const x1 = x0 + 1;
            const y1 = y0 + 1;
            const tx = clampedX - x0;
            const ty = clampedY - y0;
            const row0 = y0 * fluidGridWidth;
            const row1 = y1 * fluidGridWidth;
            const top = lerp(
                field[row0 + x0],
                field[row0 + x1],
                tx
            );
            const bottom = lerp(
                field[row1 + x0],
                field[row1 + x1],
                tx
            );

            return lerp(top, bottom, ty);
        }

        function projectVelocity(iterations) {
            const w = fluidGridWidth;
            const h = fluidGridHeight;

            pressure.fill(0);

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const index = y * w + x;

                    divergence[index] =
                        -ORB_FLUID_CONFIG
                            .divergenceScale *
                        (
                        velocityX[index + 1] -
                        velocityX[index - 1] +
                        velocityY[index + w] -
                        velocityY[index - w]
                        );
                }
            }

            for (
                let iteration = 0;
                iteration < iterations;
                iteration++
            ) {
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const index = y * w + x;

                        nextPressure[index] =
                            (
                                divergence[index] +
                                pressure[index - 1] +
                                pressure[index + 1] +
                                pressure[index - w] +
                                pressure[index + w]
                            ) * 0.25;
                    }
                }

                const oldPressure = pressure;
                pressure = nextPressure;
                nextPressure = oldPressure;
                nextPressure.fill(0);
            }

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const index = y * w + x;

                    velocityX[index] -=
                        ORB_FLUID_CONFIG
                            .pressureGradientScale *
                        (
                            pressure[index + 1] -
                            pressure[index - 1]
                        );
                    velocityY[index] -=
                        ORB_FLUID_CONFIG
                            .pressureGradientScale *
                        (
                            pressure[index + w] -
                            pressure[index - w]
                        );
                }
            }
        }

        function applyOrbSources(
            time,
            frameScale
        ) {
            const centers = [
                {
                    x:
                        0.15 +
                        Math.sin(
                            time * 0.071 + 0.7
                        ) * 0.13,
                    y:
                        0.19 +
                        Math.cos(
                            time * 0.093 + 1.1
                        ) * 0.11,
                    radius:
                        ORB_FLUID_CONFIG
                            .sourceRadiusScales[0],
                    alpha: orbAlphaValues[0]
                },
                {
                    x:
                        0.88 +
                        Math.cos(
                            time * 0.083 + 2.4
                        ) * 0.12,
                    y:
                        0.43 +
                        Math.sin(
                            time * 0.107 + 0.2
                        ) * 0.13,
                    radius:
                        ORB_FLUID_CONFIG
                            .sourceRadiusScales[1],
                    alpha: orbAlphaValues[1]
                },
                {
                    x:
                        0.40 +
                        Math.sin(
                            time * 0.063 + 4.0
                        ) * 0.15,
                    y:
                        0.88 +
                        Math.cos(
                            time * 0.079 + 2.8
                        ) * 0.10,
                    radius:
                        ORB_FLUID_CONFIG
                            .sourceRadiusScales[2],
                    alpha: orbAlphaValues[2]
                }
            ];
            const viewportMax = Math.max(
                width,
                height
            );
            const sourceFollow = frameAlpha(
                ORB_FLUID_CONFIG.sourceFollow,
                frameScale
            );

            for (
                let y = 1;
                y < fluidGridHeight - 1;
                y++
            ) {
                const normalizedY =
                    1 -
                    y /
                    (fluidGridHeight - 1);

                for (
                    let x = 1;
                    x < fluidGridWidth - 1;
                    x++
                ) {
                    const normalizedX =
                        x /
                        (fluidGridWidth - 1);
                    const index =
                        y * fluidGridWidth + x;
                    let sourceDensity = 0;

                    for (
                        let sourceIndex = 0;
                        sourceIndex < 3;
                        sourceIndex++
                    ) {
                        const source =
                            centers[sourceIndex];
                        const dx =
                            (
                                normalizedX -
                                source.x
                            ) * width;
                        const dy =
                            (
                                normalizedY -
                                source.y
                            ) * height;
                        const distance =
                            Math.hypot(dx, dy) /
                            (
                                viewportMax *
                                source.radius
                            );
                        const profile = Math.pow(
                            2,
                            -ORB_FLUID_CONFIG
                                .sourceProfileFalloff *
                            distance *
                            distance
                        );

                        sourceDensity = Math.max(
                            sourceDensity,
                            profile *
                            source.alpha *
                            ORB_FLUID_CONFIG
                                .sourceDensityScale
                        );
                    }

                    density[index] +=
                        (
                            sourceDensity -
                            density[index]
                        ) *
                        sourceFollow;
                }
            }
        }

        function applyPointerForces() {
            if (!ORB_FLUID_CONFIG.pointerEnabled) {
                pendingFluidForces.length = 0;
                return;
            }

            const w = fluidGridWidth;
            const h = fluidGridHeight;
            const radius =
                Math.min(w, h) *
                ORB_FLUID_CONFIG
                    .pointerRadiusRatio;
            const radiusSq = radius * radius;

            pendingFluidForces.forEach(force => {
                const centerX =
                    force.x * (w - 1);
                const centerY =
                    force.y * (h - 1);
                const reach = Math.ceil(
                    radius *
                    ORB_FLUID_CONFIG
                        .pointerReachMultiplier
                );
                const minX = Math.max(
                    1,
                    Math.floor(centerX - reach)
                );
                const maxX = Math.min(
                    w - 2,
                    Math.ceil(centerX + reach)
                );
                const minY = Math.max(
                    1,
                    Math.floor(centerY - reach)
                );
                const maxY = Math.min(
                    h - 2,
                    Math.ceil(centerY + reach)
                );

                for (
                    let y = minY;
                    y <= maxY;
                    y++
                ) {
                    for (
                        let x = minX;
                        x <= maxX;
                        x++
                    ) {
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distanceSq =
                            dx * dx + dy * dy;

                        if (
                            distanceSq >
                            radiusSq *
                            ORB_FLUID_CONFIG
                                .pointerReachMultiplier *
                            ORB_FLUID_CONFIG
                                .pointerReachMultiplier
                        ) {
                            continue;
                        }

                        const influence = Math.exp(
                            -distanceSq /
                            Math.max(
                                radiusSq *
                                    ORB_FLUID_CONFIG
                                        .pointerFalloffScale,
                                0.001
                            )
                        );
                        const index = y * w + x;

                        velocityX[index] +=
                            force.vx *
                            influence *
                            ORB_FLUID_CONFIG
                                .pointerForce;
                        velocityY[index] +=
                            force.vy *
                            influence *
                            ORB_FLUID_CONFIG
                                .pointerForce;
                    }
                }
            });

            pendingFluidForces.length = 0;
        }

        function stepOrbFluid(
            time,
            frameScale
        ) {
            if (useGpuFluid) {
                stepGpuFluid(time, frameScale);
                return;
            }

            const w = fluidGridWidth;
            const h = fluidGridHeight;
            const viscosity = frameAlpha(
                ORB_FLUID_CONFIG
                    .velocityViscosity,
                frameScale
            );
            const velocityDamping = Math.pow(
                ORB_FLUID_CONFIG
                    .velocityDamping,
                frameScale
            );
            const gravity =
                ORB_FLUID_CONFIG
                    .gravityPerFrame *
                frameScale;

            applyPointerForces();

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const index = y * w + x;
                    const neighbourVelocityX =
                        (
                            velocityX[index - 1] +
                            velocityX[index + 1] +
                            velocityX[index - w] +
                            velocityX[index + w]
                        ) * 0.25;
                    const neighbourVelocityY =
                        (
                            velocityY[index - 1] +
                            velocityY[index + 1] +
                            velocityY[index - w] +
                            velocityY[index + w]
                        ) * 0.25;

                    nextVelocityX[index] =
                        lerp(
                            velocityX[index],
                            neighbourVelocityX,
                            viscosity
                        ) * velocityDamping;
                    nextVelocityY[index] =
                        (
                            lerp(
                                velocityY[index],
                                neighbourVelocityY,
                                viscosity
                            ) +
                            gravity
                        ) * velocityDamping;
                }
            }

            let oldField = velocityX;
            velocityX = nextVelocityX;
            nextVelocityX = oldField;
            nextVelocityX.fill(0);
            oldField = velocityY;
            velocityY = nextVelocityY;
            nextVelocityY = oldField;
            nextVelocityY.fill(0);

            projectVelocity(
                ORB_FLUID_CONFIG
                    .projectionIterationsBeforeAdvection
            );

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const index = y * w + x;
                    const sourceX =
                        x -
                        velocityX[index] *
                        frameScale *
                        ORB_FLUID_CONFIG
                            .advectionStrength;
                    const sourceY =
                        y -
                        velocityY[index] *
                        frameScale *
                        ORB_FLUID_CONFIG
                            .advectionStrength;

                    nextVelocityX[index] =
                        sampleFluidField(
                            velocityX,
                            sourceX,
                            sourceY
                        );
                    nextVelocityY[index] =
                        sampleFluidField(
                            velocityY,
                            sourceX,
                            sourceY
                        );
                }
            }

            oldField = velocityX;
            velocityX = nextVelocityX;
            nextVelocityX = oldField;
            nextVelocityX.fill(0);
            oldField = velocityY;
            velocityY = nextVelocityY;
            nextVelocityY = oldField;
            nextVelocityY.fill(0);

            projectVelocity(
                ORB_FLUID_CONFIG
                    .projectionIterationsAfterAdvection
            );

            const densityDecay = Math.pow(
                ORB_FLUID_CONFIG.densityDecay,
                frameScale
            );

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const index = y * w + x;
                    const sourceX =
                        x -
                        velocityX[index] *
                        frameScale *
                        ORB_FLUID_CONFIG
                            .advectionStrength;
                    const sourceY =
                        y -
                        velocityY[index] *
                        frameScale *
                        ORB_FLUID_CONFIG
                            .advectionStrength;

                    nextDensity[index] =
                        sampleFluidField(
                            density,
                            sourceX,
                            sourceY
                        ) *
                        densityDecay;
                }
            }

            oldField = density;
            density = nextDensity;
            nextDensity = oldField;
            nextDensity.fill(0);

            applyOrbSources(time, frameScale);
        }

        function uploadOrbFluid() {
            if (useGpuFluid) {
                restoreOrbRenderTarget();
                return;
            }

            for (
                let index = 0;
                index < density.length;
                index++
            ) {
                const value = clamp(
                    density[index],
                    0,
                    1
                );

                fluidPixels[index] =
                    useFloatFluidTexture
                        ? value
                        : Math.round(value * 255);
            }

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(
                gl.TEXTURE_2D,
                fluidTexture
            );
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                0,
                fluidGridWidth,
                fluidGridHeight,
                gl.LUMINANCE,
                fluidTextureType,
                fluidPixels
            );
        }

        function updateOrbFluid(now) {
            if (!orbFluidEnabled || !width || !height) {
                gl.uniform1f(
                    orbFluidEnabledLocation,
                    0
                );
                return;
            }

            const expectedHeight =
                ORB_FLUID_CONFIG.gridHeight;
            const expectedWidth = Math.max(
                ORB_FLUID_CONFIG.gridMinWidth,
                Math.min(
                    ORB_FLUID_CONFIG.gridMaxWidth,
                    Math.round(
                        expectedHeight *
                        width /
                        Math.max(height, 1)
                    )
                )
            );

            if (
                fluidGridWidth !== expectedWidth ||
                fluidGridHeight !== expectedHeight
            ) {
                resetOrbFluidField();
            }

            if (!lastFluidFrameTime) {
                lastFluidFrameTime = now;
                lastFluidRenderTime = now;
                fluidPerformanceStart = now;
                layer.dataset.orbFluid =
                    ORB_FLUID_CONFIG
                        .autoDisableOnLowFps
                        ? 'testing'
                        : 'enabled';
            }

            const renderDelta =
                now - lastFluidRenderTime;
            lastFluidRenderTime = now;
            fluidSimulationAccumulator +=
                Math.max(renderDelta, 0);
            fluidPerformanceFrames++;

            gl.uniform1f(
                orbFluidEnabledLocation,
                1
            );
            gl.uniform1f(
                orbFluidOpacityScaleLocation,
                Math.max(
                    0,
                    ORB_FLUID_CONFIG
                        .renderOpacityScale
                )
            );

            if (
                ORB_FLUID_CONFIG
                    .autoDisableOnLowFps &&
                !fluidPerformanceChecked &&
                now - fluidPerformanceStart >=
                    ORB_FLUID_CONFIG
                        .performanceTestMs
            ) {
                fluidPerformanceChecked = true;

                const averageFps =
                    fluidPerformanceFrames *
                    1000 /
                    Math.max(
                        now - fluidPerformanceStart,
                        1
                    );

                if (
                    averageFps <
                    ORB_FLUID_CONFIG
                        .minimumAverageFps
                ) {
                    disableOrbFluid(
                        `average ${averageFps.toFixed(1)} FPS`
                    );
                    return;
                }

                layer.dataset.orbFluid = 'enabled';
            }

            const simulationFps = clamp(
                Number(
                    ORB_FLUID_CONFIG.simulationFps
                ) || 60,
                1,
                240
            );
            const simulationInterval =
                1000 / simulationFps;
            fluidSimulationAccumulator = Math.min(
                fluidSimulationAccumulator,
                simulationInterval * 2
            );

            /*
             * 只限制流体求解频率；Orb shader 仍随页面 RAF 每帧绘制。
             * 5% 容差用于吸收 60 Hz 下约 0.5 ms 的调度抖动，避免
             * 设为 60 时因 16.2/16.7 ms 波动意外退化成 30 FPS。
             */
            if (
                fluidSimulationAccumulator +
                    simulationInterval * 0.05 <
                simulationInterval
            ) {
                return;
            }

            const deltaMs = Math.min(
                Math.max(
                    now - lastFluidFrameTime,
                    ORB_FLUID_CONFIG
                        .minimumDeltaMs
                ),
                ORB_FLUID_CONFIG.maximumDeltaMs
            );
            const frameScale =
                deltaMs / 16.667;

            lastFluidFrameTime = now;
            fluidSimulationAccumulator = Math.max(
                0,
                fluidSimulationAccumulator -
                    simulationInterval
            );

            stepOrbFluid(
                now * 0.001,
                frameScale
            );
            uploadOrbFluid();
        }

        window.addEventListener(
            'pointermove',
            event => {
                if (
                    !orbFluidEnabled ||
                    (
                        !ORB_FLUID_CONFIG
                            .pointerEnabled &&
                        !ORB_FLUID_CONFIG
                            .pointerAddsDensity
                    )
                ) {
                    return;
                }

                if (
                    lastFluidPointerX !== null &&
                    lastFluidPointerY !== null
                ) {
                    const dx =
                        event.clientX -
                        lastFluidPointerX;
                    const dy =
                        event.clientY -
                        lastFluidPointerY;
                    const magnitude = Math.hypot(dx, dy);
                    const pointerCanvasRect =
                        canvas.getBoundingClientRect();
                    const pointerViewportWidth =
                        Math.max(
                            pointerCanvasRect.width,
                            1
                        );
                    const pointerViewportHeight =
                        Math.max(
                            pointerCanvasRect.height,
                            1
                        );
                    const scale =
                        magnitude >
                        ORB_FLUID_CONFIG
                            .pointerMaxDelta
                            ? ORB_FLUID_CONFIG
                                .pointerMaxDelta /
                                magnitude
                            : 1;

                    pendingFluidForces.push({
                        x:
                            (
                                event.clientX -
                                pointerCanvasRect.left
                            ) /
                            pointerViewportWidth,
                        y:
                            1 -
                            (
                                event.clientY -
                                pointerCanvasRect.top
                            ) /
                            pointerViewportHeight,
                        vx:
                            dx *
                            scale /
                            pointerViewportWidth *
                            fluidGridWidth,
                        vy:
                            -dy *
                            scale /
                            pointerViewportHeight *
                            fluidGridHeight
                    });

                    if (
                        pendingFluidForces.length >
                        ORB_FLUID_CONFIG
                            .pointerQueueLimit
                    ) {
                        pendingFluidForces.shift();
                    }
                }

                lastFluidPointerX = event.clientX;
                lastFluidPointerY = event.clientY;
            },
            { passive: true }
        );

        window.addEventListener(
            'pointerleave',
            () => {
                lastFluidPointerX = null;
                lastFluidPointerY = null;
            },
            { passive: true }
        );

        function render(now) {
            resize();
            updateTheme();
            updateOrbFluid(now);

            gl.uniform1f(
                timeLocation,
                reducedMotion ? 0 : now * 0.001
            );

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            requestAnimationFrame(render);
        }

        canvas.addEventListener(
            'webglcontextlost',
            event => {
                event.preventDefault();
                orbGLStarted = false;
                layer.classList.remove(
                    'orb-gl-active'
                );
                startAmbientLoop();
            },
            { once: true }
        );

        layer.classList.add('orb-gl-active');
        orbGLStarted = true;
        requestAnimationFrame(render);
        return true;
    }

    function startAmbientLoop() {
        if (ambientStarted) return;
        ambientStarted = true;

        const orbWraps = [
            {
                el: document.querySelector('.orb-wrap-1'),
                ax: 12,
                ay: 9,
                bx: 8,
                by: 6,
                cx: 5,
                cy: 7,
                px: 0.3,
                py: 0.35,
                fx: 0.07,
                fy: 0.11
            },
            {
                el: document.querySelector('.orb-wrap-2'),
                ax: 10,
                ay: 11,
                bx: 7,
                by: 5,
                cx: 6,
                cy: 4,
                px: 0.6,
                py: 0.55,
                fx: 0.09,
                fy: 0.13
            },
            {
                el: document.querySelector('.orb-wrap-3'),
                ax: 9,
                ay: 8,
                bx: 6,
                by: 7,
                cx: 4,
                cy: 5,
                px: 0.45,
                py: 0.6,
                fx: 0.08,
                fy: 0.10
            }
        ].filter(o => o.el);

        const hw = window.innerWidth * 0.2;
        const hh = window.innerHeight * 0.2;

        function frame() {
            const t = performance.now() * 0.001;

            for (const o of orbWraps) {
                const px =
                    Math.sin(t * o.fx + o.px * Math.PI) * o.ax +
                    Math.cos(t * o.fy + o.py * Math.PI) * o.bx +
                    Math.sin(t * 0.13 + 1.2) * o.cx;

                const py =
                    Math.cos(t * o.fy + o.py * Math.PI) * o.ay +
                    Math.sin(t * o.fx + o.px * Math.PI * 0.7) * o.by +
                    Math.cos(t * 0.17 + 2.5) * o.cy;

                o.el.style.transform =
                    `translate3d(` +
                    `${clamp(px, -hw, hw).toFixed(2)}px, ` +
                    `${clamp(py, -hh, hh).toFixed(2)}px, 0)`;
            }

            if (artCols.length > 1 && artGridEl) {
                for (const col of artCols) {
                    col.el.style.transform = '';
                }

                const rect = artGridEl.getBoundingClientRect();
                const vh = window.innerHeight;
                const diff = rect.height - vh;

                const p = diff > 0
                    ? Math.min(1, Math.max(0, -rect.top / diff))
                    : 0;

                let maxH = 0;

                for (const col of artCols) {
                    if (col.h > maxH) maxH = col.h;
                }

                for (const col of artCols) {
                    const shift = (maxH - col.h) * p;

                    col.el.style.transform =
                        `translate3d(0, ${shift.toFixed(2)}px, 0)`;
                }
            }

            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }

    /* ---------- Art grid: independent columns ---------- */
    let artGridEl = null;

    function columnCount() {
        const w = window.innerWidth;

        if (w > 1200) return 3;
        if (w > 700) return 2;

        return 1;
    }

    function measureArtCols() {
        if (!artCols.length) return;

        artCols.forEach(c => {
            c.el.style.transform = '';
        });

        requestAnimationFrame(() => {
            artCols.forEach(c => {
                c.h = c.el.offsetHeight;
            });
        });
    }

    function initArtColumns() {
        const grid = document.querySelector('.art-grid');

        if (!grid) {
            artCols = [];
            artGridEl = null;
            return;
        }

        artGridEl = grid;

        if (grid.dataset.columnized === String(columnCount())) {
            measureArtCols();
            return;
        }

        const cards = [];
        const fullWidth = [];

        Array.from(grid.children).forEach(child => {
            if (child.classList.contains('art-col')) {
                cards.push(...Array.from(child.children));
            } else if (child.classList.contains('double-width')) {
                fullWidth.push(child);
            } else {
                cards.push(child);
            }
        });

        grid.innerHTML = '';

        fullWidth.forEach(c => grid.appendChild(c));

        const n = columnCount();
        const cols = [];

        for (let i = 0; i < n; i++) {
            const col = document.createElement('div');

            col.className = 'art-col';
            grid.appendChild(col);
            cols.push(col);
        }

        const colHeights = Array(n).fill(0);
        // Deliberately give each column a different target capacity. Dividing
        // by these weights keeps the masonry stable between reloads while
        // producing visibly different final column lengths.
        const columnWeights = n === 3
            ? [1.13, 0.88, 0.99]
            : n === 2
                ? [1.1, 0.9]
                : [1];

        cards.forEach(card => {
            const img = card.querySelector('img');
            let h = 300;

            if (img && img.naturalWidth > 0) {
                h = (img.naturalHeight / img.naturalWidth) * 300;
            }

            let minIdx = 0;

            for (let c = 1; c < n; c++) {
                if (
                    colHeights[c] / columnWeights[c] <
                    colHeights[minIdx] / columnWeights[minIdx]
                ) {
                    minIdx = c;
                }
            }

            cols[minIdx].appendChild(card);
            colHeights[minIdx] += h + 20;
        });

        grid.dataset.columnized = String(n);
        artCols = cols.map(el => ({ el, h: 0 }));

        measureArtCols();

        grid.querySelectorAll('img').forEach(img => {
            if (!img.complete) {
                img.addEventListener('load', measureArtCols, {
                    once: true
                });
            }
        });

        setTimeout(measureArtCols, 1200);
    }

    let resizeTimer = null;

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {
            const grid = document.querySelector('.art-grid');

            if (
                grid &&
                grid.dataset.columnized !== String(columnCount())
            ) {
                delete grid.dataset.columnized;
            }

            initArtColumns();
        }, 200);
    });

    /* ---------- Ripple hover ---------- */
    const RIPPLE_SELECTOR = [
        '.rhombus-btn',
        '.featured-cta-btn',
        '.featured-arts-btn',
        '.game-start-btn',
        '.icon-link',
        '.footer-social-link',
        '.theme-toggle',
        '.lang-switcher-btn',
        '.scroll-card',
        '.art-scroll-card',
        '.card',
        '.timeline-content.link-content'
    ].join(', ');

    const SOLID_SELECTOR = [
        '.rhombus-btn',
        '.featured-cta-btn',
        '.featured-arts-btn',
        '.game-start-btn',
        '.icon-link',
        '.footer-social-link',
        '.theme-toggle',
        '.lang-switcher-btn',
        '.project-back-btn'
    ].join(', ');

    const _rippleHosts = new Set();
    const RIPPLE_ENTRANCE_SPEED_MULTIPLIER = 1.1;
    const RIPPLE_EXIT_DURATION_MULTIPLIER = 1.3;
    const MAGNETIC_RESPONSE = 0.3;

    function stepMagneticMotion(
        currentX,
        currentY,
        targetX,
        targetY,
        velocityX,
        velocityY,
        spring,
        maxSpeed,
        deltaFrames
    ) {
        const safeFrames = Math.max(
            deltaFrames,
            0.001
        );
        let desiredVelocityX =
            (targetX - currentX) *
            spring /
            safeFrames;
        let desiredVelocityY =
            (targetY - currentY) *
            spring /
            safeFrames;
        const desiredSpeed = Math.hypot(
            desiredVelocityX,
            desiredVelocityY
        );

        if (desiredSpeed > maxSpeed) {
            const scale = maxSpeed / desiredSpeed;
            desiredVelocityX *= scale;
            desiredVelocityY *= scale;
        }

        const velocityBlend = frameAlpha(
            0.30,
            safeFrames
        );
        let velocityChangeX =
            (desiredVelocityX - velocityX) *
            velocityBlend;
        let velocityChangeY =
            (desiredVelocityY - velocityY) *
            velocityBlend;
        const velocityChange = Math.hypot(
            velocityChangeX,
            velocityChangeY
        );
        const accelerationLimit =
            maxSpeed * 0.24 * safeFrames;

        if (
            velocityChange > accelerationLimit &&
            velocityChange > 0
        ) {
            const scale =
                accelerationLimit / velocityChange;
            velocityChangeX *= scale;
            velocityChangeY *= scale;
        }

        velocityX += velocityChangeX;
        velocityY += velocityChangeY;

        const speed = Math.hypot(
            velocityX,
            velocityY
        );

        if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            velocityX *= scale;
            velocityY *= scale;
        }

        return {
            x: velocityX * safeFrames,
            y: velocityY * safeFrames,
            velocityX,
            velocityY
        };
    }

    function readRenderedTranslate(el) {
        const transform =
            getComputedStyle(el).transform;

        if (!transform || transform === 'none') {
            return { x: 0, y: 0 };
        }

        try {
            const matrix =
                new DOMMatrixReadOnly(transform);

            return {
                x: matrix.m41,
                y: matrix.m42
            };
        } catch (_) {
            return { x: 0, y: 0 };
        }
    }

    function animateMagneticReturn(
        el,
        currentX,
        currentY,
        onFinish
    ) {
        const reboundAxis = value => {
            if (Math.abs(value) < 0.2) return 0;

            return (
                -Math.sign(value) *
                clamp(Math.abs(value) * 0.12, 0.55, 1.15)
            );
        };

        const reboundX = reboundAxis(currentX);
        const reboundY = reboundAxis(currentY);

        const animation = el.animate(
            [
                {
                    transform:
                        `translate3d(${currentX.toFixed(2)}px, ` +
                        `${currentY.toFixed(2)}px, 0)`
                },
                {
                    transform:
                        `translate3d(${reboundX.toFixed(2)}px, ` +
                        `${reboundY.toFixed(2)}px, 0)`,
                    offset: 0.72
                },
                {
                    transform: 'translate3d(0, 0, 0)'
                }
            ],
            {
                duration: 520,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
            }
        );

        animation.onfinish = () => {
            animation.cancel();
            el.style.transform = '';
            onFinish?.();
        };

        return animation;
    }

    function spawnInk(el, x, y, startScale) {
        const ink = document.createElement('span');

        ink.className = 'ripple-ink';
        ink.style.left = `${x}px`;
        ink.style.top = `${y}px`;

        if (startScale) {
            ink.style.transform =
                `translate(-50%, -50%) scale(${startScale})`;
        }

        el.appendChild(ink);

        return ink;
    }

    function bindRipple(el) {
        if (el.dataset.rippleBound) return;

        el.dataset.rippleBound = '1';
        el.classList.add('ripple-host');
        _rippleHosts.add(el);

        const solid = el.matches(SOLID_SELECTOR);

        el.classList.add(solid ? 'ripple-solid' : 'ripple-tint');

        const isMagnetic =
            !el.matches('.nav-item, .logo, .lang-option');
        const isNavButton = el.matches(
            '.theme-toggle, ' +
            '.lang-switcher-btn, ' +
            '.icon-link, ' +
            '.footer-social-link'
        );
        const isHeaderControl = el.matches(
            '.theme-toggle, .lang-switcher-btn'
        );
        const isCardLike = el.matches(
            '.scroll-card, ' +
            '.art-scroll-card, ' +
            '.card, ' +
            '.timeline-content.link-content'
        );
        const magneticSpeedLimit = isCardLike
            ? 1.8
            : isHeaderControl
                ? 1.15
                : isNavButton
                    ? 1.3
                    : 1.55;

        let targetTransX = 0;
        let targetTransY = 0;
        let curTransX = 0;
        let curTransY = 0;
        let magneticVelocityX = 0;
        let magneticVelocityY = 0;

        let reboundAnim = null;

        function updateMagneticTarget(
            clientX,
            clientY,
            rect = el.getBoundingClientRect()
        ) {
            const width = rect.width;
            const height = rect.height;
            const centerX =
                rect.left + width / 2 - curTransX;
            const centerY =
                rect.top + height / 2 - curTransY;
            const limit = isNavButton
                ? 13
                : width < 80 || height < 80
                    ? 8
                    : 6;

            /*
             * Map the pointer's normalized position to only 72% of the former
             * hard limit. Card-like elements intentionally use 1.7x the
             * sensitivity and edge travel of the other large elements.
             */
            const usableLimit =
                limit *
                0.72 *
                (isCardLike ? 1.7 : 1) *
                (isHeaderControl ? 0.7 : 1);
            const normalizedX = clamp(
                (clientX - centerX) / Math.max(width / 2, 1),
                -1,
                1
            );
            const normalizedY = clamp(
                (clientY - centerY) / Math.max(height / 2, 1),
                -1,
                1
            );

            targetTransX = normalizedX * usableLimit;
            targetTransY = normalizedY * usableLimit;
        }

        el._magneticSpring = (deltaFrames = 1) => {
            if (!isHovering) return;

            const spring =
                1 -
                Math.pow(
                    1 - MAGNETIC_RESPONSE,
                    deltaFrames
                );

            const delta = stepMagneticMotion(
                curTransX,
                curTransY,
                targetTransX,
                targetTransY,
                magneticVelocityX,
                magneticVelocityY,
                spring,
                magneticSpeedLimit,
                deltaFrames
            );

            curTransX += delta.x;
            curTransY += delta.y;
            magneticVelocityX = delta.velocityX;
            magneticVelocityY = delta.velocityY;

            el.style.transform =
                `translate3d(` +
                `${curTransX.toFixed(3)}px, ` +
                `${curTransY.toFixed(3)}px, 0)`;
        };

        if (solid) {
            const wrap = document.createElement('span');

            wrap.className = 'ripple-content';

            while (el.firstChild) {
                wrap.appendChild(el.firstChild);
            }

            el.appendChild(wrap);
        }

        let growAnim = null;
        let liveInks = [];
        let isHovering = false;
        let elRect = null;
        let maxScale = 3;
        let inkDur = 300;
        let lastExitPoint = null;

        /*
         * Element cursor glow disabled. Keep the implementation here so it can
         * be restored independently from the ripple behavior if needed.
         *
        let cursorGlow = null;

        function ensureCursorGlow() {
            if (
                !cursorGlow ||
                !document.contains(cursorGlow)
            ) {
                cursorGlow = document.createElement('div');
                cursorGlow.className = 'cursor-glow';
                el.appendChild(cursorGlow);
            }

            return cursorGlow;
        }
        */

        function exitInks(exitPoint) {
            const frozen = [...liveInks].filter(
                ink => document.contains(ink)
            );

            liveInks = [];

            if (growAnim) {
                try {
                    growAnim.cancel();
                } catch (_) {}

                growAnim = null;
            }

            const rect = el.getBoundingClientRect();
            const exitX = exitPoint
                ? exitPoint.x
                : rect.width / 2;

            const exitY = exitPoint
                ? exitPoint.y
                : rect.height / 2;

            frozen.forEach(ink => {
                const cs = getComputedStyle(ink);
                const transform = cs.transform;
                const opacity = cs.opacity;
                const radius = cs.borderRadius;

                ink.getAnimations().forEach(animation => {
                    try {
                        animation.cancel();
                    } catch (_) {}
                });

                ink.style.animation = 'none';
                ink.style.transform = transform;
                ink.style.opacity = opacity;
                ink.style.borderRadius = radius;
                ink.style.left = `${exitX}px`;
                ink.style.top = `${exitY}px`;

                const matrixMatch =
                    transform.match(/matrix\(([^)]+)\)/);

                let currentScale = 1;

                if (matrixMatch) {
                    const values = matrixMatch[1]
                        .split(',')
                        .map(Number);

                    currentScale =
                        Math.abs(values[0]) || 1;
                }

                const currentOpacity =
                    parseFloat(opacity) || 0;

                ink.animate(
                    [
                        {
                            transform:
                                `translate(-50%, -50%) ` +
                                `scale(${currentScale.toFixed(3)})`,
                            opacity: currentOpacity
                        },
                        {
                            transform:
                                'translate(-50%, -50%) scale(0)',
                            opacity: 0
                        }
                    ],
                    {
                        duration:
                            250 *
                            RIPPLE_EXIT_DURATION_MULTIPLIER,
                        easing:
                            'cubic-bezier(0.4, 0, 0.8, 1)',
                        fill: 'forwards'
                    }
                );

                clearTimeout(ink._rippleRemovalTimer);
                ink._rippleRemovalTimer = setTimeout(
                    () => ink.remove(),
                    340 *
                        RIPPLE_EXIT_DURATION_MULTIPLIER
                );
            });
        }

        function moveInks(x, y) {
            if (!liveInks.length) return;

            for (const ink of liveInks) {
                ink.style.left = `${x}px`;
                ink.style.top = `${y}px`;
            }
        }

        el.addEventListener('pointerenter', event => {
            if (!finePointer) return;

            /*
             * Native pointer events and the elementFromPoint reconciler can
             * report the same transition in one frame. Do not restart the
             * ripple or overwrite its active animation on that duplicate.
             */
            if (isHovering) {
                if (isMagnetic) {
                    updateMagneticTarget(
                        event.clientX,
                        event.clientY
                    );
                }

                return;
            }

            if (reboundAnim) {
                const rendered =
                    readRenderedTranslate(el);

                reboundAnim.cancel();
                reboundAnim = null;
                curTransX = rendered.x;
                curTransY = rendered.y;
                magneticVelocityX = 0;
                magneticVelocityY = 0;
                el.style.transform =
                    `translate3d(${curTransX}px, ` +
                    `${curTransY}px, 0)`;
            }

            if (isExiting) {
                clearExitTimers();

                isExiting = false;
                el.classList.remove('motion-exiting');
                el.style.transition = '';
            }

            isHovering = true;
            el._motionHoverActive = true;
            lastExitPoint = null;

            if (isMagnetic) {
                updateMagneticTarget(
                    event.clientX,
                    event.clientY
                );
            }

            const oldInks = [
                ...el.querySelectorAll('.ripple-ink')
            ];
            let recoveredInk =
                oldInks.length
                    ? oldInks[oldInks.length - 1]
                    : null;

            oldInks.forEach(ink => {
                if (ink !== recoveredInk) {
                    clearTimeout(
                        ink._rippleRemovalTimer
                    );
                    ink.remove();
                    return;
                }

                const renderedStyle =
                    getComputedStyle(ink);
                const renderedTransform =
                    renderedStyle.transform;
                const renderedOpacity =
                    renderedStyle.opacity;

                ink.getAnimations().forEach(
                    animation => {
                        try {
                            animation.cancel();
                        } catch (_) {}
                    }
                );
                clearTimeout(
                    ink._rippleRemovalTimer
                );
                ink._rippleRemovalTimer = null;
                ink.style.animation = 'none';
                ink.style.transition = 'none';
                ink.style.transform =
                    renderedTransform;
                ink.style.opacity =
                    renderedOpacity;
            });

            liveInks = recoveredInk
                ? [recoveredInk]
                : [];

            if (growAnim) {
                try {
                    growAnim.cancel();
                } catch (_) {}

                growAnim = null;
            }

            el.classList.add('ripple-filled');

            if (solid) {
                el.classList.add('rippling');
            }

            el.classList.add('is-hovered');

            elRect = el.getBoundingClientRect();

            maxScale =
                (
                    Math.hypot(
                        elRect.width,
                        elRect.height
                    ) / 24
                ) * 2;

            inkDur = solid ? 300 : 450;
            el.dataset.maxScale = maxScale;

            /*
             * Element cursor glow disabled.
             *
            if (
                !el.classList.contains('nav-item') &&
                !el.classList.contains('rhombus-btn') &&
                !el.classList.contains(
                    'lang-switcher-btn'
                ) &&
                !el.classList.contains('theme-toggle') &&
                !el.classList.contains(
                    'footer-social-link'
                ) &&
                !el.classList.contains('icon-link')
            ) {
                const glow = ensureCursorGlow();

                glow.style.left =
                    `${event.clientX - elRect.left}px`;

                glow.style.top =
                    `${event.clientY - elRect.top}px`;

                glow.classList.add('active');
            }
            */

            const x = event.clientX - elRect.left;
            const y = event.clientY - elRect.top;

            const ink =
                recoveredInk ||
                spawnInk(el, x, y);

            liveInks = [ink];
            const wasRecovered =
                Boolean(recoveredInk);
            const recoveredStyle =
                getComputedStyle(ink);
            const recoveredTransform =
                recoveredStyle.transform;
            const recoveredOpacity =
                wasRecovered
                    ? clamp(
                        parseFloat(
                            recoveredStyle.opacity
                        ) || 0,
                        0,
                        1
                    )
                    : 0;
            const recoveredMatrixMatch =
                recoveredTransform.match(
                    /matrix\(([^)]+)\)/
                );
            let recoveredScale = 0;

            if (
                wasRecovered &&
                recoveredMatrixMatch
            ) {
                const matrixValues =
                    recoveredMatrixMatch[1]
                        .split(',')
                        .map(Number);

                recoveredScale =
                    Math.abs(matrixValues[0]) || 0;
            }

            growAnim = ink.animate(
                [
                    {
                        transform:
                            `translate(-50%, -50%) ` +
                            `scale(${recoveredScale.toFixed(3)})`
                    },
                    {
                        transform:
                            `translate(-50%, -50%) ` +
                            `scale(${maxScale.toFixed(2)})`
                    }
                ],
                {
                    duration:
                        inkDur *
                        (
                            1 /
                            RIPPLE_ENTRANCE_SPEED_MULTIPLIER
                        ),
                    easing: 'linear',
                    fill: 'forwards'
                }
            );

            ink.animate(
                [
                    {
                        opacity: recoveredOpacity,
                        offset: 0
                    },
                    {
                        opacity: Math.max(
                            recoveredOpacity,
                            0.08
                        ),
                        offset: 0.55
                    },
                    {
                        opacity: Math.max(
                            recoveredOpacity,
                            0.28
                        ),
                        offset: 0.8
                    },
                    {
                        opacity: 1,
                        offset: 1
                    }
                ],
                {
                    duration:
                        200 *
                        (
                            1 /
                            RIPPLE_ENTRANCE_SPEED_MULTIPLIER
                        ),
                    easing: 'linear',
                    fill: 'forwards'
                }
            );

            growAnim.onfinish = () => {
                growAnim = null;

                if (!isHovering) {
                    startExit();
                }
            };
        });

        el.addEventListener('pointermove', event => {
            if (!finePointer || !isHovering) return;

            elRect = el.getBoundingClientRect();

            if (isMagnetic) {
                updateMagneticTarget(
                    event.clientX,
                    event.clientY,
                    elRect
                );
            }

            if (liveInks.length) {
                moveInks(
                    event.clientX - elRect.left,
                    event.clientY - elRect.top
                );
            }

            /*
             * Element cursor glow disabled.
             *
            if (cursorGlow) {
                cursorGlow.style.left =
                    `${event.clientX - elRect.left}px`;

                cursorGlow.style.top =
                    `${event.clientY - elRect.top}px`;
            }
            */
        });

        el._scrollTick = () => {
            if (!isHovering) return;

            const rect = el.getBoundingClientRect();
            const x = mouseX - rect.left;
            const y = mouseY - rect.top;

            if (liveInks.length) {
                moveInks(x, y);
            }

            /*
             * Element cursor glow disabled.
             *
            if (cursorGlow) {
                cursorGlow.style.left = `${x}px`;
                cursorGlow.style.top = `${y}px`;
            }
            */
        };

        el.addEventListener('pointerleave', event => {
            if (!finePointer || !isHovering) return;

            /*
             * Element cursor glow disabled.
             *
            if (cursorGlow) {
                cursorGlow.classList.remove('active');
            }
            */

            const rect = el.getBoundingClientRect();

            lastExitPoint = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };

            isHovering = false;
            el._motionHoverActive = false;

            if (!growAnim && !isExiting) {
                startExit(lastExitPoint);
            }
        });

        let isExiting = false;
        let exitTimers = [];

        function clearExitTimers() {
            exitTimers.forEach(timer => {
                clearTimeout(timer);
            });

            exitTimers = [];
        }

        function startExit(
            exitPoint = lastExitPoint
        ) {
            if (isHovering) return;

            isExiting = true;
            el.classList.add('motion-exiting');

            exitInks(exitPoint);

            if (isMagnetic) {
                targetTransX = 0;
                targetTransY = 0;
                magneticVelocityX = 0;
                magneticVelocityY = 0;

                reboundAnim = animateMagneticReturn(
                    el,
                    curTransX,
                    curTransY,
                    () => {
                        reboundAnim = null;
                        curTransX = 0;
                        curTransY = 0;
                        magneticVelocityX = 0;
                        magneticVelocityY = 0;
                    }
                );

                const timer = setTimeout(() => {
                    el.style.transition = '';
                    isExiting = false;
                    el.classList.remove('motion-exiting');
                }, 540);

                exitTimers.push(timer);
            } else {
                const timer = setTimeout(() => {
                    isExiting = false;
                    el.classList.remove('motion-exiting');
                }, 500);

                exitTimers.push(timer);
            }

            el.classList.remove('ripple-filled');

            if (solid) {
                el.classList.remove('rippling');
            }

            el.classList.remove('is-hovered');
            isHovering = false;
            el._motionHoverActive = false;
        }
    }

    function initRipples() {
        document
            .querySelectorAll(RIPPLE_SELECTOR)
            .forEach(bindRipple);

        document
            .querySelectorAll('.nav-item:not(.active)')
            .forEach(bindNavMagnet);
    }

    function bindNavMagnet(el) {
        if (el.dataset.magneticBound) return;

        el.dataset.magneticBound = '1';
        _rippleHosts.add(el);

        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        let magneticVelocityX = 0;
        let magneticVelocityY = 0;
        let isHovering = false;
        let reboundAnim = null;

        el._magneticSpring = (deltaFrames = 1) => {
            if (!isHovering) return;

            const spring =
                1 -
                Math.pow(
                    1 - MAGNETIC_RESPONSE,
                    deltaFrames
                );

            const delta = stepMagneticMotion(
                currentX,
                currentY,
                targetX,
                targetY,
                magneticVelocityX,
                magneticVelocityY,
                spring,
                1.1,
                deltaFrames
            );

            currentX += delta.x;
            currentY += delta.y;
            magneticVelocityX = delta.velocityX;
            magneticVelocityY = delta.velocityY;

            el.style.transform =
                `translate3d(${currentX.toFixed(3)}px, ` +
                `${currentY.toFixed(3)}px, 0)`;
        };

        const updateTarget = event => {
            const rect = el.getBoundingClientRect();
            const centerX =
                rect.left + rect.width / 2 - currentX;
            const centerY =
                rect.top + rect.height / 2 - currentY;
            const normalizedX = clamp(
                (event.clientX - centerX) /
                    Math.max(rect.width / 2, 1),
                -1,
                1
            );
            const normalizedY = clamp(
                (event.clientY - centerY) /
                    Math.max(rect.height / 2, 1),
                -1,
                1
            );

            targetX = normalizedX * 6.12;
            targetY = normalizedY * 4.08;
        };

        el.addEventListener('pointerenter', event => {
            if (!finePointer) return;

            if (isHovering) {
                updateTarget(event);
                return;
            }

            if (reboundAnim) {
                const rendered =
                    readRenderedTranslate(el);

                reboundAnim.cancel();
                reboundAnim = null;
                currentX = rendered.x;
                currentY = rendered.y;
                magneticVelocityX = 0;
                magneticVelocityY = 0;
                el.style.transform =
                    `translate3d(${currentX}px, ` +
                    `${currentY}px, 0)`;
            }

            el.classList.remove('motion-exiting');
            isHovering = true;
            el._motionHoverActive = true;
            updateTarget(event);
        });

        el.addEventListener('pointermove', event => {
            if (!finePointer || !isHovering) return;
            updateTarget(event);
        });

        el.addEventListener('pointerleave', () => {
            if (!finePointer || !isHovering) return;

            isHovering = false;
            el._motionHoverActive = false;
            targetX = 0;
            targetY = 0;
            magneticVelocityX = 0;
            magneticVelocityY = 0;
            el.classList.add('motion-exiting');

            reboundAnim = animateMagneticReturn(
                el,
                currentX,
                currentY,
                () => {
                    reboundAnim = null;
                    currentX = 0;
                    currentY = 0;
                    magneticVelocityX = 0;
                    magneticVelocityY = 0;
                    el.classList.remove('motion-exiting');
                }
            );
        });

        el.addEventListener('click', event => {
            if (!finePointer || !isHovering) return;

            el.dispatchEvent(
                new PointerEvent('pointerleave', {
                    bubbles: true,
                    cancelable: true,
                    clientX: event.clientX,
                    clientY: event.clientY
                })
            );

            document.dispatchEvent(
                new CustomEvent('motion-force-pointer-exit', {
                    detail: {
                        host: el,
                        clientX: event.clientX,
                        clientY: event.clientY,
                        silent: true
                    }
                })
            );
        });
    }

    /* ---------- Full-screen circular sweeps ---------- */
    const SWEEP_SIZE = 26;
    const FULLSCREEN_ENTER_SPEED = 0.7;
    const PAGE_SWEEP_ENTER_MS =
        Math.round(300 / FULLSCREEN_ENTER_SPEED);
    const FX_CIRCLE_ENTER_MS =
        Math.round(360 / FULLSCREEN_ENTER_SPEED);

    function sweepPoint(direction, entering) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (direction === 'left') {
            return {
                x: entering ? 0 : vw,
                y: vh / 2
            };
        }

        if (direction === 'right') {
            return {
                x: entering ? vw : 0,
                y: vh / 2
            };
        }

        return {
            x: vw / 2,
            y: vh / 2
        };
    }

    function coverScale(x, y) {
        const diagonal =
            Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            ) * 2.2;

        return diagonal / SWEEP_SIZE;
    }

    function makeBrand(content, delay) {
        const brand = document.createElement('div');

        brand.className = 'fx-brand';

        if (content instanceof Node) {
            brand.appendChild(content);
        } else {
            const span = document.createElement('span');

            span.className = 'fx-brand-text';
            span.textContent = content;

            brand.appendChild(span);
        }

        document.body.appendChild(brand);

        const show = () => {
            brand.classList.add('show');
        };

        if (delay) {
            setTimeout(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(show);
                });
            }, delay);
        } else {
            requestAnimationFrame(() => {
                requestAnimationFrame(show);
            });
        }

        return brand;
    }

    async function hideBrand(brand) {
        if (!brand) return;

        await new Promise(resolve => {
            setTimeout(resolve, 260);
        });

        brand.classList.remove('show');

        await new Promise(resolve => {
            setTimeout(resolve, 80);
        });

        brand.remove();
    }

    let sweepEl = null;
    let sweepBrand = null;
    let sweepBusy = false;
    let sweepLock = 0;

    function abortSweep() {
        sweepBusy = false;
        sweepLock = Math.max(0, sweepLock - 1);

        if (sweepEl) {
            try {
                sweepEl
                    .getAnimations()
                    .forEach(animation => {
                        animation.cancel();
                    });
            } catch (_) {}

            if (document.body.contains(sweepEl)) {
                sweepEl.remove();
            }

            sweepEl = null;
        }

        if (sweepBrand) {
            if (document.body.contains(sweepBrand)) {
                sweepBrand.remove();
            }

            sweepBrand = null;
        }

        const circle =
            document.querySelector('.fx-circle');

        if (circle) {
            circle.remove();
        }
    }

    async function sweepIn(direction, position) {
        if (sweepLock > 0) return;

        sweepLock++;

        if (sweepBusy) {
            abortSweep();
        }

        sweepBusy = true;

        const stale =
            document.querySelectorAll(
                '.page-sweep, .fx-brand'
            );

        stale.forEach(element => {
            if (
                element !== sweepEl &&
                element !== sweepBrand
            ) {
                element.remove();
            }
        });

        if (
            !sweepEl ||
            !document.body.contains(sweepEl)
        ) {
            sweepEl = document.createElement('div');
            sweepEl.className = 'page-sweep';

            document.body.appendChild(sweepEl);
        }

        const element = sweepEl;

        const point =
            position &&
            typeof position.x === 'number'
                ? position
                : sweepPoint(direction, true);

        const scale =
            coverScale(point.x, point.y);

        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
        element.style.opacity = '1';

        const grow = element.animate(
            [
                {
                    transform:
                        'translate(-50%, -50%) scale(0)',
                    opacity: 1
                },
                {
                    transform:
                        `translate(-50%, -50%) ` +
                        `scale(${scale.toFixed(2)})`,
                    opacity: 1
                }
            ],
            {
                duration: PAGE_SWEEP_ENTER_MS,
                easing:
                    'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
            }
        );

        sweepBrand =
            makeBrand(
                'P . R . T . S .',
                Math.round(90 / FULLSCREEN_ENTER_SPEED)
            );

        try {
            await grow.finished;
        } catch (_) {}
    }

    async function sweepOut() {
        const element = sweepEl;

        if (!element) {
            sweepBusy = false;
            sweepLock =
                Math.max(0, sweepLock - 1);
            return;
        }

        try {
            await hideBrand(sweepBrand);
            sweepBrand = null;

            const opacity =
                getComputedStyle(element).opacity;

            element.style.opacity = opacity;

            element.animate(
                [
                    { opacity },
                    { opacity: 0 }
                ],
                {
                    duration: 220,
                    easing: 'ease-in',
                    fill: 'forwards'
                }
            );

            await new Promise(resolve => {
                setTimeout(resolve, 240);
            });
        } finally {
            if (element.parentNode) {
                element.remove();
            }

            sweepEl = null;
            sweepBusy = false;
            sweepLock =
                Math.max(0, sweepLock - 1);
        }
    }

    async function fxCircle(
        x,
        y,
        color,
        midpoint,
        brandContent,
        accent
    ) {
        const circle =
            document.createElement('div');

        circle.className = 'fx-circle';
        circle.style.left = `${x}px`;
        circle.style.top = `${y}px`;

        circle.style.background = accent
            ? `radial-gradient(` +
              `circle at 40% 40%, ` +
              `color-mix(in srgb, ${color} 88%, ${accent}), ` +
              `${color} 30%)`
            : color;

        circle.style.opacity = '1';

        document.body.appendChild(circle);

        const scale = coverScale(x, y);

        const grow = circle.animate(
            [
                {
                    transform:
                        'translate(-50%, -50%) scale(0)',
                    opacity: 1
                },
                {
                    transform:
                        `translate(-50%, -50%) ` +
                        `scale(${scale.toFixed(2)})`,
                    opacity: 1
                }
            ],
            {
                duration: FX_CIRCLE_ENTER_MS,
                easing:
                    'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
            }
        );

        let brand = null;

        if (brandContent) {
            brand =
                makeBrand(
                    brandContent,
                    Math.round(
                        100 / FULLSCREEN_ENTER_SPEED
                    )
                );

            if (accent) {
                circle.classList.add('no-blur');
            }
        }

        try {
            await grow.finished;
        } catch (_) {}

        if (typeof midpoint === 'function') {
            midpoint();
        }

        await hideBrand(brand);

        const opacity =
            getComputedStyle(circle).opacity;

        circle.style.opacity = opacity;

        circle.animate(
            [
                { opacity },
                { opacity: 0 }
            ],
            {
                duration: 220,
                easing: 'ease-in',
                fill: 'forwards'
            }
        );

        await new Promise(resolve => {
            setTimeout(resolve, 240);
        });

        circle.remove();
    }

    /* ---------- Global WebGL contour field ---------- */
    let glStarted = false;

    function initContourGL() {
        if (glStarted) return;

        const canvas =
            document.getElementById('contour-gl');

        if (!canvas) return;

        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            powerPreference: 'low-power'
        });

        if (!gl) {
            canvas.remove();
            return;
        }

        glStarted = true;
        gl.getExtension('OES_standard_derivatives');

        const vertexSource =
            'attribute vec2 aPos;' +
            'void main(){' +
            'gl_Position=vec4(aPos,0.0,1.0);' +
            '}';

        const fragmentSource = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

precision mediump float;

uniform vec2 uRes;
uniform float uTime;
uniform float uAlpha;
uniform float uScroll;

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 -
           0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;

    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);

    vec4 p = permute(
        permute(
            permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0)
            ) +
            i.y + vec4(0.0, i1.y, i2.y, 1.0)
        ) +
        i.x + vec4(0.0, i1.x, i2.x, 1.0)
    );

    float n = 0.142857142857;
    vec3 ns = n * D.wyz - D.xzx;

    vec4 j =
        p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;

    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;

    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 =
        b0.xzyw + s0.xzyw * sh.xxyy;

    vec4 a1 =
        b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(
        vec4(
            dot(p0, p0),
            dot(p1, p1),
            dot(p2, p2),
            dot(p3, p3)
        )
    );

    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(
        0.6 - vec4(
            dot(x0, x0),
            dot(x1, x1),
            dot(x2, x2),
            dot(x3, x3)
        ),
        0.0
    );

    m = m * m;

    return 42.0 * dot(
        m * m,
        vec4(
            dot(p0, x0),
            dot(p1, x1),
            dot(p2, x2),
            dot(p3, x3)
        )
    );
}

void main() {
    vec2 uv =
        (gl_FragCoord.xy - 0.5 * uRes) /
        min(uRes.x, uRes.y);

    float t = uTime;

    uv.y -= uScroll * 0.0001;

    vec2 p =
        uv +
        vec2(t * 0.006, -t * 0.004);

    float h =
          snoise(vec3(p * 0.75, t * 0.07))
        + 0.5 * snoise(
            vec3(
                p * 1.5 + vec2(7.3, 2.1),
                t * 0.10
            )
        )
        + 0.25 * snoise(
            vec3(
                p * 3.0 + vec2(2.9, 5.7),
                t * 0.13
            )
        );

    float freq = 2.4;
    float contourCoordinate = h * freq;
    float contourPhase =
        min(
            fract(contourCoordinate),
            1.0 - fract(contourCoordinate)
        );

#ifdef GL_OES_standard_derivatives
    /*
     * Convert the field-space distance to an approximate screen-pixel
     * distance with the Euclidean gradient. Unlike a raw fwidth threshold,
     * this keeps line weight independent of the field's local slope and the
     * contour's orientation.
     */
    vec2 contourGradient =
        vec2(
            dFdx(contourCoordinate),
            dFdy(contourCoordinate)
        );

    float gradientPerPixel =
        max(length(contourGradient), 0.00001);

    float distancePixels =
        contourPhase / gradientPerPixel;

    /*
     * Adjacent contour levels get closer in steep blended regions. Cap the
     * outer line radius to 42% of their local spacing so neighbouring lines
     * cannot overlap into a single thick band.
     */
    float spacingPixels =
        1.0 / gradientPerPixel;

    float outerRadiusPixels =
        min(1.30, spacingPixels * 0.42);

    float innerRadiusPixels =
        outerRadiusPixels * 0.46;

    float line =
        1.0 -
        smoothstep(
            innerRadiusPixels,
            outerRadiusPixels,
            distancePixels
        );
#else
    float line =
        smoothstep(
            0.012,
            0.004,
            contourPhase / freq
        );
#endif

    /*
     * Both theme accents share the same hue once normalized to maximum
     * luminance. Keep the source colour fully bright and control visual
     * strength only through alpha so overlaps with the green orbs brighten
     * naturally through normal compositing.
     */
    vec3 accent = vec3(0.0, 1.0, 0.25);

    float alpha = line * uAlpha;

    gl_FragColor =
        vec4(accent, alpha);
}
`;

        function compile(type, source) {
            const shader = gl.createShader(type);

            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (
                !gl.getShaderParameter(
                    shader,
                    gl.COMPILE_STATUS
                )
            ) {
                console.warn(
                    'contour shader:',
                    gl.getShaderInfoLog(shader)
                );

                return null;
            }

            return shader;
        }

        const vertexShader =
            compile(gl.VERTEX_SHADER, vertexSource);

        const fragmentShader =
            compile(gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) {
            canvas.remove();
            return;
        }

        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.useProgram(program);

        const buffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                 1,  1
            ]),
            gl.STATIC_DRAW
        );

        const positionLocation =
            gl.getAttribLocation(program, 'aPos');

        gl.enableVertexAttribArray(
            positionLocation
        );

        gl.vertexAttribPointer(
            positionLocation,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );

        const resolutionLocation =
            gl.getUniformLocation(program, 'uRes');

        const timeLocation =
            gl.getUniformLocation(program, 'uTime');

        const alphaLocation =
            gl.getUniformLocation(program, 'uAlpha');

        const scrollLocation =
            gl.getUniformLocation(program, 'uScroll');

        let scrollY = 0;

        window.addEventListener(
            'scroll',
            () => {
                scrollY = window.scrollY;
            },
            { passive: true }
        );

        if (
            typeof window.__useSystemCursor ===
            'undefined'
        ) {
            window.__useSystemCursor = false;
        }

        gl.enable(gl.BLEND);

        gl.blendFunc(
            gl.SRC_ALPHA,
            gl.ONE_MINUS_SRC_ALPHA
        );

        gl.clearColor(0, 0, 0, 0);

        function resize() {
            const dpr = Math.min(
                window.devicePixelRatio || 1,
                1.5
            );

            canvas.width =
                Math.floor(window.innerWidth * dpr);

            canvas.height =
                Math.floor(window.innerHeight * dpr);

            gl.viewport(
                0,
                0,
                canvas.width,
                canvas.height
            );
        }

        window.addEventListener('resize', resize);
        resize();

        function render(now) {
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.uniform2f(
                resolutionLocation,
                canvas.width,
                canvas.height
            );

            gl.uniform1f(
                timeLocation,
                now * 0.001
            );

            const dark =
                document.documentElement
                    .getAttribute('data-theme') ===
                'dark';

            gl.uniform1f(
                alphaLocation,
                dark ? 0.52 : 0.33
            );

            gl.uniform1f(
                scrollLocation,
                scrollY
            );

            gl.drawArrays(
                gl.TRIANGLE_STRIP,
                0,
                4
            );

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    }

    /* ---------- Liquid cursor ---------- */
    let cursorEl = null;
    let cursorNodes = null;
    let cursorThemeColor = '#00CC33';

    function syncCursorThemeColor() {
        setCursorTheme(
            window.__pendingCursorTheme ||
            document.documentElement
                .getAttribute('data-theme')
        );
    }

    function setCursorTheme(theme) {
        cursorThemeColor =
            theme === 'dark'
                ? '#00CC33'
                : '#008A22';

        if (!cursorEl) return;

        cursorEl
            .querySelectorAll('.drop-node')
            .forEach(node => {
                node.style.setProperty(
                    'background',
                    cursorThemeColor,
                    'important'
                );
            });
    }

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    let initX = mouseX;
    let initY = mouseY;

    let lastMouseX = mouseX;
    let lastMouseY = mouseY;

    let mouseVx = 0;
    let mouseVy = 0;

    const DROP_N = 3;
    const BASE_SIZES = [22, 14, 8];

    let currentHeadSize = BASE_SIZES[0];
    let currentBodySize = BASE_SIZES[1];
    let currentTailSize = BASE_SIZES[2];

    let headX = mouseX;
    let headY = mouseY;

    let bodyX = mouseX;
    let bodyY = mouseY;

    let tailX = mouseX;
    let tailY = mouseY;

    let spawnTimer = 0;
    let spawnThreshold = 5;
    let idleTime = 0;
    let lastBurstTime = 0;
    let clickSplitTime = 0;
    let isHoveringInteract = false;
    let magneticElapsedMs = 0;
    let morphAmp = 0;

    const clamp = (value, min, max) =>
        Math.max(min, Math.min(max, value));

    const tempDrops = [];
    const MAX_TEMP_DROPS = 60;

    let stickyAnchor = null;

    function buildGooeyFilter() {
        if (document.getElementById('goo-svg')) {
            return;
        }

        const container =
            document.createElement('div');

        container.style.display = 'none';

        container.innerHTML = `
            <svg
                id="goo-svg"
                width="0"
                height="0"
                style="
                    position:absolute;
                    pointer-events:none;
                "
            >
                <defs>
                    <filter
                        id="goo-filter"
                        color-interpolation-filters="sRGB"
                    >
                        <feGaussianBlur
                            in="SourceGraphic"
                            stdDeviation="4.0"
                            result="blur"
                        />

                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="
                                1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                0 0 0 30 -13
                            "
                            result="gooey"
                        />

                        <feGaussianBlur
                            in="gooey"
                            stdDeviation="0.1"
                            result="antialiasedGoo"
                        />
                    </filter>
                </defs>
            </svg>
        `;

        document.body.appendChild(
            container.firstElementChild
        );
    }

    function injectCursorStyles() {
        if (
            document.getElementById(
                'liquid-cursor-styles'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id = 'liquid-cursor-styles';

        style.textContent = `
            .liquid-cursor {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                pointer-events: none !important;
                z-index: 99999 !important;
                filter: url(#goo-filter) !important;
                transform: translate3d(0, 0, 0) !important;
                will-change: transform !important;
                transition:
                    opacity 0.2s
                    cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 1;
            }

            .liquid-cursor.cursor-in-iframe {
                opacity: 0;
            }

            .drop-node {
                position: absolute !important;
                background:
                    var(
                        --cursor-color,
                        #00f0ff
                    ) !important;
                border-radius: 50%;
                transform-origin:
                    center center !important;
                pointer-events: none !important;
                will-change:
                    transform,
                    width,
                    height,
                    border-radius !important;
            }

            html.has-custom-cursor:not(
                .show-system-cursor
            ),
            html.has-custom-cursor:not(
                .show-system-cursor
            ) * {
                cursor: none !important;
            }
        `;

        document.head.appendChild(style);
    }

    function spawnDrop(
        x,
        y,
        size,
        life,
        vx,
        vy,
        isBurst = false
    ) {
        if (!cursorEl) return;

        while (
            tempDrops.length >= MAX_TEMP_DROPS
        ) {
            const old = tempDrops.shift();

            if (old && old.el) {
                old.el.remove();
            }
        }

        const element =
            document.createElement('div');

        element.className =
            'drop-node temp-drop' +
            (isBurst ? ' burst-drop' : '');

        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.borderRadius = '50%';

        element.style.setProperty(
            'background',
            cursorThemeColor,
            'important'
        );

        element.style.pointerEvents = 'none';
        element.style.willChange = 'transform';

        element.style.transform =
            `translate(` +
            `${x.toFixed(1)}px, ` +
            `${y.toFixed(1)}px)`;

        cursorEl.appendChild(element);

        tempDrops.push({
            el: element,
            x,
            y,
            vx: vx || 0,
            vy: vy || 0,
            size,
            life,
            maxLife: life,
            isBurst
        });
    }

    function getOrganicRadius(now, offset, amplitude) {
        const t = now * 0.0105;

        const r1 =
            50 +
            (
                Math.sin(t + offset) * 15 +
                Math.cos(
                    t * 0.63 + offset * 1.3
                ) * 7
            ) * amplitude;

        const r3 =
            50 +
            (
                Math.sin(
                    t * 0.81 + offset * 0.7
                ) * 13 +
                Math.cos(
                    t * 2.11 + offset * 1.8
                ) * 5
            ) * amplitude;

        const r5 =
            50 +
            (
                Math.sin(
                    t * 1.05 + offset * 1.6
                ) * 15 +
                Math.cos(
                    t * 1.71 + offset * 0.9
                ) * 4
            ) * amplitude;

        const r7 =
            50 +
            (
                Math.sin(
                    t * 1.24 + offset * 1.9
                ) * 13 +
                Math.cos(
                    t * 0.95 + offset * 0.3
                ) * 6
            ) * amplitude;

        return (
            `${r1.toFixed(1)}% ` +
            `${(100 - r1).toFixed(1)}% ` +
            `${r3.toFixed(1)}% ` +
            `${(100 - r3).toFixed(1)}% / ` +
            `${r5.toFixed(1)}% ` +
            `${(100 - r5).toFixed(1)}% ` +
            `${r7.toFixed(1)}% ` +
            `${(100 - r7).toFixed(1)}%`
        );
    }

    function initCursor() {
        if (cursorEl || !finePointer) return;

        buildGooeyFilter();
        injectCursorStyles();

        cursorEl =
            document.createElement('div');

        cursorEl.className = 'liquid-cursor';

        document.body.appendChild(cursorEl);

        if (!window.__useSystemCursor) {
            document.documentElement.classList.add(
                'has-custom-cursor'
            );
        }

        cursorEl.style.opacity = '0';

        cursorNodes = [];

        for (let i = 0; i < DROP_N; i++) {
            const node =
                document.createElement('div');

            node.className = 'drop-node';

            node.style.width =
                `${BASE_SIZES[i]}px`;

            node.style.height =
                `${BASE_SIZES[i]}px`;

            node.style.transform =
                'translate3d(-50%, -50%, 0)';

            node.style.setProperty(
                'background',
                cursorThemeColor,
                'important'
            );

            cursorEl.appendChild(node);
            cursorNodes.push(node);
        }

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        headX = centerX;
        headY = centerY;

        bodyX = centerX;
        bodyY = centerY;

        tailX = centerX;
        tailY = centerY;

        mouseX = centerX;
        mouseY = centerY;

        initX = centerX;
        initY = centerY;

        lastMouseX = centerX;
        lastMouseY = centerY;

        let currentHoveredHost = null;
        let suppressedInteractiveHost = null;
        let hasPointerPosition = false;

        const interactiveFromTarget = target => {
            const interactive = target
                ? target.closest(
                    '.ripple-host, ' +
                    'a, ' +
                    'button, ' +
                    '.lang-switcher-btn, ' +
                    '.theme-toggle'
                )
                : null;

            if (interactive?.matches('.nav-item.active')) {
                return null;
            }

            return interactive === suppressedInteractiveHost
                ? null
                : interactive;
        };

        /*
         * Burst detection uses a separate, noise-resistant motion signal.
         *
         * The cursor itself still follows every pointer update, but bursts are
         * based on a short regression window and a small state machine. This
         * prevents a single noisy mouse report from looking like enormous
         * acceleration while still detecting intentional starts, stops and
         * large direction changes.
         */
        const gestureSamples = [
            {
                x: centerX,
                y: centerY,
                time: performance.now()
            }
        ];

        let gestureVx = 0;
        let gestureVy = 0;
        let gestureMoving = false;
        let motionEvidenceMs = 0;
        let quietEvidenceMs = 0;
        let turnEvidenceMs = 0;
        let stableDirectionX = 0;
        let stableDirectionY = 0;

        function recordGestureSample(x, y, time) {
            const last =
                gestureSamples[
                    gestureSamples.length - 1
                ];

            if (last && time <= last.time) {
                last.x = x;
                last.y = y;
                return;
            }

            gestureSamples.push({ x, y, time });

            const cutoff = time - 120;

            while (
                gestureSamples.length > 2 &&
                gestureSamples[1].time < cutoff
            ) {
                gestureSamples.shift();
            }
        }

        function estimateGestureVelocity(now) {
            const windowStart = now - 72;
            const samples = gestureSamples.filter(
                sample => sample.time >= windowStart
            );

            if (samples.length < 3) {
                return {
                    vx: 0,
                    vy: 0,
                    confident: false
                };
            }

            const first = samples[0];
            const last = samples[samples.length - 1];
            const span = last.time - first.time;

            if (span < 18) {
                return {
                    vx: 0,
                    vy: 0,
                    confident: false
                };
            }

            let meanTime = 0;
            let meanX = 0;
            let meanY = 0;
            let pathLength = 0;

            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];

                meanTime += sample.time;
                meanX += sample.x;
                meanY += sample.y;

                if (i > 0) {
                    const previous = samples[i - 1];

                    pathLength += Math.hypot(
                        sample.x - previous.x,
                        sample.y - previous.y
                    );
                }
            }

            meanTime /= samples.length;
            meanX /= samples.length;
            meanY /= samples.length;

            let timeVariance = 0;
            let covarianceX = 0;
            let covarianceY = 0;

            for (const sample of samples) {
                const timeOffset =
                    sample.time - meanTime;

                timeVariance +=
                    timeOffset * timeOffset;

                covarianceX +=
                    timeOffset *
                    (sample.x - meanX);

                covarianceY +=
                    timeOffset *
                    (sample.y - meanY);
            }

            if (timeVariance < 1) {
                return {
                    vx: 0,
                    vy: 0,
                    confident: false
                };
            }

            const netDistance = Math.hypot(
                last.x - first.x,
                last.y - first.y
            );

            const straightness =
                pathLength > 0
                    ? netDistance / pathLength
                    : 0;

            /*
             * Ignore tiny or incoherent paths. Random sensor jitter tends to
             * have little net travel and low straightness, even if one report
             * contains a relatively large coordinate jump.
             */
            const confident =
                pathLength >= 6 &&
                netDistance >= 4 &&
                straightness >= 0.55;

            const sampleAge = now - last.time;
            const freshness =
                sampleAge <= 28
                    ? 1
                    : clamp(
                        1 -
                            (sampleAge - 28) /
                                44,
                        0,
                        1
                    );

            return {
                vx:
                    (
                        covarianceX /
                        timeVariance
                    ) *
                    REFERENCE_FRAME_MS *
                    freshness,
                vy:
                    (
                        covarianceY /
                        timeVariance
                    ) *
                    REFERENCE_FRAME_MS *
                    freshness,
                confident:
                    confident && freshness > 0
            };
        }

        function detectGestureBurst(
            now,
            deltaMs,
            deltaFrames
        ) {
            const estimate =
                estimateGestureVelocity(now);

            const gestureAlpha =
                frameAlpha(0.28, deltaFrames);

            gestureVx = lerp(
                gestureVx,
                estimate.vx,
                gestureAlpha
            );

            gestureVy = lerp(
                gestureVy,
                estimate.vy,
                gestureAlpha
            );

            const gestureSpeed =
                Math.hypot(gestureVx, gestureVy);

            if (!gestureMoving) {
                if (
                    estimate.confident &&
                    gestureSpeed >= 10
                ) {
                    motionEvidenceMs += deltaMs;
                } else {
                    motionEvidenceMs = Math.max(
                        0,
                        motionEvidenceMs -
                            deltaMs * 1.5
                    );
                }

                if (motionEvidenceMs >= 55) {
                    gestureMoving = true;
                    motionEvidenceMs = 0;
                    quietEvidenceMs = 0;

                    stableDirectionX =
                        gestureVx / gestureSpeed;

                    stableDirectionY =
                        gestureVy / gestureSpeed;

                    return 'start';
                }

                return null;
            }

            if (
                gestureSpeed <= 0.9 ||
                !estimate.confident
            ) {
                quietEvidenceMs += deltaMs;
            } else {
                quietEvidenceMs = Math.max(
                    0,
                    quietEvidenceMs -
                        deltaMs * 2
                );
            }

            if (quietEvidenceMs >= 64) {
                gestureMoving = false;
                quietEvidenceMs = 0;
                turnEvidenceMs = 0;
                stableDirectionX = 0;
                stableDirectionY = 0;

                /*
                 * Stopping only resets the gesture state. Bursts are reserved
                 * for intentional starts and large direction changes.
                 */
                return null;
            }

            if (
                estimate.confident &&
                gestureSpeed >= 8
            ) {
                const directionX =
                    gestureVx / gestureSpeed;

                const directionY =
                    gestureVy / gestureSpeed;

                const directionDot =
                    directionX *
                        stableDirectionX +
                    directionY *
                        stableDirectionY;

                /*
                 * dot <= -0.35 means roughly 110 degrees or more. Requiring the
                 * direction to persist for multiple frames filters out the
                 * alternating one-pixel noise common with high-DPI mice.
                 */
                if (directionDot <= -0.35) {
                    turnEvidenceMs += deltaMs;
                } else {
                    turnEvidenceMs = Math.max(
                        0,
                        turnEvidenceMs -
                            deltaMs * 2
                    );
                }

                if (turnEvidenceMs >= 48) {
                    stableDirectionX = directionX;
                    stableDirectionY = directionY;
                    turnEvidenceMs = 0;

                    return 'turn';
                }

                if (directionDot > 0.65) {
                    const directionAlpha =
                        frameAlpha(
                            0.08,
                            deltaFrames
                        );

                    const blendedX = lerp(
                        stableDirectionX,
                        directionX,
                        directionAlpha
                    );

                    const blendedY = lerp(
                        stableDirectionY,
                        directionY,
                        directionAlpha
                    );

                    const blendedLength =
                        Math.hypot(
                            blendedX,
                            blendedY
                        ) || 1;

                    stableDirectionX =
                        blendedX / blendedLength;

                    stableDirectionY =
                        blendedY / blendedLength;
                }
            }

            return null;
        }

        function updateElementHoverState(
            clientX,
            clientY,
            suppressTransitionEffects = false
        ) {
            if (
                typeof document.elementFromPoint !==
                    'function' ||
                !cursorEl
            ) {
                return;
            }

            const target =
                document.elementFromPoint(
                    clientX,
                    clientY
                );

            const ripple = interactiveFromTarget(target);

            if (ripple === currentHoveredHost) {
                /*
                 * A fast leave/re-enter can occur between two global pointer
                 * samples. If the DOM hit target is unchanged but the host's
                 * local state was cleared, immediately repair that state.
                 */
                if (
                    ripple &&
                    !ripple._motionHoverActive
                ) {
                    ripple.dispatchEvent(
                        new PointerEvent(
                            'pointerenter',
                            {
                                bubbles: true,
                                cancelable: true,
                                clientX,
                                clientY
                            }
                        )
                    );
                }

                return;
            }

            const wasInteractive =
                Boolean(currentHoveredHost);

            const isInteractive =
                Boolean(ripple);

            if (currentHoveredHost) {
                currentHoveredHost.dispatchEvent(
                    new PointerEvent(
                        'pointerleave',
                        {
                            bubbles: true,
                            cancelable: true,
                            clientX,
                            clientY
                        }
                    )
                );
            }

            if (
                wasInteractive &&
                !isInteractive &&
                !suppressTransitionEffects
            ) {
                if (stickyAnchor) {
                    stickyAnchor.el.remove();
                }

                const anchorElement =
                    document.createElement('div');

                anchorElement.className =
                    'drop-node sticky-anchor';

                anchorElement.style.width = '16px';
                anchorElement.style.height = '16px';
                anchorElement.style.position =
                    'absolute';

                anchorElement.style.borderRadius =
                    '50%';

                anchorElement.style.setProperty(
                    'background',
                    cursorThemeColor,
                    'important'
                );

                anchorElement.style.pointerEvents =
                    'none';

                anchorElement.style.willChange =
                    'transform';

                cursorEl.appendChild(anchorElement);

                stickyAnchor = {
                    el: anchorElement,
                    x: headX,
                    y: headY
                };

                const burstCount =
                    6 + Math.floor(Math.random() * 3);

                for (
                    let i = 0;
                    i < burstCount;
                    i++
                ) {
                    const angle =
                        Math.random() *
                        Math.PI *
                        2;

                    const speed =
                        1.5 +
                        Math.random() * 2;

                    spawnDrop(
                        headX,
                        headY,
                        6 + Math.random() * 3,
                        0.35 +
                            Math.random() * 0.2,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        true
                    );
                }
            }

            if (
                suppressTransitionEffects &&
                stickyAnchor
            ) {
                stickyAnchor.el.remove();
                stickyAnchor = null;
            }

            currentHoveredHost = ripple;

            if (currentHoveredHost) {
                currentHoveredHost.dispatchEvent(
                    new PointerEvent(
                        'pointerenter',
                        {
                            bubbles: true,
                            cancelable: true,
                            clientX,
                            clientY
                        }
                    )
                );
            }

            if (
                isInteractive &&
                !wasInteractive
            ) {
                const rect =
                    ripple.getBoundingClientRect();

                const buttonCenterX =
                    rect.left + rect.width / 2;

                const buttonCenterY =
                    rect.top + rect.height / 2;

                headX = lerp(
                    headX,
                    buttonCenterX,
                    0.4
                );

                headY = lerp(
                    headY,
                    buttonCenterY,
                    0.4
                );

                const burstCount =
                    8 + Math.floor(Math.random() * 3);

                for (
                    let i = 0;
                    i < burstCount;
                    i++
                ) {
                    const angle =
                        Math.random() *
                        Math.PI *
                        2;

                    const speed =
                        1.8 +
                        Math.random() * 2.8;

                    spawnDrop(
                        clientX,
                        clientY,
                        7 + Math.random() * 3.5,
                        0.45 +
                            Math.random() * 0.25,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        true
                    );
                }
            }
        }

        const updateCursorState = (x, y) => {
            const target =
                document.elementFromPoint(x, y);

            if (!target) return;

            const nav = target.closest(
                '.nav-item, .logo'
            );

            const ripple = interactiveFromTarget(target);

            cursorEl.classList.toggle(
                'on-nav',
                Boolean(nav && !ripple)
            );

            cursorEl.classList.toggle(
                'on-ripple',
                Boolean(ripple)
            );

            isHoveringInteract =
                Boolean(ripple);
        };

        const onMove = event => {
            if (suppressedInteractiveHost) {
                const target =
                    document.elementFromPoint(
                        event.clientX,
                        event.clientY
                    );

                if (
                    !target ||
                    !suppressedInteractiveHost.contains(
                        target
                    )
                ) {
                    suppressedInteractiveHost = null;
                }
            }

            mouseX = event.clientX;
            mouseY = event.clientY;
            hasPointerPosition = true;

            recordGestureSample(
                mouseX,
                mouseY,
                performance.now()
            );

            updateElementHoverState(
                event.clientX,
                event.clientY
            );

            updateCursorState(
                event.clientX,
                event.clientY
            );
        };

        document.addEventListener(
            'motion-force-pointer-exit',
            event => {
                const host = event.detail?.host;

                if (!host) return;

                suppressedInteractiveHost = host;
                updateElementHoverState(
                    event.detail?.clientX ?? mouseX,
                    event.detail?.clientY ?? mouseY,
                    Boolean(event.detail?.silent)
                );
                if (event.detail?.suppressUntilMove === false) {
                    suppressedInteractiveHost = null;
                }
                updateCursorState(
                    event.detail?.clientX ?? mouseX,
                    event.detail?.clientY ?? mouseY
                );
            }
        );

        let lastTickTime = null;

        function tick(now) {
            if (!cursorEl) return;

            /*
             * deltaFrames = 相对于 60 Hz 的时间倍率：
             *
             * 60 Hz 约为 1
             * 120 Hz 约为 0.5
             * 30 Hz 约为 2
             */
            const deltaMs =
                lastTickTime === null
                    ? REFERENCE_FRAME_MS
                    : clamp(
                        now - lastTickTime,
                        0,
                        MAX_DELTA_MS
                    );

            lastTickTime = now;

            // The cursor is invisible over an iframe. Avoid running its costly
            // liquid simulation until it can be seen again.
            if (
                cursorEl.classList.contains(
                    'cursor-in-iframe'
                )
            ) {
                requestAnimationFrame(tick);
                return;
            }

            const deltaSeconds =
                deltaMs * 0.001;

            const deltaFrames =
                deltaMs / REFERENCE_FRAME_MS;

            const safeDeltaFrames =
                Math.max(deltaFrames, 0.001);

            const html =
                document.documentElement;

            if (window.__useSystemCursor) {
                html.classList.add(
                    'show-system-cursor'
                );

                if (
                    !html.classList.contains(
                        'has-custom-cursor'
                    )
                ) {
                    html.classList.add(
                        'has-custom-cursor'
                    );
                }
            } else {
                html.classList.remove(
                    'show-system-cursor'
                );

                if (
                    !html.classList.contains(
                        'has-custom-cursor'
                    )
                ) {
                    html.classList.add(
                        'has-custom-cursor'
                    );
                }
            }

            const hoveredTarget =
                document.elementFromPoint(
                    mouseX,
                    mouseY
                );

            if (hoveredTarget) {
                const ripple =
                    interactiveFromTarget(hoveredTarget);

                const nav =
                    hoveredTarget.closest(
                        '.nav-item, .logo'
                    );

                isHoveringInteract =
                    Boolean(ripple);

                cursorEl.classList.toggle(
                    'on-nav',
                    Boolean(nav && !ripple)
                );

                cursorEl.classList.toggle(
                    'on-ripple',
                    Boolean(ripple)
                );
            }

            /*
             * 瞬时位移除以 deltaFrames，
             * 将速度统一成“每个 60 Hz 参考帧的像素数”。
             */
            const instantVx =
                (mouseX - lastMouseX) /
                safeDeltaFrames;

            const instantVy =
                (mouseY - lastMouseY) /
                safeDeltaFrames;

            lastMouseX = mouseX;
            lastMouseY = mouseY;

            const velocityAlpha =
                frameAlpha(0.35, deltaFrames);

            mouseVx = lerp(
                mouseVx,
                instantVx,
                velocityAlpha
            );

            mouseVy = lerp(
                mouseVy,
                instantVy,
                velocityAlpha
            );

            const speed =
                Math.hypot(mouseVx, mouseVy);

            const gestureBurst =
                detectGestureBurst(
                    now,
                    deltaMs,
                    deltaFrames
                );

            const mouseDirectionX =
                speed > 0.1
                    ? mouseVx / speed
                    : 0;

            const mouseDirectionY =
                speed > 0.1
                    ? mouseVy / speed
                    : 0;

            const predictionFactor =
                speed < 1 ? 0 : 0.6;

            const predictedX =
                mouseX +
                mouseVx * predictionFactor;

            const predictedY =
                mouseY +
                mouseVy * predictionFactor;

            const headAlpha =
                frameAlpha(0.95, deltaFrames);

            headX +=
                (predictedX - headX) *
                headAlpha;

            headY +=
                (predictedY - headY) *
                headAlpha;

            const isIdle = speed < 0.25;

            let targetBodyX = headX;
            let targetBodyY = headY;
            let targetTailX = headX;
            let targetTailY = headY;

            if (!isIdle) {
                const bodyAlpha =
                    frameAlpha(
                        0.4,
                        deltaFrames
                    );

                bodyX +=
                    (headX - bodyX) *
                    bodyAlpha;

                bodyY +=
                    (headY - bodyY) *
                    bodyAlpha;

                const bodyDx =
                    bodyX - headX;

                const bodyDy =
                    bodyY - headY;

                const bodyDistance =
                    Math.hypot(
                        bodyDx,
                        bodyDy
                    );

                const maxBodyDistance =
                    currentHeadSize * 0.6;

                if (
                    bodyDistance >
                        maxBodyDistance &&
                    bodyDistance > 0
                ) {
                    bodyX =
                        headX +
                        (
                            bodyDx /
                            bodyDistance
                        ) * maxBodyDistance;

                    bodyY =
                        headY +
                        (
                            bodyDy /
                            bodyDistance
                        ) * maxBodyDistance;
                }

                targetBodyX = bodyX;
                targetBodyY = bodyY;

                const tailAlpha =
                    frameAlpha(
                        0.35,
                        deltaFrames
                    );

                tailX +=
                    (bodyX - tailX) *
                    tailAlpha;

                tailY +=
                    (bodyY - tailY) *
                    tailAlpha;

                const tailDx =
                    tailX - bodyX;

                const tailDy =
                    tailY - bodyY;

                const tailDistance =
                    Math.hypot(
                        tailDx,
                        tailDy
                    );

                const maxTailDistance =
                    currentBodySize * 0.8;

                if (
                    tailDistance >
                        maxTailDistance &&
                    tailDistance > 0
                ) {
                    tailX =
                        bodyX +
                        (
                            tailDx /
                            tailDistance
                        ) * maxTailDistance;

                    tailY =
                        bodyY +
                        (
                            tailDy /
                            tailDistance
                        ) * maxTailDistance;
                }

                targetTailX = tailX;
                targetTailY = tailY;
            }

            if (stickyAnchor) {
                const dx =
                    headX - stickyAnchor.x;

                const dy =
                    headY - stickyAnchor.y;

                const distance =
                    Math.hypot(dx, dy);

                const snapDistance = 38;

                if (distance < snapDistance) {
                    const stickyAlpha =
                        frameAlpha(
                            0.08,
                            deltaFrames
                        );

                    stickyAnchor.x +=
                        dx * stickyAlpha;

                    stickyAnchor.y +=
                        dy * stickyAlpha;

                    const currentSize =
                        16 *
                        (
                            1 -
                            distance /
                                snapDistance
                        );

                    stickyAnchor.el.style.width =
                        `${currentSize.toFixed(1)}px`;

                    stickyAnchor.el.style.height =
                        `${currentSize.toFixed(1)}px`;

                    stickyAnchor.el.style.transform =
                        `translate3d(` +
                        `${stickyAnchor.x.toFixed(1)}px, ` +
                        `${stickyAnchor.y.toFixed(1)}px, ` +
                        `0) translate(-50%, -50%)`;
                } else {
                    const snapX =
                        (
                            headX +
                            stickyAnchor.x
                        ) / 2;

                    const snapY =
                        (
                            headY +
                            stickyAnchor.y
                        ) / 2;

                    for (let i = 0; i < 7; i++) {
                        const angle =
                            Math.random() *
                            Math.PI *
                            2;

                        const dropSpeed =
                            1.5 +
                            Math.random() * 3;

                        spawnDrop(
                            snapX,
                            snapY,
                            7.5 +
                                Math.random() * 3.5,
                            0.35 +
                                Math.random() * 0.25,
                            Math.cos(angle) *
                                dropSpeed,
                            Math.sin(angle) *
                                dropSpeed,
                            true
                        );
                    }

                    stickyAnchor.el.remove();
                    stickyAnchor = null;
                }
            }

            if (
                !isHoveringInteract &&
                gestureBurst &&
                now - lastBurstTime > 320
            ) {
                lastBurstTime = now;

                const burstCount =
                    8 +
                    Math.floor(Math.random() * 3);

                for (
                    let i = 0;
                    i < burstCount;
                    i++
                ) {
                    const angle =
                        Math.random() *
                        Math.PI *
                        2;

                    const dropSpeed =
                        1.8 +
                        Math.random() * 2.8;

                    spawnDrop(
                        headX,
                        headY,
                        7 + Math.random() * 3.5,
                        0.45 +
                            Math.random() * 0.25,
                        Math.cos(angle) *
                            dropSpeed,
                        Math.sin(angle) *
                            dropSpeed,
                        true
                    );
                }
            }

            if (!isHoveringInteract) {
                if (!isIdle && speed > 4) {
                    spawnTimer += deltaFrames;

                    if (
                        spawnTimer >
                        spawnThreshold
                    ) {
                        spawnTimer = 0;

                        spawnThreshold =
                            2 +
                            Math.floor(
                                Math.random() * 17
                            );

                        const count =
                            1 +
                            Math.floor(
                                Math.random() * 3
                            );

                        for (
                            let i = 0;
                            i < count;
                            i++
                        ) {
                            const baseAngle =
                                Math.atan2(
                                    mouseVy,
                                    mouseVx
                                ) + Math.PI;

                            const spread =
                                (
                                    Math.random() -
                                    0.5
                                ) * 0.8;

                            const angle =
                                baseAngle + spread;

                            const distance =
                                currentTailSize *
                                (
                                    0.3 +
                                    Math.random() *
                                        0.5
                                );

                            const spawnX =
                                tailX +
                                Math.cos(angle) *
                                    distance;

                            const spawnY =
                                tailY +
                                Math.sin(angle) *
                                    distance;

                            const inertia =
                                speed *
                                (
                                    0.2 +
                                    Math.random() *
                                        0.3
                                );

                            const vx =
                                mouseDirectionX *
                                    inertia +
                                (
                                    Math.random() -
                                    0.5
                                ) * 0.6;

                            const vy =
                                mouseDirectionY *
                                    inertia +
                                (
                                    Math.random() -
                                    0.5
                                ) * 0.6;

                            spawnDrop(
                                spawnX,
                                spawnY,
                                7 +
                                    Math.random() *
                                        4.5,
                                0.25 +
                                    Math.random() *
                                        0.25,
                                vx,
                                vy
                            );
                        }
                    }
                } else if (isIdle) {
                    spawnTimer += deltaFrames;

                    if (spawnTimer > 60) {
                        spawnTimer = 0;

                        const spawnX =
                            headX +
                            (
                                Math.random() -
                                0.5
                            ) * 10;

                        const spawnY =
                            headY +
                            (
                                Math.random() -
                                0.5
                            ) * 10;

                        spawnDrop(
                            spawnX,
                            spawnY,
                            3 +
                                Math.random() * 3,
                            0.5 +
                                Math.random() * 0.4,
                            (
                                Math.random() -
                                0.5
                            ) * 0.3,
                            (
                                Math.random() -
                                0.5
                            ) * 0.3
                        );
                    }
                }
            }

            if (isHoveringInteract) {
                currentHeadSize = 0;
                currentBodySize = 0;
                currentTailSize = 0;

                for (let i = 0; i < 3; i++) {
                    cursorNodes[i].style.width =
                        '0px';

                    cursorNodes[i].style.height =
                        '0px';

                    cursorNodes[i].style.opacity =
                        '0';
                }

                for (
                    let i =
                        tempDrops.length - 1;
                    i >= 0;
                    i--
                ) {
                    if (!tempDrops[i].isBurst) {
                        if (tempDrops[i].el) {
                            tempDrops[i].el.remove();
                        }

                        tempDrops.splice(i, 1);
                    }
                }

                if (stickyAnchor) {
                    stickyAnchor.el.remove();
                    stickyAnchor = null;
                }

                spawnTimer = 0;
            } else {
                const sizeAlpha =
                    frameAlpha(
                        0.15,
                        deltaFrames
                    );

                currentHeadSize +=
                    (
                        BASE_SIZES[0] -
                        currentHeadSize
                    ) * sizeAlpha;

                currentBodySize +=
                    (
                        BASE_SIZES[1] -
                        currentBodySize
                    ) * sizeAlpha;

                currentTailSize +=
                    (
                        BASE_SIZES[2] -
                        currentTailSize
                    ) * sizeAlpha;

                cursorNodes[0].style.width =
                    `${currentHeadSize.toFixed(1)}px`;

                cursorNodes[0].style.height =
                    `${currentHeadSize.toFixed(1)}px`;

                cursorNodes[0].style.opacity = '';

                cursorNodes[1].style.width =
                    `${currentBodySize.toFixed(1)}px`;

                cursorNodes[1].style.height =
                    `${currentBodySize.toFixed(1)}px`;

                cursorNodes[1].style.opacity = '';

                cursorNodes[2].style.width =
                    `${currentTailSize.toFixed(1)}px`;

                cursorNodes[2].style.height =
                    `${currentTailSize.toFixed(1)}px`;

                cursorNodes[2].style.opacity = '';
            }

            if (clickSplitTime > 0) {
                clickSplitTime = Math.max(
                    0,
                    clickSplitTime -
                        deltaSeconds / 0.35
                );

                const split =
                    Math.sin(
                        clickSplitTime * Math.PI
                    ) * 15;

                bodyX +=
                    split *
                    0.3 *
                    deltaFrames;

                bodyY +=
                    split *
                    0.3 *
                    deltaFrames;

                tailX +=
                    split *
                    0.5 *
                    deltaFrames;

                tailY +=
                    split *
                    0.5 *
                    deltaFrames;
            }

            const targetAmplitude =
                isIdle ? 1 : 0;

            morphAmp = lerp(
                morphAmp,
                targetAmplitude,
                frameAlpha(
                    0.1,
                    deltaFrames
                )
            );

            cursorNodes[0].style.borderRadius =
                getOrganicRadius(
                    now,
                    0,
                    morphAmp
                );

            cursorNodes[1].style.borderRadius =
                getOrganicRadius(
                    now,
                    2.5,
                    morphAmp
                );

            cursorNodes[2].style.borderRadius =
                getOrganicRadius(
                    now,
                    5,
                    morphAmp
                );

            if (isIdle) {
                idleTime += deltaSeconds;

                if (idleTime > 2) {
                    idleTime = 0;

                    const spawnX =
                        headX +
                        (
                            Math.random() -
                            0.5
                        ) * 3;

                    const spawnY =
                        headY +
                        BASE_SIZES[0] * 0.4;

                    spawnDrop(
                        spawnX,
                        spawnY,
                        8,
                        0.45,
                        (
                            Math.random() -
                            0.5
                        ) * 0.1,
                        1.8 +
                            Math.random() * 1.2
                    );
                }
            } else {
                idleTime = 0;
            }

            cursorNodes[0].style.transform =
                `translate3d(` +
                `${headX.toFixed(1)}px, ` +
                `${headY.toFixed(1)}px, ` +
                `0) translate(-50%, -50%)`;

            cursorNodes[1].style.transform =
                `translate3d(` +
                `${targetBodyX.toFixed(1)}px, ` +
                `${targetBodyY.toFixed(1)}px, ` +
                `0) translate(-50%, -50%)`;

            cursorNodes[2].style.transform =
                `translate3d(` +
                `${targetTailX.toFixed(1)}px, ` +
                `${targetTailY.toFixed(1)}px, ` +
                `0) translate(-50%, -50%)`;

            for (
                let i = tempDrops.length - 1;
                i >= 0;
                i--
            ) {
                const drop = tempDrops[i];

                drop.life -= deltaSeconds;

                if (drop.life <= 0) {
                    drop.el.remove();
                    tempDrops.splice(i, 1);
                    continue;
                }

                drop.x +=
                    drop.vx * deltaFrames;

                drop.y +=
                    drop.vy * deltaFrames;

                const particleDamping =
                    Math.pow(
                        0.91,
                        deltaFrames
                    );

                drop.vx *= particleDamping;

                /*
                 * 0.14 / (1 - 0.91) 是原离散系统的
                 * 终端速度。该表达式可在可变时间步下
                 * 保持原有阻尼与重力效果。
                 */
                drop.vy =
                    drop.vy *
                        particleDamping +
                    (
                        0.14 /
                        (1 - 0.91)
                    ) *
                    (1 - particleDamping);

                const scale =
                    0.5 +
                    (
                        drop.life /
                        drop.maxLife
                    ) * 0.7;

                drop.el.style.transform =
                    `translate3d(` +
                    `${drop.x.toFixed(1)}px, ` +
                    `${drop.y.toFixed(1)}px, ` +
                    `0) translate(-50%, -50%) ` +
                    `scale(${scale.toFixed(2)})`;
            }

            magneticElapsedMs += deltaMs;

            if (
                magneticElapsedMs >=
                REFERENCE_FRAME_MS
            ) {
                const magneticDeltaFrames =
                    magneticElapsedMs /
                    REFERENCE_FRAME_MS;

                for (const host of _rippleHosts) {
                    if (host._magneticSpring) {
                        host._magneticSpring(
                            magneticDeltaFrames
                        );
                    }
                }

                magneticElapsedMs %=
                    REFERENCE_FRAME_MS;
            }

            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);

        window.addEventListener(
            'pointermove',
            onMove,
            { passive: true }
        );

        let scrollHoverFrame = null;

        window.addEventListener(
            'scroll',
            () => {
                if (
                    !cursorEl ||
                    !hasPointerPosition ||
                    scrollHoverFrame !== null
                ) {
                    return;
                }

                scrollHoverFrame =
                    requestAnimationFrame(() => {
                        scrollHoverFrame = null;

                        /*
                         * A stationary pointer does not reliably emit native
                         * enter/leave events when scrolling moves a new
                         * element beneath it. Re-run hit testing once per
                         * animation frame so ripple and hover state stay in
                         * sync with the visual element under the cursor.
                         */
                        updateElementHoverState(
                            mouseX,
                            mouseY
                        );

                        updateCursorState(
                            mouseX,
                            mouseY
                        );

                        for (
                            const host of _rippleHosts
                        ) {
                            if (host._scrollTick) {
                                host._scrollTick();
                            }
                        }
                    });
            },
            { passive: true }
        );

        window.addEventListener(
            'pointerdown',
            event => {
                const localX = event.clientX;
                const localY = event.clientY;

                const burstCount =
                    10 +
                    Math.floor(Math.random() * 4);

                for (
                    let i = 0;
                    i < burstCount;
                    i++
                ) {
                    const angle =
                        Math.random() *
                        Math.PI *
                        2;

                    const speed =
                        2 +
                        Math.random() * 3.5;

                    spawnDrop(
                        localX,
                        localY,
                        6 + Math.random() * 4,
                        0.5 +
                            Math.random() * 0.3,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        true
                    );
                }

                clickSplitTime = 1;
            }
        );

        const setIframeCursorState = insideIframe => {
            if (!cursorEl) return;

            cursorEl.classList.toggle(
                'cursor-in-iframe',
                insideIframe
            );

            document.documentElement.classList.toggle(
                'has-custom-cursor',
                finePointer && !insideIframe
            );
        };

        const pointerIsInIframe = () => {
            const hoveredIframe =
                document.querySelector(
                    'iframe:hover'
                );

            if (hoveredIframe) {
                return true;
            }

            if (
                hasPointerPosition &&
                typeof document.elementFromPoint ===
                    'function'
            ) {
                const target =
                    document.elementFromPoint(
                        mouseX,
                        mouseY
                    );

                if (target) {
                    return target.tagName ===
                        'IFRAME';
                }
            }

            const activeElement =
                document.activeElement;

            return Boolean(
                activeElement &&
                activeElement.tagName === 'IFRAME'
            );
        };

        const syncIframeCursorState = () => {
            setIframeCursorState(
                pointerIsInIframe()
            );
        };

        document.documentElement.addEventListener(
            'mouseleave',
            () => {
                setIframeCursorState(true);
            }
        );

        document.documentElement.addEventListener(
            'mouseenter',
            event => {
                if (!cursorEl) return;

                setIframeCursorState(false);

                cursorEl.style.opacity = '';

                mouseX = event.clientX;
                mouseY = event.clientY;
                hasPointerPosition = true;

                lastMouseX = mouseX;
                lastMouseY = mouseY;

                gestureSamples.length = 0;

                recordGestureSample(
                    mouseX,
                    mouseY,
                    performance.now()
                );

                gestureVx = 0;
                gestureVy = 0;
                gestureMoving = false;
                motionEvidenceMs = 0;
                quietEvidenceMs = 0;
                turnEvidenceMs = 0;
                stableDirectionX = 0;
                stableDirectionY = 0;

                headX = mouseX;
                headY = mouseY;

                bodyX = mouseX;
                bodyY = mouseY;

                tailX = mouseX;
                tailY = mouseY;

                const target =
                    document.elementFromPoint(
                        mouseX,
                        mouseY
                    );

                const ripple =
                    interactiveFromTarget(target);

                isHoveringInteract =
                    Boolean(ripple);

                if (isHoveringInteract) {
                    currentHeadSize = 0;
                    currentBodySize = 0;
                    currentTailSize = 0;

                    for (
                        let i = 0;
                        i < 3;
                        i++
                    ) {
                        cursorNodes[i].style.width =
                            '0px';

                        cursorNodes[i].style.height =
                            '0px';

                        cursorNodes[i].style.opacity =
                            '0';
                    }
                }

                updateElementHoverState(
                    mouseX,
                    mouseY
                );

                updateCursorState(
                    mouseX,
                    mouseY
                );

                syncIframeCursorState();
            }
        );

        document.addEventListener(
            'pointerover',
            event => {
                if (
                    event.target &&
                    event.target.tagName === 'IFRAME'
                ) {
                    if (currentHoveredHost) {
                        suppressedInteractiveHost =
                            currentHoveredHost;
                        updateElementHoverState(
                            event.clientX,
                            event.clientY,
                            true
                        );
                        suppressedInteractiveHost = null;
                    }

                    setIframeCursorState(true);
                } else {
                    setIframeCursorState(false);
                }
            }
        );

        document.addEventListener(
            'pointerdown',
            event => {
                if (
                    event.target &&
                    event.target.closest(
                        '.game-start-btn'
                    )
                ) {
                    setIframeCursorState(true);
                }
            }
        );

        // Returning from another application does not always produce a new
        // pointerover event. Re-check both focus ownership and the last known
        // pointer position after the browser regains focus.
        window.addEventListener(
            'focus',
            () => {
                requestAnimationFrame(
                    syncIframeCursorState
                );
            }
        );

        window.addEventListener(
            'blur',
            () => {
                setTimeout(
                    syncIframeCursorState,
                    0
                );
            }
        );

        document.addEventListener(
            'visibilitychange',
            () => {
                if (!document.hidden) {
                    requestAnimationFrame(
                        syncIframeCursorState
                    );
                }
            }
        );

        syncCursorThemeColor();

        const cursorThemeObserver =
            new MutationObserver(
                mutations => {
                    if (
                        mutations.some(
                            mutation =>
                                mutation.attributeName ===
                                'data-theme'
                        )
                    ) {
                        syncCursorThemeColor();
                    }
                }
            );

        cursorThemeObserver.observe(
            document.documentElement,
            {
                attributes: true,
                attributeFilter: ['data-theme']
            }
        );
    }

    function init() {
        initOrbGL();
        // This loop also drives the Artworks columns. Keep it running when
        // WebGL orbs are active; the hidden CSS-orb fallback costs no layout.
        startAmbientLoop();

        initContourGL();
        initRipples();
        initArtColumns();
        initCursor();
    }

    window.MotionUX = {
        init,
        sweepIn,
        sweepOut,
        fxCircle,
        abortSweep,
        setCursorTheme
    };

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }
})();
