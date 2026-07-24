/* ===================================
   MotionUX - ambient motion, scroll feedback
   and micro-interactions for PRTS Design.
   Exposed as window.MotionUX and re-initialised
   on every SPA page swap via main.js initPage().
   =================================== */
(function () {
    'use strict';

    const lerp = (a, b, t) => a + (b - a) * t;
    const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const EASE_INOUT = 'cubic-bezier(0.7, 0, 0.2, 1)';

    /* ---------- Global ambient loop (runs once) ---------- */
    let ambientStarted = false;
    let artCols = [];

    function startAmbientLoop() {
        if (ambientStarted) return;
        ambientStarted = true;

        const orbWraps = [
            { el: document.querySelector('.orb-wrap-1'), sx: 0.05, sy: 0.08, mx: 26, my: 18 },
            { el: document.querySelector('.orb-wrap-2'), sx: -0.08, sy: -0.05, mx: -34, my: 24 },
            { el: document.querySelector('.orb-wrap-3'), sx: 0.11, sy: -0.09, mx: 18, my: -30 }
        ].filter(o => o.el);

        const decoText = document.querySelector('.deco-text-bg');

        let targetScroll = window.scrollY;
        let smoothScroll = targetScroll;
        let mouseX = 0.5, mouseY = 0.5;
        let smoothMX = 0.5, smoothMY = 0.5;

        window.addEventListener('scroll', () => {
            targetScroll = window.scrollY;
        }, { passive: true });

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX / window.innerWidth;
            mouseY = e.clientY / window.innerHeight;
        }, { passive: true });

        function frame() {
            smoothScroll = lerp(smoothScroll, targetScroll, 0.075);
            smoothMX = lerp(smoothMX, mouseX, 0.05);
            smoothMY = lerp(smoothMY, mouseY, 0.05);

            for (const o of orbWraps) {
                let px = smoothScroll * o.sx + (smoothMX - 0.5) * o.mx * 2;
                let py = smoothScroll * o.sy + (smoothMY - 0.5) * o.my * 2;
                // Constrain to ±30% screen dimensions from initial position
                const hw = window.innerWidth * 0.3;
                const hh = window.innerHeight * 0.3;
                px = clamp(px, -hw, hw);
                py = clamp(py, -hh, hh);
                o.el.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
            }

            if (decoText) {
                decoText.style.transform = `translate3d(${(-smoothScroll * 0.22).toFixed(2)}px, 0, 0)`;
            }

            if (artCols.length > 1 && artGridEl) {
                for (const col of artCols) col.el.style.transform = '';
                const rect = artGridEl.getBoundingClientRect();
                const vh = window.innerHeight;
                const diff = rect.height - vh;
                // Use actual scroll position (not smoothed) for instant response
                const p = diff > 0 ? Math.min(1, Math.max(0, -rect.top / diff)) : 0;
                let maxH = 0;
                for (const col of artCols) {
                    if (col.h > maxH) maxH = col.h;
                }
                for (const col of artCols) {
                    const shift = (maxH - col.h) * p;
                    col.el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
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
        artCols.forEach(c => { c.el.style.transform = ''; });
        requestAnimationFrame(() => {
            artCols.forEach(c => { c.h = c.el.offsetHeight; });
        });
    }

    function initArtColumns() {
        const grid = document.querySelector('.art-grid');
        if (!grid) { artCols = []; artGridEl = null; return; }
        artGridEl = grid;
        if (grid.dataset.columnized === String(columnCount())) { measureArtCols(); return; }

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
        // Distribute cards by estimated height balance (not round-robin)
        const colHeights = Array(n).fill(0);
        cards.forEach(card => {
            // Estimate height from image aspect ratio if available
            const img = card.querySelector('img');
            let h = 300; // default
            if (img && img.naturalWidth > 0) {
                h = (img.naturalHeight / img.naturalWidth) * 300;
            }
            // Pick the shortest column
            let minIdx = 0;
            for (let c = 1; c < n; c++) {
                if (colHeights[c] < colHeights[minIdx]) minIdx = c;
            }
            cols[minIdx].appendChild(card);
            colHeights[minIdx] += h + 20; // 20px gap
        });

        grid.dataset.columnized = String(n);
        artCols = cols.map(el => ({ el, h: 0 }));

        measureArtCols();
        grid.querySelectorAll('img').forEach(img => {
            if (!img.complete) img.addEventListener('load', measureArtCols, { once: true });
        });
        setTimeout(measureArtCols, 1200);
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const grid = document.querySelector('.art-grid');
            if (grid && grid.dataset.columnized !== String(columnCount())) {
                delete grid.dataset.columnized;
            }
            initArtColumns();
        }, 200);
    });

    /* ---------- Ripple hover (wavy mask that hands over to a fill) ---------- */
    const RIPPLE_SELECTOR = [
        '.rhombus-btn', '.featured-cta-btn', '.featured-arts-btn', '.game-start-btn',
        '.icon-link', '.footer-social-link', '.theme-toggle', '.lang-switcher-btn',
        '.scroll-card', '.art-scroll-card', '.card'
    ].join(', ');

    const SOLID_SELECTOR = [
        '.featured-cta-btn', '.featured-arts-btn', '.game-start-btn',
        '.icon-link', '.footer-social-link', '.theme-toggle', '.lang-switcher-btn'
    ].join(', ');

    function spawnInk(el, x, y, startScale) {
        const ink = document.createElement('span');
        ink.className = 'ripple-ink';
        ink.style.left = `${x}px`;
        ink.style.top = `${y}px`;
        if (startScale) ink.style.transform = `translate(-50%, -50%) scale(${startScale})`;
        el.appendChild(ink);
        return ink;
    }

    function bindRipple(el) {
        if (el.dataset.rippleBound) return;
        el.dataset.rippleBound = '1';
        el.classList.add('ripple-host');

        const solid = el.matches(SOLID_SELECTOR);
        el.classList.add(solid ? 'ripple-solid' : 'ripple-tint');

        if (solid) {
            const wrap = document.createElement('span');
            wrap.className = 'ripple-content';
            while (el.firstChild) wrap.appendChild(el.firstChild);
            el.appendChild(wrap);
        }

        let growAnim = null;
        let liveInks = [];
        let isHovering = false;
        let elRect = null;
        let maxScale = 3;
        let inkDur = 300;
        let cursorGlow = null;

        /* global glow — fixed positioning avoids overflow:hidden clipping */
        /* per-element glow inside ripple host */
        function ensureCursorGlow() {
            if (!cursorGlow || !document.contains(cursorGlow)) {
                cursorGlow = document.createElement('div');
                cursorGlow.className = 'cursor-glow';
                el.appendChild(cursorGlow);
            }
            return cursorGlow;
        }

        function exitInks() {
            const frozen = [...liveInks].filter(ink => document.contains(ink));
            liveInks = [];
            if (growAnim) { try { growAnim.cancel(); } catch (_) { } growAnim = null; }
            const rect = el.getBoundingClientRect();
            // Detect text side and exit from the OPPOSITE side
            let exitX = rect.width / 2;
            let exitY = rect.height + 10;
            const textEl = el.querySelector('.card-content, .card-info, .project-card-info, .art-info, .card-body, .card-text, .card-overlay-content');
            if (textEl) {
                const tr = textEl.getBoundingClientRect();
                const textCenterX = tr.left - rect.left + tr.width / 2;
                // If text is on the left, exit from right; if on right, exit from left
                exitX = textCenterX < rect.width / 2 ? rect.width + 10 : -10;
                exitY = rect.height / 2;
            }
            frozen.forEach(ink => {
                const cs = getComputedStyle(ink);
                const t = cs.transform;
                const o = cs.opacity;
                const r = cs.borderRadius;
                ink.getAnimations().forEach(a => { try { a.cancel(); } catch (_) { } });
                ink.style.animation = 'none';
                ink.style.transform = t;
                ink.style.opacity = o;
                ink.style.borderRadius = r;
                ink.style.left = exitX + 'px';
                ink.style.top = exitY + 'px';
                const m = t.match(/matrix\(([^)]+)\)/);
                let curScale = 1;
                if (m) { const p = m[1].split(',').map(Number); curScale = Math.abs(p[0]) || 1; }
                const curOp = parseFloat(o) || 0;
                ink.animate(
                    [{ transform: `translate(-50%, -50%) scale(${curScale.toFixed(3)})`, opacity: curOp },
                     { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 }],
                    { duration: 250, easing: 'cubic-bezier(0.4, 0, 0.8, 1)', fill: 'forwards' }
                );
                setTimeout(() => ink.remove(), 340);
            });
        }

        function moveInks(x, y) {
            if (!liveInks.length) return;
            for (const ink of liveInks) {
                ink.style.left = x + 'px';
                ink.style.top = y + 'px';
            }
        }

        el.addEventListener('pointerenter', (e) => {
            if (!finePointer) return;
            isHovering = true;

            const oldInks = el.querySelectorAll('.ripple-ink');
            oldInks.forEach(i => {
                i.style.transition = 'opacity 0.2s ease';
                i.style.opacity = '0';
                setTimeout(() => i.remove(), 250);
            });
            liveInks = [];
            if (growAnim) { try { growAnim.cancel(); } catch (_) { } growAnim = null; }

            el.classList.add('ripple-filled');
            if (solid) el.classList.add('rippling');

            elRect = el.getBoundingClientRect();
            maxScale = (Math.hypot(elRect.width, elRect.height) / 24) * 2;
            inkDur = solid ? 300 : 450;
            el.dataset.maxScale = maxScale;

            // Show cursor glow only on large interactive elements (skip nav, small buttons)
            if (!el.classList.contains('nav-item') &&
                !el.classList.contains('rhombus-btn') &&
                !el.classList.contains('lang-switcher-btn') &&
                !el.classList.contains('theme-toggle') &&
                !el.classList.contains('footer-social-link')) {
                const glow = ensureCursorGlow();
                glow.style.left = (e.clientX - elRect.left) + 'px';
                glow.style.top = (e.clientY - elRect.top) + 'px';
                glow.classList.add('active');
            }

            const x = e.clientX - elRect.left;
            const y = e.clientY - elRect.top;
            const sub = spawnInk(el, x, y);
            sub.classList.add('sub');
            const ink1 = spawnInk(el, x, y);
            liveInks = [sub, ink1];

            ink1.style.opacity = '0';
            sub.style.opacity = '0';
            growAnim = ink1.animate(
                [{ transform: 'translate(-50%, -50%) scale(0)' },
                 { transform: `translate(-50%, -50%) scale(${maxScale.toFixed(2)})` }],
                { duration: inkDur, easing: 'linear', fill: 'forwards' }
            );
            ink1.animate([{ opacity: 0 }, { opacity: 1 }],
                { duration: 200, easing: 'ease-out', fill: 'forwards' });
            sub.animate(
                [{ transform: 'translate(-50%, -50%) scale(0)' },
                 { transform: `translate(-50%, -50%) scale(${maxScale.toFixed(2)})` }],
                { duration: inkDur, easing: 'linear', fill: 'forwards' }
            );
            sub.animate([{ opacity: 0 }, { opacity: 0.55 }],
                { duration: 230, easing: 'ease-out', fill: 'forwards' });

            growAnim.onfinish = () => {
                growAnim = null;
                if (!isHovering) {
                    if (cursorGlow) cursorGlow.classList.remove('active');
                    exitInks();
                    el.classList.remove('ripple-filled');
                    if (solid) el.classList.remove('rippling');
                }
            };
        });

        el.addEventListener('pointermove', (e) => {
            if (!finePointer || !isHovering || !liveInks.length) return;
            elRect = el.getBoundingClientRect();
            moveInks(e.clientX - elRect.left, e.clientY - elRect.top);
            if (cursorGlow) {
                cursorGlow.style.left = (e.clientX - elRect.left) + 'px';
                cursorGlow.style.top = (e.clientY - elRect.top) + 'px';
            }
        });

        el.addEventListener('pointerleave', () => {
            isHovering = false;
            if (cursorGlow) cursorGlow.classList.remove('active');
            if (!growAnim) {
                exitInks();
                el.classList.remove('ripple-filled');
                if (solid) el.classList.remove('rippling');
            }
        });
    }

    function initRipples() {
        document.querySelectorAll(RIPPLE_SELECTOR).forEach(bindRipple);
    }

    /* ---------- Full-screen circular sweeps ---------- */
    const SWEEP_SIZE = 26;

    function sweepPoint(direction, entering) {
        const vw = window.innerWidth, vh = window.innerHeight;
        if (direction === 'left') return { x: entering ? 0 : vw, y: vh / 2 };
        if (direction === 'right') return { x: entering ? vw : 0, y: vh / 2 };
        return { x: vw / 2, y: vh / 2 };
    }

    function coverScale(x, y) {
        const diag = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        ) * 2.2;
        return diag / SWEEP_SIZE;
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
        const showFn = () => brand.classList.add('show');
        if (delay) {
            setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(showFn)), delay);
        } else {
            requestAnimationFrame(() => requestAnimationFrame(showFn));
        }
        return brand;
    }

    async function hideBrand(brand) {
        if (!brand) return;
        await new Promise(r => setTimeout(r, 260));
        brand.classList.remove('show');
        await new Promise(r => setTimeout(r, 80));
        brand.remove();
    }

    let sweepEl = null;
    let sweepBrand = null;
    let sweepBusy = false;
    let __sweepLock = 0;

    function abortSweep() {
        sweepBusy = false;
        __sweepLock = Math.max(0, __sweepLock - 1);
        if (sweepEl) {
            try { sweepEl.getAnimations().forEach(a => a.cancel()); } catch (_) {}
            if (document.body.contains(sweepEl)) sweepEl.remove();
            sweepEl = null;
        }
        if (sweepBrand) {
            if (document.body.contains(sweepBrand)) sweepBrand.remove();
            sweepBrand = null;
        }
        const fx = document.querySelector('.fx-circle');
        if (fx) fx.remove();
    }

    async function sweepIn(direction, pos) {
        if (__sweepLock > 0) return;
        __sweepLock++;
        try {
            if (sweepBusy) abortSweep();
            sweepBusy = true;

            const stale = document.querySelectorAll('.page-sweep, .fx-brand');
            stale.forEach(s => { if (s !== sweepEl && s !== sweepBrand) s.remove(); });

            if (!sweepEl || !document.body.contains(sweepEl)) {
                sweepEl = document.createElement('div');
                sweepEl.className = 'page-sweep';
                document.body.appendChild(sweepEl);
            }
            const el = sweepEl;
            const p = (pos && typeof pos.x === 'number') ? pos : sweepPoint(direction, true);
            const scale = coverScale(p.x, p.y);
            el.style.left = `${p.x}px`;
            el.style.top = `${p.y}px`;
            el.style.opacity = '0';
            const grow = el.animate(
                [{ transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
                 { transform: `translate(-50%, -50%) scale(${scale.toFixed(2)})`, opacity: 1 }],
                { duration: 180, easing: EASE_INOUT, fill: 'forwards' }
            );
            sweepBrand = makeBrand('P . R . T . S .', 90);
            try { await grow.finished; } catch (e) {}
        } finally {}
    }

    async function sweepOut(_direction) {
        const el = sweepEl;
        if (!el) { sweepBusy = false; __sweepLock = Math.max(0, __sweepLock - 1); return; }
        try {
            await hideBrand(sweepBrand);
            sweepBrand = null;
            const cur = getComputedStyle(el).opacity;
            el.style.opacity = cur;
            el.animate(
                [{ opacity: cur }, { opacity: 0 }],
                { duration: 220, easing: 'ease-in', fill: 'forwards' }
            );
            await new Promise(r => setTimeout(r, 240));
        } finally {
            if (el.parentNode) el.remove();
            sweepEl = null;
            sweepBusy = false;
            __sweepLock = Math.max(0, __sweepLock - 1);
        }
    }

    async function fxCircle(x, y, color, midpoint, brandContent, accent) {
        const c = document.createElement('div');
        c.className = 'fx-circle';
        c.style.left = `${x}px`;
        c.style.top = `${y}px`;
        c.style.background = accent
            ? `radial-gradient(circle at 40% 40%, color-mix(in srgb, ${color} 88%, ${accent}), ${color} 30%)`
            : color;
        c.style.opacity = '0';
        document.body.appendChild(c);
        const scale = coverScale(x, y);
        const grow = c.animate(
            [{ transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
             { transform: `translate(-50%, -50%) scale(${scale.toFixed(2)})`, opacity: 1 }],
            { duration: 180, easing: EASE_INOUT, fill: 'forwards' }
        );
        let brand = null;
        if (brandContent) {
            brand = makeBrand(brandContent, 100);
            if (accent) c.classList.add('no-blur');
        }
        try { await grow.finished; } catch (e) {}
        if (typeof midpoint === 'function') midpoint();
        await hideBrand(brand);
        const cur = getComputedStyle(c).opacity;
        c.style.opacity = cur;
        c.animate(
            [{ opacity: cur }, { opacity: 0 }],
            { duration: 220, easing: 'ease-in', fill: 'forwards' }
        );
        await new Promise(r => setTimeout(r, 240));
        c.remove();
    }

    /* ---------- Global WebGL contour field ---------- */
    let glStarted = false;

    function initContourGL() {
        if (glStarted) return;
        const canvas = document.getElementById('contour-gl');
        if (!canvas) return;
        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            powerPreference: 'low-power'
        });
        if (!gl) { canvas.remove(); return; }
        glStarted = true;

        gl.getExtension('OES_standard_derivatives');

        const vsrc = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
        const fsrc = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uAlpha;
uniform float uScroll;
uniform float uGreen;

vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
    float t = uTime;
    uv.y -= uScroll * 0.00005;
    vec2 p = uv + vec2(t * 0.006, -t * 0.004);
    float h = snoise(vec3(p * 0.75, t * 0.07))
            + 0.5 * snoise(vec3(p * 1.5 + vec2(7.3, 2.1), t * 0.10))
            + 0.25 * snoise(vec3(p * 3.0 + vec2(2.9, 5.7), t * 0.13));
    float freq = 2.4;
    float bands = fract(h * freq);
    float d = min(bands, 1.0 - bands) / freq;

#ifdef GL_OES_standard_derivatives
    float w = fwidth(h) * 0.7 + 0.001;
    float line = 1.0 - smoothstep(w * 0.5, w * 1.4, d);
#else
    float line = smoothstep(0.012, 0.004, d);
#endif

    float mask = 1.0;
    vec3 accent = vec3(0.0, uGreen, 0.24 * (0.8 / uGreen));
    float a = line * mask * uAlpha;
    gl_FragColor = vec4(accent, a);
}`;

        function compile(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.warn('contour shader:', gl.getShaderInfoLog(s));
                return null;
            }
            return s;
        }

        const vs = compile(gl.VERTEX_SHADER, vsrc);
        const fs = compile(gl.FRAGMENT_SHADER, fsrc);
        if (!vs || !fs) { canvas.remove(); return; }

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        const uRes = gl.getUniformLocation(prog, 'uRes');
        const uTime = gl.getUniformLocation(prog, 'uTime');
        const uAlpha = gl.getUniformLocation(prog, 'uAlpha');
        const uScroll = gl.getUniformLocation(prog, 'uScroll');
        const uGreen = gl.getUniformLocation(prog, 'uGreen');

        let scrollY = 0;
        window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        window.addEventListener('resize', resize);
        resize();

        function render(now) {
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, now * 0.001);
            const dark = document.documentElement.getAttribute('data-theme') === 'dark';
            gl.uniform1f(uAlpha, dark ? 0.5 : 0.3);
            gl.uniform1f(uGreen, dark ? 0.8 : 1.04);
            gl.uniform1f(uScroll, scrollY);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
    }

    /* ---------- Gooey-filter liquid cursor (solid, predictive LERP + dynamic droplets) ---------- */
    let cursorEl = null;
    let cursorNodes = null;
    
    // 鼠标坐标跟踪
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let initX = mouseX, initY = mouseY;  // constrained origin
    let lastMouseX = mouseX;
    let lastMouseY = mouseY;
    let mouseVx = 0;
    let mouseVy = 0;

    // 物理节点 (3 个永久存在的圆形：头部、身体、尾部)
    const DROP_N = 3;
    const BASE_SIZES = [22, 14, 8]; // 整体尺寸为原来的 2/3
    let currentHeadSize = BASE_SIZES[0];
    let currentBodySize = BASE_SIZES[1];
    let currentTailSize = BASE_SIZES[2];

    let headX = mouseX;
    let headY = mouseY;
    let bodyX = mouseX;
    let bodyY = mouseY;
    let tailX = mouseX;
    let tailY = mouseY;

    let wasOnInteract = false;
    let spawnTimer = 0;
    let idleTime = 0;
    let lastBurstTime = 0;
    let clickSplitTime = 0;
    let isHoveringInteract = false;
    let morphAmp = 0.0; // 控制静止蠕动幅度的平滑过渡值

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // 动态分离水珠粒子池与离开粘连锚点
    const tempDrops = []; // { el, x, y, vx, vy, size, life, maxLife }
    let stickyAnchor = null; // { el, x, y }

    function buildGooeyFilter() {
        if (document.getElementById('goo-svg')) return;
        const container = document.createElement('div');
        container.style.display = 'none';
        container.innerHTML = `
            <svg id="goo-svg" width="0" height="0" style="position: absolute; pointer-events: none;">
                <defs>
                    <filter id="goo-filter" color-interpolation-filters="sRGB">
                        <!-- 适中的模糊半径（4.0），提供完美的液态融合与小水滴保活 -->
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4.0" result="blur" />
                        <!-- 优化后的对比度矩阵（阈值 13/35），确保断开清脆且小水滴不被吞噬 -->
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 35 -13" result="gooey" />
                    </filter>
                </defs>
            </svg>
        `;
        document.body.appendChild(container.firstElementChild);
    }

    function injectCursorStyles() {
        if (document.getElementById('liquid-cursor-styles')) return;
        const style = document.createElement('style');
        style.id = 'liquid-cursor-styles';
        style.textContent = `
            .liquid-cursor {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                pointer-events: none;
                z-index: 99999;
                filter: url(#goo-filter);
                transform: translate3d(0, 0, 0);
                will-change: transform;
            }
            .drop-node {
                position: absolute;
                background: var(--accent-cyan, #00f0ff); /* 纯色实心填充 */
                border-radius: 50%;
                transform-origin: center center;
                pointer-events: none;
                will-change: transform, width, height, border-radius;
            }
            /* 隐藏原生光标 */
            html.has-custom-cursor, 
            html.has-custom-cursor * {
                cursor: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function spawnDrop(x, y, size, life, vx, vy) {
        if (!cursorEl) return;
        const el = document.createElement('div');
        el.className = 'drop-node temp-drop';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.borderRadius = '50%';
        el.style.background = 'var(--accent-cyan, #00f0ff)';
        el.style.pointerEvents = 'none';
        el.style.willChange = 'transform';
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        cursorEl.appendChild(el);

        tempDrops.push({
            el,
            x,
            y,
            vx: vx || 0,
            vy: vy || 0,
            size,
            life,
            maxLife: life
        });
    }

    // 互质频率圆角矩形变形函数：生成极度自然、缓慢、且整体中心绝对不偏移的不规则形状
    function getOrganicRadius(now, offset, amp) {
        const t = now * 0.0105; // 1.5x speed, multi-layer for complexity
        // Each corner uses two oscillators with prime-multiple frequencies → minimal repetition
        const r1 = 50 + (Math.sin(t*1.0 + offset) * 15 + Math.cos(t*0.63 + offset*1.3) * 7) * amp;
        const r2 = 50 + (Math.cos(t*1.17 + offset*1.4) * 15 + Math.sin(t*1.83 + offset*0.6) * 6) * amp;
        const r3 = 50 + (Math.sin(t*0.81 + offset*0.7) * 13 + Math.cos(t*2.11 + offset*1.8) * 5) * amp;
        const r4 = 50 + (Math.cos(t*1.43 + offset*1.1) * 13 + Math.sin(t*0.57 + offset*2.2) * 5) * amp;
        const r5 = 50 + (Math.sin(t*1.05 + offset*1.6) * 15 + Math.cos(t*1.71 + offset*0.9) * 4) * amp;
        const r6 = 50 + (Math.cos(t*0.69 + offset*0.5) * 15 + Math.sin(t*1.37 + offset*1.5) * 4) * amp;
        const r7 = 50 + (Math.sin(t*1.24 + offset*1.9) * 13 + Math.cos(t*0.95 + offset*0.3) * 6) * amp;
        const r8 = 50 + (Math.cos(t*0.87 + offset*2.0) * 13 + Math.sin(t*2.05 + offset*1.2) * 5) * amp;
        return `${r1.toFixed(1)}% ${(100-r1).toFixed(1)}% ${r3.toFixed(1)}% ${(100-r3).toFixed(1)}% / ${r5.toFixed(1)}% ${(100-r5).toFixed(1)}% ${r7.toFixed(1)}% ${(100-r7).toFixed(1)}%`;
    }

    function initCursor() {
        if (cursorEl || !finePointer) return;
        buildGooeyFilter();
        injectCursorStyles();

        // 1. 创建全屏光标容器
        cursorEl = document.createElement('div');
        cursorEl.className = 'liquid-cursor';
        document.body.appendChild(cursorEl);
        document.documentElement.classList.add('has-custom-cursor');
        // Initially hidden — only show when mouse enters the window
        cursorEl.style.opacity = '0';

        // 2. 初始化永久物理节点 (3 个永久存在的圆形)
        cursorNodes = [];
        for (let i = 0; i < DROP_N; i++) {
            const node = document.createElement('div');
            node.className = 'drop-node';
            node.style.width = BASE_SIZES[i] + 'px';
            node.style.height = BASE_SIZES[i] + 'px';
            node.style.transform = 'translate3d(-50%, -50%, 0)';
            cursorEl.appendChild(node);
            cursorNodes.push(node);
        }

        // 初始化坐标至屏幕中心
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        headX = cx; headY = cy;
        bodyX = cx; bodyY = cy;
        tailX = cx; tailY = cy;
        mouseX = cx; mouseY = cy;
        initX = cx; initY = cy;
        lastMouseX = cx; lastMouseY = cy;

        const onMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            // 交互元素检测
            const t = document.elementFromPoint(e.clientX, e.clientY);
            const isInteract = t && t.closest('.ripple-host, a, button, .lang-switcher-btn, .theme-toggle');
            
            // 刚进入交互元素时：触发“磁性吸附”与“向外爆开”
            if (isInteract && !wasOnInteract) {
                const rect = isInteract.getBoundingClientRect();
                const btnCenterX = rect.left + rect.width / 2;
                const btnCenterY = rect.top + rect.height / 2;
                
                // 磁性吸附：将头部坐标向按钮中心强力拉扯 40%
                headX = lerp(headX, btnCenterX, 0.01);
                headY = lerp(headY, btnCenterY, 0.4);

                // 爆发式散射小水珠（增加到 8-10 颗，且不会随着主圆形消失而消失）
                const burstCount = 8 + Math.floor(Math.random() * 3);
                for (let j = 0; j < burstCount; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1.8 + Math.random() * 2.8;
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    const size = 7.0 + Math.random() * 3.5;
                    const life = 0.45 + Math.random() * 0.25;
                    spawnDrop(e.clientX, e.clientY, size, life, vx, vy);
                }
            }

            // 离开交互元素时：触发“物理粘滞拉扯”
            if (wasOnInteract && !isInteract) {
                // 如果已有粘连锚点，先将其移除
                if (stickyAnchor) {
                    stickyAnchor.el.remove();
                }

                // 创建一个物理粘滞锚点，固定在离开时的边缘位置
                const anchorEl = document.createElement('div');
                anchorEl.className = 'drop-node sticky-anchor';
                anchorEl.style.width = '16px';
                anchorEl.style.height = '16px';
                anchorEl.style.position = 'absolute';
                anchorEl.style.borderRadius = '50%';
                anchorEl.style.background = 'var(--accent-cyan, #00f0ff)';
                anchorEl.style.pointerEvents = 'none';
                anchorEl.style.willChange = 'transform';
                cursorEl.appendChild(anchorEl);

                stickyAnchor = {
                    el: anchorEl,
                    x: headX, // 锚定在当前的头部位置
                    y: headY
                };
            }
            wasOnInteract = !!isInteract;

            updateCursorState(e.clientX, e.clientY);
        };

        const updateCursorState = (x, y) => {
            const t = document.elementFromPoint(x, y);
            if (t) {
                const nav = t.closest('.nav-item, .logo');
                const rip = t.closest('.ripple-host, a, button, .lang-switcher-btn, .theme-toggle');
                cursorEl.classList.toggle('on-nav', !!nav && !rip);
                cursorEl.classList.toggle('on-ripple', !!rip);
                isHoveringInteract = !!rip;
            }
        };

        /* ---- 核心物理与预测渲染循环 ---- */
        function tick() {
            if (!cursorEl) return;

            const now = performance.now();

            // 0. Re-check hover state every frame to catch slow entries
            const ht = document.elementFromPoint(mouseX, mouseY);
            const prevInteract = isHoveringInteract;
            if (ht) {
                const rip = ht.closest('.ripple-host, a, button, .lang-switcher-btn, .theme-toggle');
                const nav = ht.closest('.nav-item, .logo');
                isHoveringInteract = !!rip;
                cursorEl.classList.toggle('on-nav', !!nav && !rip);
                cursorEl.classList.toggle('on-ripple', !!rip);
            }
            // Clear ALL stray droplets when entering an interactive element
            if (isHoveringInteract && !prevInteract) {
                for (const d of tempDrops) { if (d.el) d.el.remove(); }
                tempDrops.length = 0;
            }

            // 1. 计算鼠标瞬时速度
            const instantVx = mouseX - lastMouseX;
            const instantVy = mouseY - lastMouseY;
            lastMouseX = mouseX;
            lastMouseY = mouseY;

            // 平滑速度滤波
            const oldVx = mouseVx, oldVy = mouseVy;
            mouseVx = mouseVx * 0.65 + instantVx * 0.35;
            mouseVy = mouseVy * 0.65 + instantVy * 0.35;
            const speed = Math.hypot(mouseVx, mouseVy);
            const accel = speed - Math.hypot(oldVx, oldVy);

            // 2. 轨迹与速度预测算法 (Predictive Lookahead)
            const predFactor = speed < 1.0 ? 0 : 0.6;
            const predX = mouseX + mouseVx * predFactor;
            const predY = mouseY + mouseVy * predFactor;

            // 3. 极速跟手响应
            headX += (predX - headX) * 0.95;
            headY += (predY - headY) * 0.95;

            // 4. 状态判定
            const isIdle = speed < 0.25;

            // 5. 永久节点的跟随物理与硬性距离约束 (拖尾效果极度明显，但绝不脱离)
            let targetBodyX = headX;
            let targetBodyY = headY;
            let targetTailX = headX;
            let targetTailY = headY;

            if (!isIdle) {
                // 5.1 运动状态：身体跟随头部
                bodyX += (headX - bodyX) * 0.40;
                bodyY += (headY - bodyY) * 0.40;

                const dx1 = bodyX - headX;
                const dy1 = bodyY - headY;
                const dist1 = Math.hypot(dx1, dy1);
                // 允许最大拉伸距离为头部尺寸的 75% (约 16.5px)，拉出超长拖尾
                const maxDist1 = currentHeadSize * 0.75; 

                if (dist1 > maxDist1 && dist1 > 0) {
                    bodyX = headX + (dx1 / dist1) * maxDist1;
                    bodyY = headY + (dy1 / dist1) * maxDist1;
                }
                targetBodyX = bodyX;
                targetBodyY = bodyY;

                // 5.2 运动状态：尾部跟随身体
                tailX += (bodyX - tailX) * 0.35;
                tailY += (bodyY - tailY) * 0.35;

                const dx2 = tailX - bodyX;
                const dy2 = tailY - bodyY;
                const dist2 = Math.hypot(dx2, dy2);
                // 允许尾部到身体的最大拉伸距离为身体尺寸的 85% (约 12px)
                const maxDist2 = currentBodySize * 0.85;

                if (dist2 > maxDist2 && dist2 > 0) {
                    tailX = bodyX + (dx2 / dist2) * maxDist2;
                    tailY = bodyY + (dy2 / dist2) * maxDist2;
                }
                targetTailX = tailX;
                targetTailY = tailY;
            } else {
                // 5.3 静止状态：三个圆形几乎完全重合在中心点，使整体中心绝对不变
                targetBodyX = headX;
                targetBodyY = headY;
                targetTailX = headX;
                targetTailY = headY;
            }

            // 6. 离开按钮时的物理粘滞拉伸与断裂模拟 (Sticky Leave)
            if (stickyAnchor) {
                const dx = headX - stickyAnchor.x;
                const dy = headY - stickyAnchor.y;
                const dist = Math.hypot(dx, dy);
                const snapDist = 60.0; // 超过 60px 瞬间断开

                if (dist < snapDist) {
                    // 锚点受到主光标的微弱弹性拉扯，模拟粘滞液体的拉伸形变
                    stickyAnchor.x += dx * 0.08;
                    stickyAnchor.y += dy * 0.08;
                    
                    // 体积守恒模拟：随着拉伸距离变长，锚点尺寸平滑缩水变细
                    const currentSize = 16 * (1 - dist / snapDist);
                    stickyAnchor.el.style.width = `${currentSize.toFixed(1)}px`;
                    stickyAnchor.el.style.height = `${currentSize.toFixed(1)}px`;
                    stickyAnchor.el.style.transform = `translate3d(${stickyAnchor.x.toFixed(1)}px, ${stickyAnchor.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
                } else {
                    // 临界点断裂：在断裂的中心点（拉扯桥梁的中心）爆发式溅射出 7-8 颗小水滴
                    const snapX = (headX + stickyAnchor.x) / 2;
                    const snapY = (headY + stickyAnchor.y) / 2;
                    
                    for (let j = 0; j < 7; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1.5 + Math.random() * 3.0;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        const size = 7.5 + Math.random() * 3.5;
                        const life = 0.35 + Math.random() * 0.25;
                        spawnDrop(snapX, snapY, size, life, vx, vy);
                    }
                    
                    // 销毁锚点
                    stickyAnchor.el.remove();
                    stickyAnchor = null;
                }
            }

            // 6.5. 加速爆发特效 —— 猛加速时爆开一圈水珠 (不在交互元素内)
            // 6.5. 加速爆发特效 —— 和按钮进入时的爆发完全一致，0.3s 冷却
            if (!isHoveringInteract && accel > 5 && (now - lastBurstTime) > 200) {
                lastBurstTime = now;
                const burstCount = 8 + Math.floor(Math.random() * 3);
                for (let j = 0; j < burstCount; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1.8 + Math.random() * 2.8;
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    const size = 7.0 + Math.random() * 3.5;
                    const life = 0.45 + Math.random() * 0.25;
                    spawnDrop(headX, headY, size, life, vx, vy);
                }
            }

            // 7. 动态水滴 —— 元素内不生成，运动时更频繁，静止时点缀
            if (!isHoveringInteract) {
            if (!isIdle && speed > 4.0) {
                spawnTimer++;
                if (spawnTimer > 5) { // 频率加倍 (10→5帧)
                    spawnTimer = 0;
                    const angle = Math.atan2(mouseVy, mouseVx) + Math.PI;
                    const dist = currentTailSize * 0.5;
                    const sx = tailX + Math.cos(angle) * dist;
                    const sy = tailY + Math.sin(angle) * dist;

                    const vx = -mouseVx * 0.12 + (Math.random() - 0.5) * 1.5;
                    const vy = -mouseVy * 0.12 + (Math.random() - 0.5) * 1.5;
                    const size = 8.0 + Math.random() * 3.5;
                    const life = 0.25 + Math.random() * 0.25;
                    spawnDrop(sx, sy, size, life, vx, vy);
                }
            } else if (isIdle) {
                spawnTimer++;
                if (spawnTimer > 60) {
                    spawnTimer = 0;
                    const sx = headX + (Math.random() - 0.5) * 10;
                    const sy = headY + (Math.random() - 0.5) * 10;
                    spawnDrop(sx, sy, 3+Math.random()*3, 0.5+Math.random()*0.4, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3);
                }
            }
            } // end if (!isHoveringInteract)

            // 8. 交互吸附：主光标 3 节点即刻隐藏（零延迟），水珠和爆发不受影响
            if (isHoveringInteract) {
                currentHeadSize = 0;
                currentBodySize = 0;
                currentTailSize = 0;
                cursorNodes[0].style.opacity = '0';
                cursorNodes[1].style.opacity = '0';
                cursorNodes[2].style.opacity = '0';
            } else {
                currentHeadSize += (BASE_SIZES[0] - currentHeadSize) * 0.15;
                currentBodySize += (BASE_SIZES[1] - currentBodySize) * 0.15;
                currentTailSize += (BASE_SIZES[2] - currentTailSize) * 0.15;
                cursorNodes[0].style.opacity = '';
                cursorNodes[1].style.opacity = '';
                cursorNodes[2].style.opacity = '';
            }

            // Click split effect: temporarily push body & tail outward then recoil
            if (clickSplitTime > 0) {
                clickSplitTime -= 0.016 / 0.35;
                const split = Math.sin(clickSplitTime * Math.PI) * 15;
                bodyX += split * 0.3;
                bodyY += split * 0.3;
                tailX += split * 0.5;
                tailY += split * 0.5;
            }

            cursorNodes[0].style.width = `${currentHeadSize.toFixed(1)}px`;
            cursorNodes[0].style.height = `${currentHeadSize.toFixed(1)}px`;
            cursorNodes[1].style.width = `${currentBodySize.toFixed(1)}px`;
            cursorNodes[1].style.height = `${currentBodySize.toFixed(1)}px`;
            cursorNodes[2].style.width = `${currentTailSize.toFixed(1)}px`;
            cursorNodes[2].style.height = `${currentTailSize.toFixed(1)}px`;

            // 9. 静止不规则蠕动 (Jiggle) 与 渲染
            const targetAmp = isIdle ? 1.0 : 0.0;
            morphAmp = lerp(morphAmp, targetAmp, 0.1); // 平滑过渡蠕动幅度

            // 应用互质频率圆角矩形变形，三个节点圆角完全异步，产生极其高级的不规则液态变化
            cursorNodes[0].style.borderRadius = getOrganicRadius(now, 0.0, morphAmp);
            cursorNodes[1].style.borderRadius = getOrganicRadius(now, 2.5, morphAmp);
            cursorNodes[2].style.borderRadius = getOrganicRadius(now, 5.0, morphAmp);

            if (isIdle) {
                idleTime += 0.016;
                // 模拟冷凝水滑落效果：静止超过 2 秒后，每隔 2.2 秒从底部滑落一颗微小水珠
                if (idleTime > 2.0) {
                    idleTime = 0;
                    const sx = headX + (Math.random() - 0.5) * 3;
                    const sy = headY + BASE_SIZES[0] * 0.4;
                    const vx = (Math.random() - 0.5) * 0.1;
                    const vy = 1.8 + Math.random() * 1.2;
                    const size = 8.0; 
                    const life = 0.45;
                    spawnDrop(sx, sy, size, life, vx, vy);
                }
            } else {
                idleTime = 0;
            }

            // 渲染永久节点 (由于静止时 targetBody/targetTail 与 head 完全重合，中心点绝对静止)
            cursorNodes[0].style.transform = `translate3d(${headX.toFixed(1)}px, ${headY.toFixed(1)}px, 0) translate(-50%, -50%)`;
            cursorNodes[1].style.transform = `translate3d(${targetBodyX.toFixed(1)}px, ${targetBodyY.toFixed(1)}px, 0) translate(-50%, -50%)`;
            cursorNodes[2].style.transform = `translate3d(${targetTailX.toFixed(1)}px, ${targetTailY.toFixed(1)}px, 0) translate(-50%, -50%)`;

            // 10. 更新并渲染动态分离水滴粒子 (它们在主光标消失时仍会自然飘散)
            for (let i = tempDrops.length - 1; i >= 0; i--) {
                const d = tempDrops[i];
                d.life -= 0.016; // 模拟 60fps 衰减
                if (d.life <= 0) {
                    d.el.remove();
                    tempDrops.splice(i, 1);
                    continue;
                }

                // 物理模拟：速度 + 空气阻尼 + 微弱的垂直下滑重力
                d.x += d.vx;
                d.y += d.vy;
                d.vx *= 0.91;
                d.vy = d.vy * 0.91 + 0.14; // 0.14px/frame² 的微弱向下重力

                // 随着生命值衰减进行缩放，限制最小缩放为 0.5，确保其在滤镜吞噬前产生完美的“Pop”融化断裂感
                const scale = 0.5 + (d.life / d.maxLife) * 0.7;
                d.el.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
            }

            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('scroll', () => {
            if (cursorEl) updateCursorState(prevX, prevY);
        }, { passive: true });
        // Click burst — no cooldown, always fires at cursor position
        window.addEventListener('pointerdown', (e) => {
            // 1. Burst droplets — at mouse position relative to cursor container
            const localX = e.clientX - parseFloat(cursorEl.style.left || 0);
            const localY = e.clientY - parseFloat(cursorEl.style.top || 0);
            const burstCount = 10 + Math.floor(Math.random() * 4);
            for (let j = 0; j < burstCount; j++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2.0 + Math.random() * 3.5;
                spawnDrop(localX, localY, 6.0 + Math.random() * 4, 0.5 + Math.random() * 0.3, Math.cos(angle) * speed, Math.sin(angle) * speed);
            }
            // 2. Main circle split-then-recoil effect
            clickSplitTime = 1.0;
        });
        // Hide cursor when mouse leaves the window
        document.documentElement.addEventListener('mouseleave', () => {
            if (cursorEl) cursorEl.style.opacity = '0';
        });
        document.documentElement.addEventListener('mouseenter', () => {
            if (cursorEl) cursorEl.style.opacity = '';
        });
    }

    /* ---------- Public init (idempotent, called per page) ---------- */
    function init() {
        startAmbientLoop();
        initContourGL();
        initRipples();
        initArtColumns();
        initCursor();
    }

    window.MotionUX = { init, sweepIn, sweepOut, fxCircle, abortSweep };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
