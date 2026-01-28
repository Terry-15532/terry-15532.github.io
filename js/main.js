// Global registry for DotControllers (for performance optimization)
window._dotControllers = {};
let _dotControllerIdCounter = 0;

// Constants
const LOADER_HTML = `<div id="loader"><div class="spinner"></div></div>`;
const LIGHTBOX_HTML = `
    <div id="lightbox">
        <div id="lightbox-close">×</div>
        <img src="" alt="Full Size Art">
    </div>`;

// Utility functions
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

document.addEventListener('DOMContentLoaded', () => {
    console.log('System Online. Welcome to PRTS Design.');

    // Inject components
    document.body.insertAdjacentHTML('beforeend', LOADER_HTML);
    document.body.insertAdjacentHTML('beforeend', LIGHTBOX_HTML);

    // Initial Setup
    initPage();
    initBackgroundAnimation();
    initNavbarScroll();
    initThemeToggle();
    checkYoutubeConnectivity();

    // Handle Browser Back/Forward
    window.addEventListener('popstate', () => {
        const path = window.location.hash.slice(1) || 'index.html';
        loadPage(path, false);
    });
    
    // Performance: Resume animations when user leaves game page
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('[Performance] Page visible - resuming animations if needed');
            window._bgAnimationControl?.resume();
            if (window._dotControllers) {
                Object.values(window._dotControllers).forEach(ctrl => {
                    if (ctrl && ctrl.isPaused !== undefined) {
                        ctrl.isPaused = false;
                    }
                });
            }
        }
    });

    // Check for file protocol
    if (window.location.protocol === 'file:') {
        console.warn('Warning: SPA navigation (fetch API) may be blocked by CORS when running from file://. Please use a local server (e.g. Live Server extension) for full functionality.');
    }

    // Intercept all clicks for SPA navigation
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            // Prevent clicks on active nav items
            if (link.classList.contains('active') && link.classList.contains('nav-item')) {
                e.preventDefault();
                return;
            }

            const href = link.getAttribute('href');

            // Check if it's an internal link and not an anchor link or external
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !link.hasAttribute('target')) {
                e.preventDefault();
                loadPage(href, true);
            }
        }
    });

    // Disable middle-click (auxclick button 1) on all links
    document.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
            const link = e.target.closest('a');
            if (link) e.preventDefault();
        }
    });

    // Handle hash changes for browser back/forward
    window.addEventListener('hashchange', () => {
        const path = window.location.hash.slice(1) || 'index.html';
        loadPage(path, false);
    });

    // Load initial page from hash if present
    if (window.location.hash) {
        const initialPath = window.location.hash.slice(1);
        loadPage(initialPath, false);
    }

    // Initialize YouTube lazy loading
    initYoutubeLazyLoad();
});
function initPage() {
    // Initialize all page features
    const initializers = [
        initHoverEffects,
        initScrollAnimations,
        updateActiveNav,
        initDotController,
        initArtworksDot,
        initLightbox,
        initYoutubeLazyLoad,
        initDragScroll
    ];
    
    initializers.forEach(fn => fn());
}

// Dot-only rocket SVG effect (same as controller but for rocket icon)
function initArtworksDot() {
    const artworksPaths = [
        "M 20.5833,55.4167C 15.8333,55.4167 22.1667,49.875 22.1667,49.875L 25.3333,42.75L 31.6667,49.0833L 25.3333,52.25L 45.9167,52.25L 49.0833,55.4167L 20.5833,55.4167 Z M 36.4166,47.5L 33.25,47.5L 26.9167,41.1667L 26.9167,38L 36.4166,47.5 Z M 33.7922,33.7922C 31.7487,36.1262 31.0588,38.0282 30.4792,39.1875L 28.8958,37.6042C 28.8958,37.6042 26.9167,36.4167 31.6667,31.6667L 33.7922,33.7922 Z M 36.8125,45.5209L 31.6666,40.375C 32.5843,38.7691 33.1757,36.8972 34.8701,34.8702L 42.75,42.75C 42.75,42.75 38.3958,47.1042 36.8125,45.5209 Z M 36.3335,33.1669C 43.0389,25.5565 53.6589,16.7098 60.1063,11.079C 62.2302,12.8251 64.1438,14.8176 65.8035,17.0128L 44.3333,41.1667L 36.3335,33.1669 Z M 57.1116,8.87302L 58.5878,9.89903C 52.0599,15.7961 41.6159,25.1447 35.2855,32.1189L 33.25,30.0833L 57.1116,8.87302 Z"
    ];

    new DotController('artworks-canvas', {
        designW: 680,
        designH: 680,
        viewBoxSize: 76,
        totalSamples: 300,
        dotRadiusDark: 1.5,
        dotRadiusLight: 1.8,
        svgPaths: artworksPaths
    });
}


// Dot-only 2D Xbox-style controller (repelling points, transparent background)
function initDotController(canvasId = 'gamepad-canvas') {
    const gamepadPaths = [
        "M11.5 6.027a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm2.5-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm-6.5-3h1v1h1v1h-1v1h-1v-1h-1v-1h1v-1z M3.051 3.26a.5.5 0 0 1 .354-.613l1.932-.518a.5.5 0 0 1 .62.39c.655-.079 1.35-.117 2.043-.117.72 0 1.443.041 2.12.126a.5.5 0 0 1 .622-.399l1.932.518a.5.5 0 0 1 .306.729c.14.09.266.19.373.297.408.408.78 1.05 1.095 1.772.32.733.599 1.591.805 2.466.206.875.34 1.78.364 2.606.024.816-.059 1.602-.328 2.21a1.42 1.42 0 0 1-1.445.83c-.636-.067-1.115-.394-1.513-.773-.245-.232-.496-.526-.739-.808-.126-.148-.25-.292-.368-.423-.728-.804-1.597-1.527-3.224-1.527-1.627 0-2.496.723-3.224 1.527-.119.131-.242.275-.368.423-.243.282-.494.575-.739.808-.398.38-.877.706-1.513.773a1.42 1.42 0 0 1-1.445-.83c-.27-.608-.352-1.395-.329-2.21.024-.826.16-1.73.365-2.606.206-.875.486-1.733.805-2.466.315-.722.687-1.364 1.094-1.772a2.34 2.34 0 0 1 .433-.335.504.504 0 0 1-.028-.079zm2.036.412c-.877.185-1.469.443-1.733.708-.276.276-.587.783-.885 1.465a13.748 13.748 0 0 0-.748 2.295 12.351 12.351 0 0 0-.339 2.406c-.022.755.062 1.368.243 1.776a.42.42 0 0 0 .426.24c.327-.034.61-.199.929-.502.212-.202.4-.423.615-.674.133-.156.276-.323.44-.504C4.861 9.969 5.978 9.027 8 9.027s3.139.942 3.965 1.855c.164.181.307.348.44.504.214.251.403.472.615.674.318.303.601.468.929.503a.42.42 0 0 0 .426-.241c.18-.408.265-1.02.243-1.776a12.354 12.354 0 0 0-.339-2.406 13.753 13.753 0 0 0-.748-2.295c-.298-.682-.61-1.19-.885-1.465-.264-.265-.856-.523-1.733-.708-.85-.179-1.877-.27-2.913-.27-1.036 0-2.063.091-2.913.27z"
    ];

    new DotController(canvasId, {
        designW: 680,
        designH: 620,
        viewBoxSize: 16,
        totalSamples: 500,
        dotRadiusDark: 1.5,
        dotRadiusLight: 1.8,
        svgPaths: gamepadPaths
    });
}

