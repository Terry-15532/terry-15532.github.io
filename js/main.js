document.addEventListener('DOMContentLoaded', () => {
    console.log('System Online. Welcome to PRTS Design.');

    // Inject Loader
    const loaderHTML = `
        <div id="loader"><div class="spinner"></div></div>
    `;
    document.body.insertAdjacentHTML('beforeend', loaderHTML);

    // Inject Lightbox
    const lightboxHTML = `
        <div id="lightbox">
            <div id="lightbox-close">×</div>
            <img src="" alt="Full Size Art">
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', lightboxHTML);

    // Initial Setup
    initPage();
    initBackgroundAnimation();
    initNavbarScroll(); // Added Navbar Scroll Logic
    initThemeToggle(); // Initialize theme toggle
    checkYoutubeConnectivity(); // Check if YouTube is accessible

    // Handle Browser Back/Forward
    window.addEventListener('popstate', () => {
        const path = window.location.hash.slice(1) || 'index.html';
        loadPage(path, false);
    });

    // Check for file protocol
    if (window.location.protocol === 'file:') {
        console.warn('Warning: SPA navigation (fetch API) may be blocked by CORS when running from file://. Please use a local server (e.g. Live Server extension) for full functionality.');
    }

    // Allow runtime updates to the controller config (class method provided below)

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
            if (link) {
                e.preventDefault();
            }
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
    // Re-attach event listeners and initialize effects
    initHoverEffects();
    // initGlitchEffect(); // Disabled
    initScrollAnimations();
    updateActiveNav();
    initDecoAnimations(); // New function
    initDotController(); // Initialize 3D dots controller
    initArtworksDot(); // Initialize rocket dots for art page
    initAboutController(); // Initialize controller on About page image area
    initLightbox(); // Initialize Lightbox
    initAboutButton(); // Initialize about button visibility
    initYoutubeLazyLoad(); // Initialize YouTube lazy loading
}

function initAboutButton() {
    const aboutFloatingBtn = document.querySelector('.about-floating-btn');
    if (aboutFloatingBtn) {
        // Initially hide the button (navbar is visible on page load)
        aboutFloatingBtn.classList.add('btn-hidden');
    }
}

function initDecoAnimations() {
    // Randomize coordinates occasionally - REMOVED as per request
    /*
    const locElement = document.querySelector('.deco-info-br span:nth-child(2)');
    if (locElement) {
        setInterval(() => {
            const lat = (31.2304 + (Math.random() - 0.5) * 0.01).toFixed(4);
            const lng = (121.4737 + (Math.random() - 0.5) * 0.01).toFixed(4);
            locElement.innerText = `LOC: ${lat}° N, ${lng}° E`;
        }, 2000);
    }
    */
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
            // Backwards-compatible: dotSize kept for older usage
            dotSize: 1.2,
            // New: more explicit dot radius
            dotRadius: 1.2,
            // Separate radius values for light/dark themes (fallback to dotRadius if not provided)
            dotRadiusLight: 1.2,
            dotRadiusDark: 1.2,
            // Color settings (light/dark can be customized)
            dotColorLight: '#000000',
            dotColorDark: '#ffffff',
            // Optional override for a fixed dot color (skips theme choice)
            dotColor: null,
            repulsionRadius: 30,
            repulsionStrength: 5,
            // Velocity-based impulse repulsion: pointer movement applies an impulse to dot velocity
            repulsionImpulseScale: 0.03,
            // Decay factor applied to per-dot velocities each frame (0..1)
            velocityDecay: 0.9,
            maxVelocity: 100,
            // Multiplier to increase how far points scatter initially (1.0 = default radius)
            initialScatterMultiplier: 6.0,
            // Global transformation applied to all points when rendering (useful for tuning)
            globalScale: 1.0,
            globalOffsetX: 0,
            globalOffsetY: 0,
            // Edge fade options: if true, dots become transparent when near canvas edges
            edgeFade: false,
            // Fraction of canvas size used as threshold for fade (0.1 = 10%)
            edgeFadeThreshold: 0.08,
            // Exponent for fade curve (1 = linear, 2 = quadratic)
            edgeFadePower: 1,
            squeezeStrength: 0.1,
            // Damping (lerp) multipliers: how fast points move when repelled vs when returning to base
            repulsionDamping: 0.9, // faster interpolation when being pushed by pointer
            returnDamping: 0.02 // slower interpolation when returning to base position
            // Idle animation config
            , idleSpeed: 1.0 // multiplier for idle motion speed (1.0 = default)
            , idleAmplitude: 1.0 // multiplier for idle motion amplitude (1.0 = default)
            , baseIdleAmp: 0.8 // base per-point idle amplitude before random variation
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

        this.state = {
            pointerX: null, pointerY: null,
            scrollSqueeze: 0, targetScrollSqueeze: 0,
            squeezeAnchor: 0, targetSqueezeAnchor: 0,
            screenOffsetY: 0, targetScreenOffsetY: 0,
            centerOffsetY: 0,
            lastScrollY: window.scrollY,
            lastScrollTime: performance.now(),
            focusLevel: 0, // 0 = scattered, 1 = assembled
            targetFocusLevel: 1
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
        // Initialize events first so we can detect visibility before heavy sampling
        this.setupEvents();
        this.setupPoints();
        this.resize();
        this.draw();
    }

    async setupPoints() {
        // Performance optimization: Cache points to avoid re-sampling and keep state
        if (!DotController.cache) DotController.cache = {};
        const cacheKey = this.canvas.id;

        if (DotController.cache[cacheKey]) {
            this.points = DotController.cache[cacheKey].points;
            // Start scattered if restoring, to allow re-assembly animation
            this.state.focusLevel = 0;
            this.state.targetFocusLevel = 1;
            return;
        }

        // Async generation to avoid blocking UI
        await new Promise(resolve => setTimeout(resolve, 0));

        const { svgPaths, viewBoxSize, designW, designH, totalSamples, dotRadius, dotSize, dotRadiusLight, dotRadiusDark, dotColorLight, dotColorDark } = this.config;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tmpSvg = document.createElementNS(svgNS, 'svg');
        tmpSvg.style.position = 'absolute';
        tmpSvg.style.left = '-9999px';
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
                        // Per-point idle amplitude is a slightly randomized base so points feel organic.
                        idleAmp: ((typeof this.config.baseIdleAmp === 'number' ? this.config.baseIdleAmp : 0.8) * (0.8 + Math.random() * 0.4)),
                        // Per-dot size factor so we can scale differently in dark/light mode
                        sizeFactor: (0.9 + Math.random() * 0.4)
                        , vx: 0, vy: 0
                    });
                }
            });

            // Save to cache
            DotController.cache[cacheKey] = {
                points: this.points
            };

        } catch (e) {
            console.error('Error sampling SVG', e);
        } finally {
            if (tmpSvg.parentNode) document.body.removeChild(tmpSvg);
        }
    }

    setupEvents() {
        this.canvas.style.touchAction = 'none';
        this.canvas.addEventListener('pointermove', this.onPointerMove);
        this.canvas.addEventListener('pointerdown', this.onPointerMove);
        this.canvas.addEventListener('pointerleave', this.onPointerLeave);
        window.addEventListener('resize', this.resize);
        window.addEventListener('wheel', this.onWheel, { passive: true });
        window.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('focus', this.onFocus);

        try {
            const target = this.canvas.closest('.controller-wrap, .rocket-wrap') || this.canvas.parentElement;
            if (window.ResizeObserver && target) {
                this.ro = new ResizeObserver(this.resize);
                this.ro.observe(target);
            }
            // Visibility observer controls whether the points are scattered or assembled
            const visTarget = target || this.canvas;
            if ('IntersectionObserver' in window) {
                this.io = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const visible = entry.isIntersecting;
                        this.isVisible = visible;
                        this.state.targetFocusLevel = visible ? 1 : 0;
                    });
                }, { threshold: 0.05 });
                this.io.observe(visTarget);
                // Initialize visible flag based on current bounding rect
                const rect = visTarget.getBoundingClientRect();
                this.isVisible = rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
                // Set initial focus based on visibility
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
        const { ctx, canvas, dpr, scale, points, state, config, CONSTANTS } = this;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const dotColor = config.dotColor ? config.dotColor : (isDark ? (config.dotColorDark || '#ffffff') : (config.dotColorLight || '#000000'));

        const cx = canvas.clientWidth / 2;
        const now = performance.now();

        // Smoothly transition focus level
        state.focusLevel += (state.targetFocusLevel - state.focusLevel) * 0.05;
        const focusEase = 1 - Math.pow(1 - state.focusLevel, 3); // Cubic ease

        state.scrollSqueeze += (state.targetScrollSqueeze - state.scrollSqueeze) * 0.12;
        state.targetScrollSqueeze *= 0.92;
        if (Math.abs(state.targetScrollSqueeze) < 0.001) state.targetScrollSqueeze = 0;

        state.squeezeAnchor += (state.targetSqueezeAnchor - state.squeezeAnchor) * 0.12;
        state.targetSqueezeAnchor *= 0.92;
        if (Math.abs(state.targetSqueezeAnchor) < 0.5) state.targetSqueezeAnchor = 0;

        state.screenOffsetY += (state.targetScreenOffsetY - state.screenOffsetY) * CONSTANTS.SCREEN_DAMPING;
        state.targetScreenOffsetY *= CONSTANTS.SCREEN_DECAY;
        if (Math.abs(state.targetScreenOffsetY) < 0.5) state.targetScreenOffsetY = 0;

        const anchorPx = state.squeezeAnchor * scale * CONSTANTS.SCREEN_ANCHOR_INFLUENCE * 0.3;
        const desiredCenter = state.screenOffsetY + anchorPx;
        state.centerOffsetY += (desiredCenter - state.centerOffsetY) * CONSTANTS.CENTER_EASE;

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
                const dx = currentScreenX - state.pointerX;
                const dy = currentScreenY - state.pointerY;
                const dist = Math.hypot(dx, dy);
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
            p.x += (targetX - p.x) * rtn;
            p.y += (targetY - p.y) * rtn;

            // Apply velocity impulses
            // When repulsing, we allow higher velocity influence (repulsionDamping) to let the point fly away.
            const velFactor = inRepulseRange ? (config.repulsionDamping !== undefined ? config.repulsionDamping : 0.1) : (config.returnDamping !== undefined ? config.returnDamping : 0.05);
            p.x += p.vx * velFactor;
            p.y += p.vy * velFactor;
            p.vx *= (config.velocityDecay !== undefined ? config.velocityDecay : 0.92);
            p.vy *= (config.velocityDecay !== undefined ? config.velocityDecay : 0.92);

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
        this.canvas.removeEventListener('pointermove', this.onPointerMove);
        this.canvas.removeEventListener('pointerdown', this.onPointerMove);
        this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
        window.removeEventListener('resize', this.resize);
        window.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('scroll', this.onScroll);
        window.removeEventListener('focus', this.onFocus);
        // no blur listener used for scatter anymore
        if (this.ro) this.ro.disconnect();
        // Remove runtime reference
        if (window._dotControllers && window._dotControllers[this.canvas.id]) delete window._dotControllers[this.canvas.id];
    }
}

function initAboutController() {
    initDotController('about-canvas');
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



function initAboutController(canvasId = 'about-canvas') {
    const aboutPaths = [
        "M 435.072 83.6352 C 436.716 90.7081 441.549 102.968 443.997 110.229 C 453.892 139.58 466.586 168.033 477.75 196.901 C 497.105 247.045 514.69 297.854 530.472 349.234 C 549.37 410.028 565.004 462.331 564.994 526.671 C 564.987 563.833 559.627 613.724 572.975 648.211 C 618.64 644.521 655.248 648.854 698.03 667.748 C 710.41 673.216 729.666 686.34 742.34 688.677 C 749.249 689.951 765.132 679.001 770.639 674.317 C 793.47 654.901 801.992 626.573 815.941 601.199 C 821.765 590.604 830.988 579.546 838.9 570.354 C 861.989 543.528 888.384 519.393 913.997 494.945 C 933.832 475.798 953.39 456.366 972.663 436.654 C 1029.1 378.406 1078.9 318.923 1137.52 261.458 C 1133.06 274.144 1127.59 298.745 1123.44 313.063 C 1111.09 355.628 1098.55 397.954 1085.34 440.027 C 1057.78 527.831 1027.5 591.425 948.117 642.293 C 921.778 659.229 892.865 673.584 864.369 686.669 C 835.132 700.094 816.203 711.133 791.542 731.589 C 802.68 746.927 814.239 763.114 822.884 780.082 C 860.124 853.18 868.57 940.914 876.753 1021.45 C 880.838 1061.65 884.692 1102.86 898.505 1141.15 C 910.296 1173.84 938.029 1206.4 960.232 1232.54 C 992.91 1271.03 1029.07 1311.81 1046.74 1359.75 C 1062.83 1403.4 1078.63 1470.08 1058.87 1514.4 C 1068.42 1475.22 1059.59 1429.61 1043.66 1393.2 C 1053.33 1439.51 1066.85 1491.22 1024.07 1526.08 C 1026.68 1522.39 1030.16 1518.86 1032.38 1514.85 C 1079.55 1429.74 973.038 1304.01 915.167 1252.58 C 939.915 1295.92 958.507 1344.49 934.251 1392.85 C 950.842 1325.17 926.733 1272.36 880.478 1223.55 C 832.441 1172.87 810.319 1145 796.124 1074.79 C 787.192 1097.56 772.174 1121.91 751.848 1136.1 C 745.829 1140.31 735.037 1146.12 727.444 1144.67 L 728.014 1142.67 C 740.037 1135.94 744.766 1122.63 749.816 1110.29 C 730.693 1131.55 726.711 1137.27 699.123 1149.54 C 718.381 1149.22 749.669 1146.37 766.118 1155.84 C 781.323 1164.59 780.013 1184.27 784.235 1200.15 L 784.546 1201.3 C 795.875 1211.7 808.953 1216.44 819.329 1229.12 C 831.985 1244.57 825.368 1264.85 836.315 1279.24 C 842.717 1287.65 864.203 1292.59 868.91 1302.51 C 880.47 1326.72 887.054 1353.11 896.642 1377.99 C 915.675 1427.38 940.788 1475.13 967.638 1520.69 C 982.888 1546.56 997.929 1572.45 1013.24 1598.24 C 1053.48 1666.31 1094.43 1733.96 1136.1 1801.16 C 1055.4 1800.17 971.463 1800.85 890.659 1801.25 C 889.21 1775.21 881.911 1730.14 878.067 1703.5 C 868.714 1637.53 857.551 1571.82 844.591 1506.46 C 827.928 1539.72 784.664 1578.68 750.22 1592.99 C 745.956 1594.76 739.359 1589.9 735.909 1587.62 C 741.654 1605.61 748.154 1642.39 752.021 1662.06 C 758.391 1694.07 764.101 1726.21 769.148 1758.46 C 771.32 1772.94 774.566 1792.6 774.58 1806.79 C 770.292 1792.26 766.126 1764.77 763.084 1748.62 C 756.821 1716.28 750.343 1683.99 743.649 1651.75 C 737.399 1616.53 725.642 1577.22 714.986 1543.22 C 714.301 1582.61 697.147 1616.52 712.832 1656.94 C 698.541 1636.37 692.169 1619.21 691.523 1594.44 C 684.212 1617.4 681.612 1623.4 670.24 1645.41 C 670.936 1658.61 677.014 1690.58 679.15 1704.89 C 683.738 1736.94 687.916 1769.04 691.683 1801.2 C 680.735 1801.08 669.787 1801.12 658.841 1801.32 C 655.819 1759.71 649.032 1718.14 644.208 1676.71 C 643.579 1671.31 642.894 1666.09 641.665 1660.79 L 639.958 1660.58 C 630.354 1664.56 633.97 1670.38 627.65 1676.18 C 623.257 1677.82 617.831 1676.7 616.419 1671.91 C 614.059 1663.89 623.186 1663.35 618.417 1654.42 C 615.38 1653.02 616.764 1653.13 613.407 1654.15 C 610.473 1657.29 609.381 1662.32 607.995 1666.04 C 597.486 1694.22 569.176 1670.85 572.825 1648.6 C 574.307 1639.55 577.5 1633.27 586.499 1637.94 C 592.892 1646.47 584.979 1646.28 583.983 1655.51 C 586.039 1659.89 589.803 1661.13 594.168 1659.16 C 597.717 1654.49 596.934 1649.6 599.152 1644.85 C 603.255 1636.06 612.809 1635.23 620.411 1639.65 C 629.253 1644.8 629.958 1646.78 632.672 1656.2 C 634.748 1647.06 638.899 1636.77 640.257 1627.16 C 654.464 1526.61 638.881 1382.34 571.676 1303.18 C 549.253 1276.77 438.781 1242.08 402.874 1234.13 C 383.354 1229.74 363.531 1226.83 343.574 1225.43 C 299.11 1222 265.726 1225.98 222.861 1226.79 C 232.42 1218.96 241.711 1206.38 251.097 1197.16 C 264.346 1184.15 285.552 1174.16 293.913 1157.58 C 298.14 1149.2 311.268 1144.6 319.237 1140.95 C 309.592 1141.54 302.43 1142.11 292.904 1143.55 C 286.357 1151.62 281.265 1164.46 274.083 1171.56 C 266.733 1178.83 256.339 1186.41 248.123 1193.37 C 231.868 1206.88 216.21 1221.09 201.191 1235.97 C 220.586 1235.75 240.139 1233.04 259.512 1234.32 C 311.963 1237.79 378.366 1267.63 420.721 1297.91 C 444.735 1315.08 465.944 1334.69 481.932 1359.7 C 537.921 1447.29 554.049 1629.44 565.996 1733.57 C 568.566 1755.97 569.678 1779.04 573.357 1801.24 C 557.226 1801.04 541.094 1801.03 524.963 1801.21 C 530.094 1779.22 527.24 1734.62 525.846 1711.04 C 524.162 1682.54 522.521 1650.42 519.766 1622.07 C 509.24 1620.51 496.24 1618.07 486.026 1615.39 C 481.397 1607.16 476.488 1593.02 473.084 1583.81 C 474.857 1599.36 475.971 1607.56 480.422 1622.47 C 488.408 1624.43 499.572 1624.97 506.131 1630.14 C 513.053 1635.6 520.348 1779.95 522.763 1801.11 L 170.163 1801.2 C 179.368 1781.98 188.835 1766.93 200.996 1749.53 C 204.725 1744.2 208.471 1731.83 212.772 1727.67 C 233.571 1707.56 278.836 1706.33 305.444 1703.84 C 294.392 1701.95 283.513 1700.14 272.423 1700.14 C 249.912 1700.14 215.344 1712 200.356 1729.51 C 186.978 1745.98 178.581 1766.44 168.294 1784.88 C 164.097 1792.4 163.346 1803.38 153.044 1801.01 C 149.801 1793.16 186 1735.28 189.606 1725.22 C 200.35 1695.22 213.379 1665.21 225.341 1635.78 C 222.796 1627.14 219.889 1610.29 221.536 1601.58 C 223.599 1590.65 233.068 1577.76 237.197 1567.08 C 246.137 1543.96 254.07 1520.97 260.769 1497.13 C 266.528 1476.62 261.451 1461.65 263.911 1440.77 C 266.359 1419.99 274.037 1406.09 280.008 1386.55 C 263.077 1366.18 236.075 1353.11 225.788 1326 C 218.84 1307.69 211.748 1289.12 202.114 1272.05 C 180.824 1288.86 176.664 1304.36 169.776 1328.38 C 166.778 1338.84 154.261 1357.45 146.71 1365.48 C 133.246 1362.34 105.183 1352.94 93.2547 1347.52 C 99.9937 1335.98 106.482 1326.39 115.305 1316.23 C 120.671 1310.05 127.048 1303.97 132.249 1297.81 C 136.501 1292.77 136.337 1287.95 142.401 1282.43 C 155.128 1270.85 168.945 1259.88 181.219 1247.89 C 184.409 1243.57 184.766 1237.03 188.511 1233.09 C 207.285 1213.36 228.564 1196.18 245.469 1174.65 C 254.045 1163.73 261.693 1152.03 270.823 1141.57 C 278.797 1132.19 291.638 1128.19 301.42 1121.59 C 332.468 1100.66 349.792 1087.77 388.908 1086.2 C 387.173 1083.52 385.493 1080.8 383.871 1078.05 C 343.728 1009.55 345.844 924.623 364.845 849.636 C 380.415 788.191 411.171 725.07 461.094 684.424 C 471.658 675.822 483.853 668.703 495.653 661.837 C 486.628 634.009 473.155 605.551 459.269 579.861 C 444.636 552.79 428.6 526.472 417.686 497.588 C 381.82 402.666 410.172 264.334 425.111 166.25 C 429.274 138.913 429.26 110.702 435.072 83.6352 z",
        "M 608.751 962.557 C 598.969 941.126 595.579 911.634 589.13 888.685 C 575.065 885.171 542.3 883.525 531.335 892.791 C 512.248 908.921 489.807 946.538 486.846 971.352 C 500.183 947.124 508.391 942.763 533.172 931.785 C 520.157 934.302 512.64 937.005 501.092 944.373 C 518.404 921.968 551.204 915.626 574.083 934.119 C 582.893 941.241 587.702 943.963 591.93 954.956 L 591.324 955.753 C 583.6 948.105 579.799 945.81 570.486 940.209 C 581.695 952.551 583.921 958.325 585.804 974.963 C 579.676 963.685 577.713 961.629 566.525 954.688 C 567.261 969.262 569.473 985.77 559.163 997.69 C 550.163 1008.09 533.822 1009.93 523.625 1000.37 C 513.319 990.696 514.318 970.427 513.807 957.239 C 492.17 975.832 501.031 991.245 514.851 1010.23 C 501.224 1002.79 497.742 998.798 486.825 987.323 C 486.005 1033.86 500.437 1069.44 543.023 1092.46 C 523.563 1086.87 503.293 1072.51 490.325 1057.06 C 495.269 1097.67 514.178 1117.44 545.545 1141.95 C 560.541 1153.67 594.827 1178.86 615.135 1177.73 C 619.712 1177.48 637.396 1170.56 642.496 1168.64 C 694.885 1146.89 734.3 1129.51 756.828 1074.99 C 758.205 1071.65 759.492 1068.26 760.685 1064.84 C 748.785 1076.39 735.768 1088.91 718.814 1092.9 L 718.631 1092.16 C 743.71 1073.99 762.467 1048.43 772.264 1019.05 L 771.862 1017.57 C 766.841 1017.21 753.34 1029.73 748.069 1032.54 C 743.738 1034.85 740.415 1036.21 735.804 1038 C 756.93 1018.63 758.507 1007.31 743.107 981.8 C 742.021 1001.64 733.718 1031.6 708.381 1029.8 C 702.317 1029.41 696.698 1026.48 692.896 1021.74 C 680.835 1006.61 691.314 979.954 699.756 965.587 C 693.937 969.717 686.793 974.468 681.633 979.227 C 688.923 966.723 696.837 956.401 711.476 952.967 C 731.604 948.245 742.092 951.634 757.132 963.741 C 757.16 949.908 756.765 938.953 755.817 925.203 C 739.151 915.955 724.886 910.098 705.511 909.343 C 698.796 920.219 693.686 931.876 686.727 943.231 C 675.519 961.52 664.234 975.375 651.089 991.868 C 658.805 976.668 686.066 909.902 684.478 895.249 C 680.598 903.399 677.966 913.107 674.296 920.945 C 662.852 945.389 637.141 983.174 616.931 1001.47 C 617.127 970.269 617.647 939.225 615.922 908.067 C 615.37 898.094 615.524 885.41 614.42 875.723 C 609.691 896.126 610.017 940.775 608.751 962.557 z",
        "M 768.328 934.108 C 767.37 943.51 763.988 957.867 761.713 967.364 L 768.818 980.631 C 758.493 970.908 750.671 961.728 737.056 957.496 C 746.315 963.862 750.774 967.669 757.693 976.839 C 763.529 985.747 765.128 990.055 767.685 1000.43 C 770.234 1002.38 772.948 1004.38 775.435 1006.39 C 779.64 980.902 780.947 971.861 779.747 945.781 C 776.528 941.246 772.975 937.263 768.328 934.108 z",
        "M 511.256 750.468 C 509.592 760.806 508.876 775.19 509.061 785.717 C 522.985 771.757 533.218 753.616 543.589 736.798 C 539.615 739.201 531.169 743.66 526.469 742.425 C 528.717 739.526 531.351 737.362 531.432 734.38 C 529.07 734.489 530.218 734.149 528.103 735.982 L 527.068 734.713 C 528.4 728 536.633 719.725 541.33 714.635 L 540.784 714.139 C 491.922 745.26 465.067 789.983 453.148 846.348 C 452.907 847.488 452.98 847.931 453.137 849.035 C 454.084 847.789 459.245 832.787 460.589 829.663 C 464.188 821.435 468.202 813.394 472.613 805.571 C 484.054 786.234 496.973 767.812 511.256 750.468 z",
        "M 694.953 1237.01 C 689.964 1232.27 686.032 1228.34 680.355 1224.35 C 689.283 1223.65 697.876 1220.64 706.705 1218.74 C 714.206 1217.13 720.945 1216.68 728.317 1215.57 C 720.556 1211.83 713.257 1208.44 705.852 1204.01 C 700.51 1204.08 693.046 1203.95 687.884 1204.39 L 685.55 1205.45 C 688.555 1209.79 700.679 1211.79 701.094 1215.51 C 685.515 1220.82 654.752 1212.22 647.423 1215.8 C 666.676 1220.63 666.417 1219.94 682.351 1232.09 C 686.387 1235.28 689.946 1235.81 694.953 1237.01 z",
        "M 889.972 1138.2 C 884.063 1111.21 879.834 1087.81 875.815 1060.52 C 872.932 1040.94 870.721 1005.34 866.358 987.73 C 863.788 1019.18 872.295 1113.45 889.972 1138.2 z",
        "M 754.549 911.524 C 752.527 896.687 738.879 822.855 732.227 811.681 C 731.68 836.628 719.437 876.334 709.004 899.039 C 721.232 898.664 727.947 899.128 739.745 904.001 C 744.585 906.364 749.931 908.832 754.549 911.524 z",
        "M 581.517 1191.35 L 583.433 1190.43 C 575.926 1184.37 535.706 1152.43 528.401 1149.35 C 529.023 1153.1 529.437 1162.36 530.321 1164.28 C 545.256 1174.2 559.638 1184.36 574.092 1194.92 C 575.396 1195.87 580.429 1192.15 581.517 1191.35 z",
        "M 690.805 825.065 L 691.568 826.439 C 694.543 814.097 706.871 757.733 694.915 749.658 C 698.115 770.064 681.832 763.65 683.967 772.309 C 688.698 791.505 691.669 805.012 690.805 825.065 z",
        "M 596.78 1205.2 C 609.085 1205.11 622.866 1207.77 635.022 1209.87 C 633.346 1195.75 641.485 1197.07 641.96 1189.65 C 641.175 1189.09 639.985 1188.12 639.147 1187.83 C 626.137 1193.42 618.371 1195.11 604.361 1197.47 C 599.946 1198.21 589.549 1199.77 585.839 1201.32 C 586.759 1203.95 587.471 1204.1 589.93 1205.76 C 592.202 1205.59 594.521 1205.44 596.78 1205.2 z",
        "M 438.35 1127.26 C 417.783 1094.51 399.892 1054.96 387.027 1018.42 C 385.564 1014.27 381.443 998.29 379.721 995.511 C 380.315 1035.25 412.581 1092.61 435.661 1125.34 C 436.132 1126.01 437.636 1126.85 438.35 1127.26 z",
        "M 607.171 774.467 C 625.001 775.398 629.78 780.333 642.612 782.099 C 656.589 764.082 620.946 762.172 611.585 759.682 C 609.852 764.744 608.222 769.184 607.171 774.467 z",
        "M 673.171 1391.31 C 666.206 1357.97 635.091 1306 607.653 1282.57 C 607.162 1282.28 606.67 1282 606.179 1281.71 C 623.807 1305.23 637.859 1323.69 652.567 1349.48 C 656.457 1356.29 670.469 1387.72 673.171 1391.31 z",
        "M 665.323 1639.83 C 668.01 1633.77 672.099 1619.09 670.511 1612.68 C 668.575 1619.11 662.797 1634.27 665.323 1639.83 z",
        "M 762.644 826.2 C 761.676 809.623 757.39 791.684 747.953 777.797 C 748.557 781.656 761.322 824.81 762.644 826.2 z",
        "M 586.949 874.679 C 585.505 861.734 584.582 848.736 584.184 835.717 C 584.087 831.189 584.526 810.411 582.763 807.839 C 578.513 816.846 568.261 832.04 562.454 841.059 C 555.08 852.511 546.677 866.587 538.922 877.435 C 541.355 877.54 543.475 876.47 545.773 875.579 C 561.882 870.979 570.57 870.802 586.949 874.679 z",
        "M 372.541 1663.08 C 359.848 1657.52 334.091 1647.59 320.349 1647.93 C 327.267 1650.74 365.961 1662.55 372.541 1663.08 z",
        "M 630.239 1239.33 L 632.15 1237.04 C 629.462 1233.01 619.183 1232.9 614.561 1233.19 C 612.623 1241.26 624.917 1240.98 630.239 1239.33 z",
        "M 770.086 923.127 C 772.628 925.628 775.098 927.883 777.246 930.732 L 778.2 931.072 C 778.552 927.126 776.87 897.867 775.782 895.534 C 774.172 903.903 772.3 915.153 770.086 923.127 z",
        "M 761.02 717.241 C 745.259 698.856 713.238 678.929 688.525 678.006 C 711.106 687.27 732.661 697.304 752.704 711.424 C 755.511 713.402 758.1 715.401 761.02 717.241 z",
        "M 661.746 782.707 L 663.498 781.76 C 664.802 775.922 664.348 773.159 661.816 767.933 C 659.285 766.25 659.663 766.794 656.165 766.541 C 654.578 770.938 652.151 776.167 653.817 780.474 C 656.782 782.979 657.348 782.286 661.746 782.707 z",
        "M 514.132 617.179 C 515.27 598.964 515.859 582.738 514.127 564.574 C 511.986 542.123 505.913 516.987 504.208 494.845 C 500.459 446.175 502.232 402.889 494.052 354.235 C 484.217 295.739 467.128 242.48 450.523 185.834 C 445.391 168.328 443.251 151.768 439.212 134.617 L 438.206 133.682 C 435.379 164.51 432.102 195.294 428.375 226.026 C 418.026 306.061 400.487 404.674 428.801 482.579 C 447.584 534.259 480.193 582.637 503.587 631.747 C 504.977 628.447 491.975 599.833 493.22 595.051 C 497.068 596.836 494.913 598.652 499.038 600.422 C 497.709 594.488 496.111 590.197 494.617 584.602 L 505.681 604.671 C 503.771 595.177 501.666 585.723 499.367 576.315 C 504.671 586.433 510.962 605.773 514.132 617.179 z",
        "M 656.761 666.739 L 659.074 666.485 C 646.338 659.55 601.015 657.332 584.796 657.322 L 581.569 658.375 L 581.843 659.946 C 588.898 663.582 607.183 662.619 615.763 662.857 C 629.753 663.245 642.885 664.81 656.761 666.739 z",
        "M 234.152 1597.16 C 236.013 1604.35 237.709 1610.38 238.663 1617.77 L 239.673 1619.89 C 241.457 1617.89 242.579 1611.71 242.992 1608.9 C 245.975 1587.65 264.491 1570.7 270.374 1551.06 C 277.126 1528.51 279.861 1504.35 286.011 1481.44 C 287.458 1476.05 298.824 1440.62 298.453 1438.8 C 286.128 1459.14 276.67 1477.14 270.21 1500.17 C 265.044 1518.58 261.008 1540.03 254.298 1557.69 C 249.854 1569.39 240.208 1585.68 234.152 1597.16 z",
        "M 905.91 614.535 C 893.887 626.719 882.561 637.633 870.496 649.478 C 873.828 648.441 885.609 644.257 888.128 644.912 L 887.141 645.737 C 879.355 651.947 871.457 658.015 863.452 663.94 C 934.929 644.445 995.579 597.056 1031.78 532.416 C 1039.66 518.139 1046.64 503.388 1052.69 488.247 C 1059.85 470.377 1115.95 312.063 1115.53 304.898 C 1079.81 357.526 1039.74 411.164 1004.49 464.378 C 989.951 486.323 888.072 600.773 890.54 617.105 C 893.509 618.647 895.765 618.02 898.957 616.997 C 901.292 616.226 903.61 615.405 905.91 614.535 z",
        "M 701.015 993.543 C 686.498 1015.83 706.504 1033.57 724.04 1011.93 C 726.181 1006.34 727.666 1002 729.349 996.253 C 725.254 1001.25 718.938 1008.16 712.632 1010.27 C 703.122 1009.49 703.756 1000.21 701.015 993.543 z",
        "M 937.188 1220.61 C 960.8 1258.42 985.302 1290.95 1011.9 1326.61 C 1016.44 1332.7 1030.55 1355.89 1034.18 1359.32 C 1021.97 1318.96 983.481 1271.37 955.923 1239.31 C 952.514 1235.34 941.398 1223.03 937.188 1220.61 z",
        "M 550.316 1186.77 C 602.844 1235.49 668.219 1338.4 693.521 1405.51 C 697.717 1416.95 701.185 1428.64 703.907 1440.52 C 705.4 1447.11 709.955 1470.82 712.314 1475.49 C 710.645 1401.53 632.128 1258.77 576.335 1206.89 C 571.153 1202.07 556.697 1188.52 550.316 1186.77 z",
        "M 477.775 724.993 C 423.826 774.854 402.752 832.318 398.885 905.549 C 397.085 939.649 399.49 985.524 409.814 1017.9 L 410.747 1018.19 C 409.677 1002.54 406.095 988.243 405.609 971.569 C 404.048 917.963 413.509 854.588 433.759 805.162 C 444.068 779.929 457.263 755.974 473.081 733.775 C 474.95 731.148 479.258 726.447 477.775 724.993 z"

    ];

    new DotController(canvasId, {
        designW: 680,
        designH: 620,
        viewBoxSize: 1900,
        totalSamples: 1300,
        svgPaths: aboutPaths,
        dotRadiusDark: 1.1,
        dotRadiusLight: 1.5,
        idleAmplitude: 1.3,
        idleSpeed: 1.1,
        globalOffsetX: 70,
    });
}


function initNavbarScroll() {
    let lastScrollY = window.scrollY;
    const nav = document.querySelector('nav');

    window.addEventListener('scroll', () => {
        if (!nav) return;

        const currentScrollY = window.scrollY;
        const floatingControls = document.querySelector('.project-controls');
        const aboutFloatingBtn = document.querySelector('.about-floating-btn');

        // Hide immediately when scrolling down (threshold > 0)
        if (currentScrollY > lastScrollY && currentScrollY > 0) {
            // Scrolling down -> Hide navbar
            nav.classList.add('nav-hidden');
            if (floatingControls) floatingControls.classList.add('controls-hidden');
            if (aboutFloatingBtn) aboutFloatingBtn.classList.remove('btn-hidden');
        } else {
            // Scrolling up -> Show navbar
            nav.classList.remove('nav-hidden');
            if (floatingControls) floatingControls.classList.remove('controls-hidden');
            if (aboutFloatingBtn) aboutFloatingBtn.classList.add('btn-hidden');
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

function initGlitchEffect() {
    // Clear existing intervals if any (to prevent memory leaks on page change)
    if (window.glitchInterval) clearInterval(window.glitchInterval);

    const glitchTexts = document.querySelectorAll('.glitch-text');
    window.glitchInterval = setInterval(() => {
        glitchTexts.forEach(text => {
            if (Math.random() > 0.95) {
                text.style.textShadow = `${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px #ff00c1`;
                setTimeout(() => {
                    text.style.textShadow = 'none';
                }, 100);
            }
        });
    }, 2000);
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
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Select elements to animate (exclude .card and .project-gallery img)
    const elementsToAnimate = document.querySelectorAll('.hero h1, .hero p, .section-title, .project-header, .project-content, .webgl-container');
    elementsToAnimate.forEach(el => {
        el.classList.add('fade-in-up');
        observer.observe(el);
    });
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

    // Add click listeners to art cards
    const artCards = document.querySelectorAll('.art-card');
    artCards.forEach(card => {
        // Skip art cards that are links (have href attribute)
        if (card.tagName === 'A' && card.hasAttribute('href')) {
            card.style.cursor = 'pointer';
            return;
        }

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

    // Add click listeners to project gallery images - DISABLED
    /*
    const projectGalleryImages = document.querySelectorAll('.project-gallery img');
    projectGalleryImages.forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            lightboxImg.src = img.src;
            lightbox.classList.add('active');
        });
    });
    */

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

            // Handle about floating button - only exists in index.html
            const currentAboutBtn = document.querySelector('.about-floating-btn');
            const newAboutBtn = doc.querySelector('.about-floating-btn');
            if (currentAboutBtn && !newAboutBtn) {
                currentAboutBtn.remove();
            } else if (newAboutBtn && !currentAboutBtn) {
                document.body.appendChild(newAboutBtn);
            }

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