// Unified Dot Controller Class
class DotController {
    constructor(canvasId, config) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.config = Object.assign({
            designW: 480,
            designH: 480,
            viewBoxSize: 100,
            svgPaths: [],
            totalSamples: 150,
            dotSize: 1.2,
            dotRadius: 1.2,
            dotRadiusLight: 1.2,
            dotRadiusDark: 1.2,
            dotColorLight: '#000000',
            dotColorDark: '#ffffff',
            dotColor: null,
            repulsionRadius: 30,
            repulsionStrength: 15,
            repulsionImpulseScale: 0.03,
            velocityDecay: 0.9,
            maxVelocity: 500,
            initialScatterMultiplier: 6.0,
            globalScale: 1.0,
            globalOffsetX: 0,
            globalOffsetY: 0,
            edgeFade: false,
            edgeFadeThreshold: 0.08,
            edgeFadePower: 1,
            squeezeStrength: 0.1,
            repulsionDamping: 0.99,
            returnDamping: 0.1,
            idleSpeed: 1.0,
            idleAmplitude: 1.0,
            baseIdleAmp: 0.8
        }, config);

        const cleanupKey = `_cleanup_${canvasId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (window[cleanupKey]) window[cleanupKey]();
        window[cleanupKey] = this.destroy.bind(this);

        // Expose controller for runtime configuration/debugging
        if (!window._dotControllers) window._dotControllers = {};
        window._dotControllers[canvasId] = this;

        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.rafId = null;
        this.ro = null;
        this.dpr = window.devicePixelRatio || 1;
        this.scale = 1;
        this.isPaused = false;
        
        // Register in global registry
        this._id = `dotctrl_${_dotControllerIdCounter++}`;
        window._dotControllers[this._id] = this;

        this.state = {
            pointerX: null, pointerY: null,
            scrollSqueeze: 0, targetScrollSqueeze: 0,
            squeezeAnchor: 0, targetSqueezeAnchor: 0,
            screenOffsetY: 0, targetScreenOffsetY: 0,
            centerOffsetY: 0,
            lastScrollY: window.scrollY,
            lastScrollTime: performance.now(),
            focusLevel: 0,
            targetFocusLevel: 1,
            lastFrameTime: performance.now(),
            frameHistory: []
        };

        this.CONSTANTS = {
            TOP_ANCHOR: -this.config.designH / 1.5,
            BOTTOM_ANCHOR: this.config.designH / 1.5,
            SCREEN_MAX: Math.max(120, this.config.designH),
            SCREEN_ANCHOR_INFLUENCE: -0.25,
            CENTER_EASE: 0.09,
            SCREEN_DAMPING: 0.01,
            SCREEN_DECAY: 0.1
        };

        // Bind methods once
        this.resize = this.resize.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerLeave = this.onPointerLeave.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onScroll = this.onScroll.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.draw = this.draw.bind(this);

        this.init();
    }

    init() {
        this.setupEvents();
        this.setupPoints();
        this.resize();
        this.draw();
    }

    async setupPoints() {
        // Performance optimization: Cache points
        if (!DotController.cache) DotController.cache = {};
        const cacheKey = this.canvas.id;

        if (DotController.cache[cacheKey]) {
            this.points = DotController.cache[cacheKey].points;
            this.state.focusLevel = 0;
            this.state.targetFocusLevel = 1;
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 0));

        const { svgPaths, viewBoxSize, designW, designH, totalSamples, dotRadius, dotSize, dotRadiusLight, dotRadiusDark } = this.config;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tmpSvg = document.createElementNS(svgNS, 'svg');
        tmpSvg.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(tmpSvg);

        try {
            const pathEls = svgPaths.map(d => {
                const p = document.createElementNS(svgNS, 'path');
                p.setAttribute('d', d);
                tmpSvg.appendChild(p);
                return p;
            });

            const lengths = pathEls.map(p => p.getTotalLength());
            const totalLen = lengths.reduce((a, b) => a + b, 0);
            const scaleToDesign = designW / viewBoxSize;
            const offset = viewBoxSize / 2;

            pathEls.forEach((p, i) => {
                const len = lengths[i];
                if (len <= 0) return;
                const samples = Math.max(Math.floor(totalSamples * (len / totalLen)), 2);

                for (let j = 0; j < samples; j++) {
                    const pt = p.getPointAtLength((j / (samples - 1)) * len);
                    const bx = (pt.x - offset) * scaleToDesign;
                    const by = (pt.y - offset) * scaleToDesign;

                    const scatterRadius = Math.max(designW, designH) * 0.45 * (this.config.initialScatterMultiplier || 1);
                    const ang = Math.random() * Math.PI * 2;
                    const r = Math.sqrt(Math.random()) * scatterRadius;

                    this.points.push({
                        bx, by,
                        x: Math.cos(ang) * r,
                        y: Math.sin(ang) * r,
                        startX: Math.cos(ang) * r,
                        startY: Math.sin(ang) * r,
                        phase: Math.random() * Math.PI * 2,
                        idleAmp: ((typeof this.config.baseIdleAmp === 'number' ? this.config.baseIdleAmp : 0.8) * (0.8 + Math.random() * 0.4)),
                        sizeFactor: (0.9 + Math.random() * 0.4),
                        vx: 0, vy: 0
                    });
                }
            });

            DotController.cache[cacheKey] = { points: this.points };
        } catch (e) {
            console.error('Error sampling SVG', e);
        } finally {
            if (tmpSvg.parentNode) document.body.removeChild(tmpSvg);
        }
    }

    setupEvents() {
        this.canvas.style.touchAction = 'none';
        
        // Use utility function for adding events
        const canvasEvents = ['pointermove', 'pointerdown'];
        canvasEvents.forEach(event => this.canvas.addEventListener(event, this.onPointerMove));
        this.canvas.addEventListener('pointerleave', this.onPointerLeave);
        
        const windowEvents = [
            ['resize', this.resize],
            ['wheel', this.onWheel, { passive: true }],
            ['scroll', this.onScroll, { passive: true }],
            ['focus', this.onFocus]
        ];
        
        windowEvents.forEach(([event, handler, options]) => {
            window.addEventListener(event, handler, options);
        });

        try {
            const target = this.canvas.closest('.controller-wrap, .rocket-wrap') || this.canvas.parentElement;
            if (window.ResizeObserver && target) {
                this.ro = new ResizeObserver(this.resize);
                this.ro.observe(target);
            }
            
            const visTarget = target || this.canvas;
            if ('IntersectionObserver' in window) {
                this.io = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        this.isVisible = entry.isIntersecting;
                        this.state.targetFocusLevel = entry.isIntersecting ? 1 : 0;
                    });
                }, { threshold: 0.05 });
                this.io.observe(visTarget);
                
                const rect = visTarget.getBoundingClientRect();
                this.isVisible = rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
                this.state.focusLevel = this.isVisible ? 1 : 0;
                this.state.targetFocusLevel = this.isVisible ? 1 : 0;
            }
        } catch (e) { }
    }

    resize() {
        this.dpr = window.devicePixelRatio || 1;
        const pw = Math.max(1, this.canvas.clientWidth);
        const ph = Math.max(1, this.canvas.clientHeight);
        this.canvas.width = Math.round(pw * this.dpr);
        this.canvas.height = Math.round(ph * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.scale = Math.min(pw / this.config.designW, ph / this.config.designH);
    }

    onPointerMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Track previous pointer position for velocity/impulse calculations
        this.state.prevPointerX = this.state.pointerX;
        this.state.prevPointerY = this.state.pointerY;
        this.state.pointerX = e.clientX - rect.left;
        this.state.pointerY = e.clientY - rect.top;
    }

    onPointerLeave() {
        this.state.pointerX = null;
        this.state.pointerY = null;
        this.state.prevPointerX = null;
        this.state.prevPointerY = null;
    }

    onFocus() {
        this.state.targetFocusLevel = 1;
    }

    onBlur() {
        this.state.targetFocusLevel = 0;
    }

    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    onWheel(e) {
        const v = this.clamp(e.deltaY / 800, -0.9, 0.9);
        this.state.targetScrollSqueeze = this.clamp(this.state.targetScrollSqueeze + v, -1, 1);
        const dir = Math.sign(e.deltaY) || 1;
        const strength = this.clamp(Math.abs(v) * 1.4, 0, 1);
        this.state.targetSqueezeAnchor = (dir > 0 ? this.CONSTANTS.TOP_ANCHOR : this.CONSTANTS.BOTTOM_ANCHOR) * strength;
        this.state.targetScreenOffsetY = this.clamp(this.state.targetScreenOffsetY + (-e.deltaY) * 0.35, -this.CONSTANTS.SCREEN_MAX, this.CONSTANTS.SCREEN_MAX);
    }

    onScroll() {
        const now = performance.now();
        const dy = window.scrollY - this.state.lastScrollY;
        const dt = Math.max(16, now - this.state.lastScrollTime);
        const velocity = dy / dt;
        const v = this.clamp(velocity * 30, -0.6, 0.6);

        this.state.targetScrollSqueeze = this.clamp(this.state.targetScrollSqueeze + v, -1, 1);
        const dir = Math.sign(dy) || 1;
        const strength = this.clamp(Math.abs(v) * 1.2, 0, 1);
        this.state.targetSqueezeAnchor = (dir > 0 ? this.CONSTANTS.TOP_ANCHOR : this.CONSTANTS.BOTTOM_ANCHOR) * strength;
        this.state.targetScreenOffsetY = this.clamp(this.state.targetScreenOffsetY + (-dy) * 0.35, -this.CONSTANTS.SCREEN_MAX, this.CONSTANTS.SCREEN_MAX);

        this.state.lastScrollY = window.scrollY;
        this.state.lastScrollTime = now;
    }

    draw() {
        // Check if paused (performance optimization)
        if (this.isPaused) {
            this.rafId = requestAnimationFrame(this.draw);
            return;
        }
        
        const { ctx, canvas, dpr, scale, points, state, config, CONSTANTS } = this;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const dotColor = config.dotColor ? config.dotColor : (isDark ? (config.dotColorDark || '#ffffff') : (config.dotColorLight || '#000000'));

        const cx = canvas.clientWidth / 2;
        const now = performance.now();
        
        // Calculate deltaTime for frame-rate independent animation
        const rawDelta = (now - state.lastFrameTime);
        // Normalize to 60fps (16.67ms), but cap at 2x to prevent large jumps on lag spikes
        const deltaTime = Math.min(rawDelta / 16.67, 2);
        state.lastFrameTime = now;
        
        // Track performance - if consistently low FPS, we might need optimizations
        if (!state.frameHistory) state.frameHistory = [];
        state.frameHistory.push(rawDelta);
        if (state.frameHistory.length > 60) state.frameHistory.shift();

        // Smoothly transition focus level (frame-rate independent)
        state.focusLevel += (state.targetFocusLevel - state.focusLevel) * 0.05 * deltaTime;
        const focusEase = 1 - Math.pow(1 - state.focusLevel, 3); // Cubic ease

        state.scrollSqueeze += (state.targetScrollSqueeze - state.scrollSqueeze) * 0.12 * deltaTime;
        state.targetScrollSqueeze *= Math.pow(0.92, deltaTime);
        if (Math.abs(state.targetScrollSqueeze) < 0.001) state.targetScrollSqueeze = 0;

        state.squeezeAnchor += (state.targetSqueezeAnchor - state.squeezeAnchor) * 0.12 * deltaTime;
        state.targetSqueezeAnchor *= Math.pow(0.92, deltaTime);
        if (Math.abs(state.targetSqueezeAnchor) < 0.5) state.targetSqueezeAnchor = 0;

        state.screenOffsetY += (state.targetScreenOffsetY - state.screenOffsetY) * CONSTANTS.SCREEN_DAMPING * deltaTime;
        state.targetScreenOffsetY *= Math.pow(CONSTANTS.SCREEN_DECAY, deltaTime);
        if (Math.abs(state.targetScreenOffsetY) < 0.5) state.targetScreenOffsetY = 0;

        const anchorPx = state.squeezeAnchor * scale * CONSTANTS.SCREEN_ANCHOR_INFLUENCE * 0.3;
        const desiredCenter = state.screenOffsetY + anchorPx;
        state.centerOffsetY += (desiredCenter - state.centerOffsetY) * CONSTANTS.CENTER_EASE * deltaTime;

        const cy = canvas.clientHeight / 2 + state.centerOffsetY;

        const squeezeAmount = this.clamp(state.scrollSqueeze * 0.2, -0.2, 0.2);
        const verticalScale = 1 - Math.abs(squeezeAmount) * config.squeezeStrength;
        const anchor = state.squeezeAnchor;

        // Prepare idle timing and amplitudes using config
        const baseTimeMul = 0.002 * (this.config.idleSpeed || 1);
        const globalIdleAmp = (this.config.idleAmplitude !== undefined ? this.config.idleAmplitude : 1);

        // Compute pointer movement velocity (simple per-frame delta)
        let pointerVX = 0, pointerVY = 0, pointerSpeed = 0;
        if (state.pointerX !== null && state.prevPointerX !== null) {
            pointerVX = state.pointerX - state.prevPointerX;
            pointerVY = state.pointerY - state.prevPointerY;
            pointerSpeed = Math.hypot(pointerVX, pointerVY);
        }

        // Compute global transform for rendering
        const globalScale = (config.globalScale !== undefined ? config.globalScale : 1);
        const effectiveScale = scale * globalScale;
        const globalOffsetX = (config.globalOffsetX !== undefined ? config.globalOffsetX : 0);
        const globalOffsetY = (config.globalOffsetY !== undefined ? config.globalOffsetY : 0);

        for (let p of points) {
            const idleX = Math.sin((now * baseTimeMul) * 2 + p.phase) * p.idleAmp * globalIdleAmp * 1.2;
            const idleY = Math.cos((now * baseTimeMul) * 2.2 + p.phase) * p.idleAmp * globalIdleAmp * 1.2;

            // Interpolate between scattered (startX/Y) and assembled (bx/by) based on focus
            const baseX = (1 - focusEase) * p.startX + focusEase * p.bx;
            const baseY = (1 - focusEase) * p.startY + focusEase * p.by;

            const squeezedBaseY = anchor + (baseY - anchor) * verticalScale;

            let targetX = baseX + idleX * focusEase;
            let targetY = squeezedBaseY + idleY * focusEase;

            // Subtle cursor avoidance based on distance
            if (state.pointerX !== null) {
                const currentScreenX = cx + p.x * effectiveScale + globalOffsetX;
                const currentScreenY = cy + p.y * effectiveScale + globalOffsetY;
                const dx = currentScreenX - state.pointerX;
                const dy = currentScreenY - state.pointerY;
                const dist = Math.hypot(dx, dy);
                const avoidRadius = 500;

                if (dist < avoidRadius && dist > 0.01) {
                    const force = (1 - dist / avoidRadius) * 0.8;
                    const avoidX = (dx / dist) * force * 15;
                    const avoidY = (dy / dist) * force * 15;
                    targetX += avoidX / effectiveScale;
                    targetY += avoidY / effectiveScale;
                }
            }

            // If the pointer is within repulsion radius, apply a push: a static base push (like a finger present)
            // plus an additional impulse based on pointer movement. This creates a "push" without dragging.
            let inRepulseRange = false;
            if (state.pointerX !== null) {
                const currentScreenX = cx + p.x * effectiveScale + globalOffsetX;
                const currentScreenY = cy + p.y * effectiveScale + globalOffsetY;
                
                let dist, dx, dy;
                
                // Use line segment distance when mouse is moving fast
                if (state.prevPointerX !== null && state.prevPointerY !== null && pointerSpeed > 1) {
                    const x1 = state.prevPointerX;
                    const y1 = state.prevPointerY;
                    const x2 = state.pointerX;
                    const y2 = state.pointerY;
                    
                    const segX = x2 - x1;
                    const segY = y2 - y1;
                    const segLenSq = segX * segX + segY * segY;
                    
                    if (segLenSq > 1) {
                        // Project point onto line segment
                        const t = Math.max(0, Math.min(1, ((currentScreenX - x1) * segX + (currentScreenY - y1) * segY) / segLenSq));
                        const closestX = x1 + t * segX;
                        const closestY = y1 + t * segY;
                        
                        dx = currentScreenX - closestX;
                        dy = currentScreenY - closestY;
                        dist = Math.hypot(dx, dy);
                    } else {
                        dx = currentScreenX - state.pointerX;
                        dy = currentScreenY - state.pointerY;
                        dist = Math.hypot(dx, dy);
                    }
                } else {
                    dx = currentScreenX - state.pointerX;
                    dy = currentScreenY - state.pointerY;
                    dist = Math.hypot(dx, dy);
                }
                
                if (dist < config.repulsionRadius && dist > 0.01) {
                    inRepulseRange = true;
                    const norm = 1 - (dist / config.repulsionRadius);
                    // Base push from static pointer presence
                    const basePush = (norm * norm) * (config.repulsionStrength || 50);
                    const bx = (dx / dist) * (basePush / effectiveScale);
                    const by = (dy / dist) * (basePush / effectiveScale);
                    // Movement-based impulse (if pointer is moving)
                    const safePointerSpeed = Math.min(pointerSpeed, 60);
                    const impulse = (norm * norm) * (config.repulsionStrength || 50) * safePointerSpeed * (config.repulsionImpulseScale || 0.02);
                    const ix = (dx / dist) * (impulse / effectiveScale);
                    const iy = (dy / dist) * (impulse / effectiveScale);
                    // Add both base push and movement impulse to velocities
                    p.vx += bx + ix;
                    p.vy += by + iy;
                    // Clamp per-point velocity to prevent runaway
                    const mv = config.maxVelocity || 12;
                    p.vx = Math.max(-mv, Math.min(mv, p.vx));
                    p.vy = Math.max(-mv, Math.min(mv, p.vy));
                }
            }

            // Apply return spring toward base target using returnDamping
            // When repulsing, we want the point to move freely, so we keep the return spring weak (or same as normal).
            // We do NOT use repulsionDamping for the spring, as high damping would pin the point to the target.
            const rtn = config.returnDamping !== undefined ? config.returnDamping : 0.05;
            const rtFactor = 1 - Math.pow(1 - rtn, deltaTime);
            p.x += (targetX - p.x) * rtFactor;
            p.y += (targetY - p.y) * rtFactor;

            // Apply velocity impulses
            // When repulsing, we allow higher velocity influence (repulsionDamping) to let the point fly away.
            const velFactor = inRepulseRange ? (config.repulsionDamping !== undefined ? config.repulsionDamping : 0.1) : (config.returnDamping !== undefined ? config.returnDamping : 0.05);
            p.x += p.vx * velFactor * deltaTime;
            p.y += p.vy * velFactor * deltaTime;
            const decay = (config.velocityDecay !== undefined ? config.velocityDecay : 0.92);
            p.vx *= Math.pow(decay, deltaTime);
            p.vy *= Math.pow(decay, deltaTime);

            const sx = cx + p.x * effectiveScale + globalOffsetX;
            const sy = cy + p.y * effectiveScale + globalOffsetY;
            // Determine selected radius based on theme (dark/light) or fallback to dotRadius/dotSize
            const defaultRadius = (typeof config.dotRadius === 'number' ? config.dotRadius : config.dotSize);
            const selectedRadius = (isDark ? (typeof config.dotRadiusDark === 'number' ? config.dotRadiusDark : defaultRadius) : (typeof config.dotRadiusLight === 'number' ? config.dotRadiusLight : defaultRadius));
            const size = Math.max(0.8, (selectedRadius * (p.sizeFactor || 1))) * effectiveScale;

            ctx.beginPath();
            ctx.fillStyle = dotColor;
            if (config.edgeFade) {
                // Edge fade: reduce alpha when dot is within threshold of any edge
                const canvasW = canvas.clientWidth;
                const canvasH = canvas.clientHeight;
                const thX = canvasW * (config.edgeFadeThreshold || 0.1);
                const thY = canvasH * (config.edgeFadeThreshold || 0.1);
                let ax = 1, ay = 1;
                if (sx < thX) ax = Math.max(0, sx / thX);
                else if (sx > canvasW - thX) ax = Math.max(0, (canvasW - sx) / thX);
                if (sy < thY) ay = Math.max(0, sy / thY);
                else if (sy > canvasH - thY) ay = Math.max(0, (canvasH - sy) / thY);
                let edgeAlpha = Math.min(ax, ay);
                // Apply power curve to make fade smoother if desired
                if (typeof config.edgeFadePower === 'number' && config.edgeFadePower !== 1) {
                    edgeAlpha = Math.pow(edgeAlpha, config.edgeFadePower);
                }
                const prevAlpha = ctx.globalAlpha || 1;
                ctx.globalAlpha = (prevAlpha || 1) * edgeAlpha;
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = prevAlpha || 1;
            } else {
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        this.rafId = requestAnimationFrame(this.draw);
        // Update prevPointer for per-frame delta calculation
        if (state.pointerX !== null) {
            state.prevPointerX = state.pointerX;
            state.prevPointerY = state.pointerY;
        }
    }

    // Update configuration at runtime (allows changing idle speed/amplitude)
    updateConfig(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') return;
        Object.assign(this.config, newConfig);
    }

    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        
        // Remove canvas events
        const canvasEvents = ['pointermove', 'pointerdown'];
        canvasEvents.forEach(event => this.canvas.removeEventListener(event, this.onPointerMove));
        this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
        
        // Remove window events
        const windowEvents = [
            ['resize', this.resize],
            ['wheel', this.onWheel],
            ['scroll', this.onScroll],
            ['focus', this.onFocus]
        ];
        windowEvents.forEach(([event, handler]) => {
            window.removeEventListener(event, handler);
        });
        
        if (this.ro) this.ro.disconnect();
        
        // Remove from global registry
        if (window._dotControllers && this._id) {
            delete window._dotControllers[this._id];
        }
    }
}


function initNavbarScroll() {
    let lastScrollY = window.scrollY;
    const nav = document.querySelector('nav');

    window.addEventListener('scroll', () => {
        if (!nav) return;

        const currentScrollY = window.scrollY;
        const floatingControls = document.querySelector('.project-controls');

        // Hide immediately when scrolling down (threshold > 0)
        if (currentScrollY > lastScrollY && currentScrollY > 0) {
            // Scrolling down -> Hide navbar
            nav.classList.add('nav-hidden');
            if (floatingControls) floatingControls.classList.add('controls-hidden');
        } else {
            // Scrolling up -> Show navbar
            nav.classList.remove('nav-hidden');
            if (floatingControls) floatingControls.classList.remove('controls-hidden');
        }

        lastScrollY = currentScrollY;
    });
}

function initBackgroundAnimation() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let mouseX = null;
    let mouseY = null;
    let scrollY = 0;
    let lastScrollY = 0;
    let scrollVelocity = 0;
    let isPaused = false; // Control variable for pausing animation
    
    // Expose pause/resume globally for performance optimization
    window._bgAnimationControl = {
        pause: () => { isPaused = true; },
        resume: () => { isPaused = false; }
    };

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    // Track mouse position
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
        mouseX = null;
        mouseY = null;
    });

    // Track scroll
    window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
        scrollVelocity = scrollY - lastScrollY;
        lastScrollY = scrollY;
    });

    // Simple Particle Class
    class Particle {
        constructor(fromEdge = false) {
            this.reset(fromEdge);
            this.affectedByScroll = !fromEdge; // Only initial particles affected by scroll
        }

        reset(fromEdge = false) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            
            if (fromEdge) {
                // Spawn from a random edge
                const edge = Math.floor(Math.random() * 4);
                if (edge === 0) { // Top
                    this.x = Math.random() * width;
                    this.y = -10;
                    this.vy = Math.random() * 0.5 + 0.3;
                    this.vx = (Math.random() - 0.5) * 1;
                } else if (edge === 1) { // Right
                    this.x = width + 10;
                    this.y = Math.random() * height;
                    this.vx = -(Math.random() * 0.5 + 0.3);
                    this.vy = (Math.random() - 0.5) * 1;
                } else if (edge === 2) { // Bottom
                    this.x = Math.random() * width;
                    this.y = height + 10;
                    this.vy = -(Math.random() * 0.5 + 0.3);
                    this.vx = (Math.random() - 0.5) * 1;
                } else { // Left
                    this.x = -10;
                    this.y = Math.random() * height;
                    this.vx = Math.random() * 0.5 + 0.3;
                    this.vy = (Math.random() - 0.5) * 1;
                }
            } else {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = (Math.random() - 0.5) * 1;
            }
            
            this.size = Math.random() * 3; // Random size
            this.alpha = Math.random() * 0.2 + (isDark ? 0.5 : 0.7);
        }

        update() {
            // Update position with velocity
            this.x += this.vx;
            this.y += this.vy;

            // Check if particle is off screen (with margin)
            const margin = 20;
            if (this.x < -margin || this.x > width + margin || 
                this.y < -margin || this.y > height + margin) {
                return false; // Mark for deletion
            }
            return true; // Still alive
        }

        draw() {
            // Check current theme
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const color = isDark ? `rgba(255, 255, 255, ${this.alpha})` : `rgba(0, 0, 0, ${this.alpha})`;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        // Skip animation frame if paused
        if (isPaused) {
            requestAnimationFrame(animate);
            return;
        }
        
        ctx.clearRect(0, 0, width, height);

        // Calculate base offset based on mouse position
        let baseOffsetX = 0;
        let baseOffsetY = 0;
        if (mouseX !== null && mouseY !== null) {
            const centerX = width / 2;
            const centerY = height / 2;
            const dx = mouseX - centerX;
            const dy = mouseY - centerY;
            baseOffsetX = dx * -0.01;
            baseOffsetY = dy * -0.01;
        }

        // Add scroll-based offset
        const scrollOffsetY = scrollY * -0.1;

        // Update and filter particles
        particles = particles.filter(p => {
            const alive = p.update();
            
            if (alive) {
                // Larger dots get more offset (based on size)
                const sizeMultiplier = Math.pow(p.size / 2, 3);
                let particleOffsetX = baseOffsetX * (0.1 + sizeMultiplier * 1);
                let particleOffsetY = baseOffsetY * (0.1 + sizeMultiplier * 1);

                // Add parallax scroll effect based on size (only for initial particles)
                if (p.affectedByScroll) {
                    particleOffsetY += scrollOffsetY * (0.4 + sizeMultiplier * 1);
                }

                // Save context and apply per-particle translation
                ctx.save();
                ctx.translate(particleOffsetX, particleOffsetY);
                p.draw();
                ctx.restore();
            }
            
            return alive;
        });

        // Maintain particle count by spawning new ones from edges
        const targetCount = 50;
        while (particles.length < targetCount) {
            particles.push(new Particle(true));
        }

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        resize();
        initParticles();
    });

    resize();
    initParticles();
    animate();
}

function initHoverEffects() {
    const buttons = document.querySelectorAll('.rhombus-btn, .nav-item');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            // Optional: Add sound or visual effect
        });
    });
}
function initScrollAnimations() {
    // Skip fade-in animations on project detail pages
    if (document.querySelector('.project-detail-container')) {
        return;
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                return;
            }

            const rect = entry.boundingClientRect;
            const rootBounds = entry.rootBounds;
            const viewportBottom = rootBounds ? rootBounds.bottom : window.innerHeight;
            if (rect.top > viewportBottom) {
                entry.target.classList.remove('visible');
            }
        });
    }, observerOptions);

    // Select elements to animate (exclude .project-gallery img)
    const elementsToAnimate = document.querySelectorAll(
        [
            '.hero h1',
            '.hero p',
            '.section-title',
            '.section-title-text',
            '.project-header',
            '.project-content',
            '.webgl-container',
            '.grid-container .card',
            '.timeline-container .timeline-item',
            '.about-container .profile-name-large',
            '.about-container .profile-bio-box',
            '.about-container .profile-tags-row',
            '.about-container .contact-info-grid',
            '.about-container .profile-content-right',
            '.about-container .profile-image-right',
            '.about-container .deco-line',
            '.about-container .featured-projects-scroll-wrapper',
            '.about-container .featured-artworks-scroll-wrapper',
            '.about-container .scroll-card',
            '.about-container .featured-cta-btn',
            '.about-container .art-scroll-card'
        ].join(', ')
    );
    elementsToAnimate.forEach(el => {
        el.classList.add('fade-in-up');
        observer.observe(el);
    });

    let resetRafId = null;
    const resetBelowViewport = () => {
        if (resetRafId !== null) return;
        resetRafId = requestAnimationFrame(() => {
            resetRafId = null;
            const viewportBottom = window.innerHeight;
            elementsToAnimate.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top > viewportBottom) {
                    el.classList.remove('visible');
                }
            });
        });
    };

    window.addEventListener('scroll', resetBelowViewport, { passive: true });
}

function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox.querySelector('img');
    const closeBtn = document.getElementById('lightbox-close');

    if (!lightbox) return;

    // Close on click
    lightbox.addEventListener('click', (e) => {
        if (e.target !== lightboxImg) {
            lightbox.classList.remove('active');
        }
    });

    // Also close when clicking the enlarged image itself
    lightboxImg.addEventListener('click', (e) => {
        e.stopPropagation();
        lightbox.classList.remove('active');
    });

    // Add click listeners to art cards and scroll art cards
    const artCards = document.querySelectorAll('.art-card, .art-scroll-card');
    artCards.forEach(card => {
        const isLink = card.tagName === 'A' && card.hasAttribute('href');
        const href = isLink ? card.getAttribute('href') : null;

        // If this is a link to an image file, intercept and open in lightbox
        if (isLink && href && /\.(jpe?g|png|webp|gif|svg)(\?|#|$)/i.test(href)) {
            card.style.cursor = 'zoom-in';
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const imgSrc = href;
                lightboxImg.src = imgSrc;
                lightbox.classList.add('active');
            });
            return;
        }

        // If it's an anchor to a non-image (e.g., external YouTube), don't override
        if (isLink) {
            card.style.cursor = 'pointer';
            return;
        }

        // Non-link card (div) - find contained image
        const img = card.querySelector('img');
        if (img) {
            card.style.cursor = 'zoom-in';

            card.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                lightboxImg.src = img.src;
                lightbox.classList.add('active');
            });
        }
    });

    // Game Start Button Handler
    const gameStartButtons = document.querySelectorAll('.game-start-btn');
    gameStartButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();

            // Find the overlay and iframe
            const overlay = button.closest('.game-start-overlay');
            const container = overlay.parentElement;
            const iframe = container.querySelector('iframe');

            if (iframe && iframe.hasAttribute('data-src')) {
                // Load the game by setting src attribute
                iframe.src = iframe.getAttribute('data-src');
                iframe.removeAttribute('data-src');
            }

            // Hide the overlay
            overlay.classList.add('hidden');
            
            // PERFORMANCE OPTIMIZATION: Pause background animations when game starts
            console.log('[Performance] Pausing background animations for game');
            if (window._bgAnimationControl) {
                window._bgAnimationControl.pause();
            }
            // Pause all dot controllers
            if (window._dotControllers) {
                Object.values(window._dotControllers).forEach(ctrl => {
                    if (ctrl && ctrl.isPaused !== undefined) {
                        ctrl.isPaused = true;
                    }
                });
            }
        });
    });
}

async function loadPage(url, pushHistory = true) {
    // Select the current content container
    const contentSelector = '.container, .project-detail-container, .about-container';
    const container = document.querySelector(contentSelector);
    const loader = document.getElementById('loader');

    if (!container) {
        console.error('No content container found');
        window.location.href = url;
        return;
    }

    // Determine Direction
    const pageOrder = ['index.html', 'projects.html', 'art.html'];

    // Helper to get filename from URL
    const getFileName = (path) => {
        const name = path.split('/').pop() || 'index.html';
        return name.split('#')[0].split('?')[0];
    };

    // FIX: Get current file from hash if present, otherwise default to index.html
    let currentPath = window.location.hash.slice(1);
    if (!currentPath) currentPath = 'index.html';

    const currentFile = getFileName(currentPath);
    const nextFile = getFileName(url);

    let currentIndex = pageOrder.indexOf(currentFile);
    let nextIndex = pageOrder.indexOf(nextFile);

    // Handle sub-pages (e.g. projects/xyz.html) -> treat as same level or deeper
    if (currentIndex === -1) currentIndex = 1; // Default to projects level if unknown
    if (nextIndex === -1) nextIndex = 1;

    let direction = 'right'; // Default slide in from right (moving to next)
    if (nextIndex < currentIndex) {
        direction = 'left'; // Slide in from left (moving to prev)
    } else if (nextIndex === currentIndex) {
        direction = 'fade'; // Same page or sub-page
    }

    // 1. Exit animation
    if (direction === 'left') {
        container.classList.add('exit-right');
    } else if (direction === 'right') {
        container.classList.add('exit-left');
    } else {
        container.classList.add('exit-fade');
    }

    const loaderTimeout = setTimeout(() => loader.classList.add('active'), 800);

    try {
        // 2. Wait for exit animation
        await new Promise(r => setTimeout(r, 200));

        // 3. Fetch new content
        const response = await fetch(url);
        if (!response.ok) throw new Error('Page not found');
        const text = await response.text();

        // 4. Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const newContainer = doc.querySelector(contentSelector);
        const newTitle = doc.querySelector('title') ? doc.querySelector('title').innerText : document.title;
        const newControls = doc.querySelector('.project-controls');

        // 5. Swap content
        if (newContainer) {
            container.innerHTML = newContainer.innerHTML;
            document.title = newTitle;

            // Handle controls
            const currentControls = document.querySelector('.project-controls');
            if (currentControls) currentControls.remove();
            if (newControls) document.body.appendChild(newControls);

            window.scrollTo(0, 0);

            // Update hash
            if (pushHistory) {
                window.location.hash = url;
            }

            // Clear exit classes
            container.classList.remove('exit-left', 'exit-right', 'exit-fade');

            // Set enter state
            if (direction === 'left') {
                container.classList.add('enter-left');
            } else if (direction === 'right') {
                container.classList.add('enter-right');
            } else {
                container.classList.add('enter-fade');
            }

            // Force reflow and trigger enter animation
            void container.offsetWidth;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    container.classList.remove('enter-left', 'enter-right', 'enter-fade');
                });
            });

            // 6. Re-initialize
            initPage();

            // If this was a project detail page, remember it so we can scroll back on projects.html
            try {
                const normalizedUrl = url.split('#')[0].split('?')[0];
                const lower = normalizedUrl.toLowerCase();
                if (lower.includes('project') && normalizedUrl.toLowerCase().endsWith('.html') && getFileName(normalizedUrl) !== 'projects.html') {
                    console.log('[ScrollBack] Storing project:', normalizedUrl);
                    sessionStorage.setItem('lastVisitedProject', normalizedUrl);
                }
            } catch (e) { console.error('[ScrollBack] Error storing:', e); }

            // 7. Execute inline scripts from the new page
            const newScripts = doc.querySelectorAll('script');
            newScripts.forEach(script => {
                if (script.src) {
                    // External script - reload it
                    const newScript = document.createElement('script');
                    newScript.src = script.src;
                    document.body.appendChild(newScript);
                } else if (script.textContent) {
                    // Inline script - execute it
                    try {
                        eval(script.textContent);
                    } catch (e) {
                        console.error('Error executing inline script:', e);
                    }
                }
            });

            // If this is the projects page, scroll to the last visited project if present
            try {
                const loadedFileName = getFileName(url);
                if (loadedFileName === 'projects.html') {
                    const lastProj = sessionStorage.getItem('lastVisitedProject');
                    console.log('[ScrollBack] Loading projects.html, lastProj:', lastProj);
                    if (lastProj) {
                        // Wait for page transition animation to complete before scrolling
                        setTimeout(() => {
                            const grid = document.querySelector('.grid-container');
                            if (!grid) {
                                console.log('[ScrollBack] Grid not found');
                                return;
                            }
                            const cards = grid.querySelectorAll('a.card');
                            console.log('[ScrollBack] Found', cards.length, 'cards');
                            let target = null;
                            for (let card of cards) {
                                const href = card.getAttribute('href');
                                if (!href) continue;
                                // Case-insensitive comparison
                                const hrefLower = href.toLowerCase();
                                const lastProjLower = lastProj.toLowerCase();
                                if (hrefLower === lastProjLower || hrefLower.endsWith(lastProjLower) || lastProjLower.endsWith(hrefLower)) {
                                    target = card;
                                    console.log('[ScrollBack] Found match (exact):', href);
                                    break;
                                }
                                const aName = href.split('/').pop();
                                const bName = lastProj.split('/').pop();
                                if (aName && bName && aName.toLowerCase() === bName.toLowerCase()) {
                                    target = card;
                                    console.log('[ScrollBack] Found match (filename):', href);
                                    break;
                                }
                            }
                            if (target) {
                                console.log('[ScrollBack] Scrolling to target');
                                // calculate scroll position aligning it to center of viewport and considering nav
                                const rect = target.getBoundingClientRect();
                                const nav = document.querySelector('nav');
                                const navHeight = nav ? nav.offsetHeight : 0;
                                const scrollY = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2) - navHeight;
                                window.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' });
                                // temporary highlight for clarity
                                target.classList.add('scroll-return-highlight');
                                setTimeout(() => { target.classList.remove('scroll-return-highlight'); }, 2200);
                            } else {
                                console.log('[ScrollBack] No matching card found for:', lastProj);
                            }
                        }, 400); // Wait for transition animation (200ms exit + 200ms enter + buffer)
                        sessionStorage.removeItem('lastVisitedProject');
                    }
                }
            } catch (e) { console.error('[ScrollBack] Error:', e); }
        } else {
            throw new Error('New page content not found');
        }

    } catch (error) {
        console.error('Error loading page:', error);
        window.location.href = url;
    } finally {
        clearTimeout(loaderTimeout);
        loader.classList.remove('active');
    }
}

function updateActiveNav() {
    const currentPath = window.location.hash.slice(1) || 'index.html';
    document.querySelectorAll('.nav-item').forEach(link => {
        link.classList.remove('active');
        const linkHref = link.getAttribute('href');

        // Check if current page matches this nav item
        if (linkHref === currentPath ||
            (currentPath === 'index.html' && linkHref === 'index.html') ||
            (currentPath.includes('projects/') && linkHref === 'projects.html') ||
            (currentPath === 'projects.html' && linkHref === 'projects.html') ||
            (currentPath === 'art.html' && linkHref === 'art.html')) {
            link.classList.add('active');
        }
    });
}

function initThemeToggle() {
    // Check for saved theme preference or default to browser preference
    let currentTheme = localStorage.getItem('theme');

    if (!currentTheme) {
        // Detect browser/system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            currentTheme = 'dark';
        } else {
            currentTheme = 'light';
        }
    }

    document.documentElement.setAttribute('data-theme', currentTheme);

    // Create theme toggle button
    const nav = document.querySelector('nav');
    if (!nav) return;

    const navLinks = nav.querySelector('.nav-links');
    if (!navLinks) return;

    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.setAttribute('aria-label', 'Toggle theme');

    // Sun icon with rays for light mode, moon for dark mode
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

    themeToggle.innerHTML = currentTheme === 'dark' ? sunIcon : moonIcon;

    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        themeToggle.innerHTML = newTheme === 'dark' ? sunIcon : moonIcon;
    });

    // Listen for browser theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-update if user hasn't manually set a preference
            if (!localStorage.getItem('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                themeToggle.innerHTML = newTheme === 'dark' ? sunIcon : moonIcon;
            }
        });
    }

    navLinks.parentElement.appendChild(themeToggle);
}

// YouTube Lazy Loading
function initYoutubeLazyLoad() {
    const lazyVideos = document.querySelectorAll('.youtube-lazy');

    lazyVideos.forEach(container => {
        // Skip if already loaded
        if (container.querySelector('iframe')) return;

        container.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const videoId = this.getAttribute('data-video-id');
            if (!videoId) return;

            // Try to load YouTube iframe
            tryLoadYoutube(this, videoId);
        }, true);
    });
}

// Check YouTube connectivity on page load
function checkYoutubeConnectivity() {
    // Store result globally
    window._youtubeAccessible = null;

    // Ping YouTube with 2-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    fetch('https://www.youtube.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
    })
        .then(() => {
            clearTimeout(timeoutId);
            window._youtubeAccessible = true;
        })
        .catch(() => {
            clearTimeout(timeoutId);
            window._youtubeAccessible = false;
        });
}

function tryLoadYoutube(container, videoId) {
    const fallbackUrl = container.getAttribute('data-fallback-url');

    // Helper to show error message on the container
    function showErrorMessage(useFallback) {
        // Check if error message already exists
        if (container.querySelector('.youtube-error-msg')) return;
        const errorMsg = document.createElement('div');
        errorMsg.className = 'youtube-error-msg';
        errorMsg.innerHTML = useFallback && fallbackUrl ? `
            <span>Unable to connect to YouTube.</span>
            <span>Loading from fallback source...</span>
        ` : `
            <span>Unable to connect to YouTube.</span>
            <span>Opening in a new tab...</span>
        `;
        errorMsg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;background:rgba(0,0,0,0.8);padding:16px 24px;border-radius:8px;text-align:center;z-index:10;display:flex;flex-direction:column;gap:4px;font-size:0.95rem;';
        container.appendChild(errorMsg);
        // Remove message after a few seconds
        setTimeout(() => {
            if (errorMsg.parentNode) errorMsg.parentNode.removeChild(errorMsg);
        }, 1000);
    }

    // Check if YouTube is accessible based on pre-check
    if (window._youtubeAccessible === false) {
        // YouTube is not accessible, try fallback or open in new tab
        if (fallbackUrl) {
            showErrorMessage(true);
            // Load from fallback URL
            const iframe = document.createElement('iframe');
            iframe.setAttribute('width', '100%');
            iframe.setAttribute('height', '100%');
            iframe.setAttribute('src', fallbackUrl);
            iframe.setAttribute('title', 'Video player');
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.setAttribute('allowfullscreen', '');
            iframe.onload = () => {
                container.style.backgroundImage = 'none';
                const overlay = container.querySelector('.youtube-overlay');
                if (overlay) overlay.style.display = 'none';
            };
            container.appendChild(iframe);
        } else {
            showErrorMessage(false);
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        }
        return;
    }

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.setAttribute('width', '100%');
    iframe.setAttribute('height', '100%');
    iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=1`);
    iframe.setAttribute('title', 'YouTube video player');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');

    // On successful load
    iframe.onload = () => {
        // Hide the cover and overlay
        container.style.backgroundImage = 'none';
        const overlay = container.querySelector('.youtube-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    };

    // On error (network failure, etc.)
    iframe.onerror = () => {
        showErrorMessage();
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    };

    // Append iframe to container
    container.appendChild(iframe);
}

// Initialize drag scroll for horizontal scrolling containers
function initDragScroll() {
    const scrollContainers = document.querySelectorAll('.featured-projects-scroll, .featured-artworks-scroll');
    
    scrollContainers.forEach(container => {
        let isDown = false;
        let startX;
        let scrollLeft;
        let hasDragged = false; // true when current interaction is considered a drag
        let dragOccurred = false; // remembers if a drag happened (used to suppress click)
        let pointerDisabled = false;
        let velocity = 0;
        let lastX = 0;
        let lastTime = 0;
        let momentumID;

        // Configurable tuning constants
        const SCROLL_MULTIPLIER = 1; // 1:1 mapping between pointer delta and scroll delta
        const MOMENTUM_FACTOR = 16; // multiplier for velocity->momentum (lower => slower)
        const FRICTION = 0.85; // momentum decay (lower => faster stop)
        const MAX_VELOCITY = 1.5; // clamp velocity (px per ms) to avoid huge jumps

        // Prevent native drag (images/links)
        container.addEventListener('dragstart', (e) => e.preventDefault());

        container.addEventListener('mousedown', (e) => {
            // Start tracking; do not preventDefault here so clicks still register when no drag
            isDown = true;
            hasDragged = false;
            dragOccurred = false;
            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none';
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            lastX = e.pageX;
            lastTime = Date.now();
            velocity = 0;

            // Cancel any ongoing momentum
            if (momentumID) {
                cancelAnimationFrame(momentumID);
            }
        });

        container.addEventListener('mouseleave', () => {
            if (isDown && hasDragged) {
                beginMomentumTracking();
            }
            isDown = false;
            container.style.cursor = 'grab';
            container.style.userSelect = 'auto';

            // Re-enable pointer events if we disabled them
            if (pointerDisabled) {
                setTimeout(() => {
                    const cards = container.querySelectorAll('.scroll-card, .art-scroll-card');
                    cards.forEach(card => card.style.pointerEvents = 'auto');
                    pointerDisabled = false;
                    hasDragged = false;
                }, 100);
            } else {
                hasDragged = false;
            }
        });

        container.addEventListener('mouseup', (e) => {
            if (isDown && hasDragged) {
                beginMomentumTracking();
            }
            isDown = false;
            container.style.cursor = 'grab';
            container.style.userSelect = 'auto';

            // Re-enable pointer events after a short delay if we disabled them during drag
            if (pointerDisabled) {
                setTimeout(() => {
                    const cards = container.querySelectorAll('.scroll-card, .art-scroll-card');
                    cards.forEach(card => card.style.pointerEvents = 'auto');
                    pointerDisabled = false;
                    // reset hasDragged after allowing click suppression to run
                    setTimeout(() => { hasDragged = false; }, 0);
                }, 100);
            } else {
                hasDragged = false;
            }
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();

            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * SCROLL_MULTIPLIER; // Scroll speed multiplier

            // When threshold exceeded, mark as drag and disable pointer events on cards
            if (!hasDragged && Math.abs(walk) > 5) {
                hasDragged = true;
                dragOccurred = true;
                // disable pointer events on cards so they don't capture mouse events
                const cards = container.querySelectorAll('.scroll-card, .art-scroll-card');
                cards.forEach(card => card.style.pointerEvents = 'none');
                pointerDisabled = true;
            }

            container.scrollLeft = scrollLeft - walk;

            // Calculate velocity for momentum (px per ms)
            const now = Date.now();
            const dt = now - lastTime;
            if (dt > 0) {
                velocity = (e.pageX - lastX) / dt;
                // clamp velocity to avoid extreme momentum
                velocity = Math.max(Math.min(velocity, MAX_VELOCITY), -MAX_VELOCITY);
            }
            lastX = e.pageX;
            lastTime = now;
        });

        // Prevent click if a drag happened; then clear the flag
        container.addEventListener('click', (e) => {
            if (dragOccurred) {
                e.preventDefault();
                e.stopPropagation();
                dragOccurred = false;
            }
        }, true);

        // Momentum scrolling function
        function beginMomentumTracking() {
            cancelAnimationFrame(momentumID);
            momentumID = requestAnimationFrame(momentumLoop);
        }

        function momentumLoop() {
            // Apply velocity to scroll
            container.scrollLeft -= velocity * MOMENTUM_FACTOR;
            
            // Deceleration
            velocity *= FRICTION;

            // Continue if still moving
            if (Math.abs(velocity) > 0.01) {
                momentumID = requestAnimationFrame(momentumLoop);
            }
        }

        // Set initial cursor
        container.style.cursor = 'grab';
    });
}