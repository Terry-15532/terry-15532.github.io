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

            // Orb parallax: each sphere drifts at its own depth,
            // loosely related to scroll position and cursor.
            for (const o of orbWraps) {
                const px = smoothScroll * o.sx + (smoothMX - 0.5) * o.mx * 2;
                const py = smoothScroll * o.sy + (smoothMY - 0.5) * o.my * 2;
                o.el.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
            }

            // Giant background word sweeps right-to-left as the page scrolls
            if (decoText) {
                decoText.style.transform = `translate3d(${(-smoothScroll * 0.22).toFixed(2)}px, 0, 0)`;
            }

            // Art columns: tops aligned until grid top goes past the viewport top,
            // then diverge; bottoms aligned when grid bottom reaches viewport bottom.
            // The rect must be read AFTER any previous transforms are reset so we
            // don't feed back the column offsets into the progress calculation.
            if (artCols.length > 1 && artGridEl) {
                // momentarily lift transforms to measure the natural rect
                for (const col of artCols) col.el.style.transform = '';
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
            // heights measured, ready for parallax
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
        cards.forEach((card, i) => cols[i % n].appendChild(card));

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

    /* Buttons get a SOLID accent sweep; cards get a background-only tint */
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
            // wrap existing content above the incoming circle
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

        function ensureCursorGlow() {
            if (!cursorGlow || !document.contains(cursorGlow)) {
                cursorGlow = document.createElement('div');
                cursorGlow.className = 'cursor-glow';
                el.appendChild(cursorGlow);
            }
            return cursorGlow;
        }

        /* Exit: shrink + fade from the element's bottom-centre */
        function exitInks() {
            const frozen = [...liveInks].filter(ink => document.contains(ink));
            liveInks = [];
            if (growAnim) { try { growAnim.cancel(); } catch (_) { } growAnim = null; }
            const rect = el.getBoundingClientRect();
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
                // reposition to bottom-centre before shrinking
                ink.style.left = (rect.width / 2) + 'px';
                ink.style.top = rect.height + 'px';
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

        /* reposition inks to follow cursor — only moves origin, does NOT restart the grow */
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

            // Show the cursor glow (per-element, relative coords)
            const glow = ensureCursorGlow();
            glow.style.left = (e.clientX - elRect.left) + 'px';
            glow.style.top = (e.clientY - elRect.top) + 'px';
            glow.classList.add('active');

            const x = e.clientX - elRect.left;
            const y = e.clientY - elRect.top;
            const sub = spawnInk(el, x, y);
            sub.classList.add('sub');
            const ink1 = spawnInk(el, x, y);
            liveInks = [sub, ink1];

            ink1.style.opacity = '0';
            sub.style.opacity = '0';
            // constant linear speed — no deceleration
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
            // move cursor glow to follow
            if (cursorGlow) {
                cursorGlow.style.left = (e.clientX - elRect.left) + 'px';
                cursorGlow.style.top = (e.clientY - elRect.top) + 'px';
            }
        });

        el.addEventListener('pointerleave', () => {
            isHovering = false;
            if (cursorGlow) cursorGlow.classList.remove('active');
            // If already finished, exit now. Otherwise let onfinish handle it.
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

    /* Frosted centre panel used by all full-screen sweeps.
       delay: ms to wait before showing text.
       After showing, blinks twice then auto-hides before the mask exit. */
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
        const showFn = () => {
            brand.classList.add('show');
            // Auto-hide backup — hideBrand will normally fire before this
            setTimeout(() => brand.classList.remove('show'), 3000);
        };
        if (delay) {
            setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(showFn)), delay);
        } else {
            requestAnimationFrame(() => requestAnimationFrame(showFn));
        }
        return brand;
    }

    async function hideBrand(brand) {
        if (!brand) return;
        brand.classList.remove('show');
        await new Promise(r => setTimeout(r, 260));
        brand.remove();
    }

    /* Page transition sweep: circle grows from the navigation edge,
       covers the screen, content swaps, then it shrinks into the far edge. */
    let sweepEl = null;
    let sweepBrand = null;
    let sweepBusy = false;
    let __sweepLock = 0;    // atomic counter — only one sweep can be running

    /* Force-clean internal state after an external cancel */
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
        // also remove anything left over by an aborted fxCircle
        const fx = document.querySelector('.fx-circle');
        if (fx) fx.remove();
    }

    /* Enter from the click point (or the directional edge as fallback) */
    async function sweepIn(direction, pos) {
        // GLOBAL LOCK: refuse to start if another sweep is in flight
        if (__sweepLock > 0) return;
        __sweepLock++;
        try {
        if (sweepBusy) abortSweep();
        sweepBusy = true;

        // Clean up any stale DOM leftovers (from other sources)
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
            { duration: 440, easing: EASE_INOUT, fill: 'forwards' }
        );
        sweepBrand = makeBrand('P . R . T . S .', 220);
        try { await grow.finished; } catch (e) { /* interrupted */ }
        } finally { /* lock released in sweepOut */ }
    }

    /* Exit: WAAPI-driven fade-out (no cancel+transition race) */
    async function sweepOut(_direction) {
        const el = sweepEl;
        if (!el) { sweepBusy = false; __sweepLock = Math.max(0, __sweepLock - 1); return; }
        try {
            await hideBrand(sweepBrand);
            sweepBrand = null;
            // read current opacity then animate to 0 via WAAPI
            const cur = getComputedStyle(el).opacity;
            el.style.opacity = cur;  // lock inline so WAAPI has a start point
            el.animate(
                [{ opacity: cur }, { opacity: 0 }],
                { duration: 400, easing: 'ease-in', fill: 'forwards' }
            );
            await new Promise(r => setTimeout(r, 420));
        } finally {
            if (el.parentNode) el.remove();
            sweepEl = null;
            sweepBusy = false;
            __sweepLock = Math.max(0, __sweepLock - 1);
        }
    }

    /* Circular sweep for theme / language switching:
       grows from the control, flips state at the midpoint,
       then shrinks away into the farthest corner.
       brandContent: string or Node shown in the frosted centre panel. */
    async function fxCircle(x, y, color, midpoint, brandContent, accent) {
        const c = document.createElement('div');
        c.className = 'fx-circle';
        c.style.left = `${x}px`;
        c.style.top = `${y}px`;
        // fully opaque: almost pure bg colour with just a whisper of green at center
        c.style.background = accent
            ? `radial-gradient(circle at 40% 40%, color-mix(in srgb, ${color} 88%, ${accent}), ${color} 30%)`
            : color;
        c.style.opacity = '0';
        document.body.appendChild(c);
        const scale = coverScale(x, y);
        const grow = c.animate(
            [{ transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
             { transform: `translate(-50%, -50%) scale(${scale.toFixed(2)})`, opacity: 1 }],
            { duration: 400, easing: EASE_INOUT, fill: 'forwards' }
        );
        let brand = null;
        if (brandContent) {
            brand = makeBrand(brandContent, 200);
            // theme switch: opaque circle, no blur
            if (accent) c.classList.add('no-blur');
        }
        try { await grow.finished; } catch (e) { /* interrupted */ }
        // switch language AFTER the mask fully covers the screen
        if (typeof midpoint === 'function') midpoint();
        await hideBrand(brand);
        const cur = getComputedStyle(c).opacity;
        c.style.opacity = cur;
        c.animate(
            [{ opacity: cur }, { opacity: 0 }],
            { duration: 400, easing: 'ease-in', fill: 'forwards' }
        );
        await new Promise(r => setTimeout(r, 420));
        c.remove();
    }

    /* ---------- Global WebGL contour field (voronoi height shading) ---------- */
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
        // Contour field ported from the same algorithm family landonorris.com
        // uses in its shaders: Ashima simplex noise (`#include <simplex>`)
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

// Ashima / Ian McEwan simplex noise (MIT) - same as <simplex> on landonorris.com
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

    // slow diagonal drift; scroll parallax shifts the whole pattern smoothly
    uv.y -= uScroll * 0.00005;
    vec2 p = uv + vec2(t * 0.006, -t * 0.004);

    // simplex fbm height field, three octaves, larger landforms
    float h = snoise(vec3(p * 0.75, t * 0.07))
            + 0.5 * snoise(vec3(p * 1.5 + vec2(7.3, 2.1), t * 0.10))
            + 0.25 * snoise(vec3(p * 3.0 + vec2(2.9, 5.7), t * 0.13));

    // contour lines sampled from the height field
    float freq = 2.4;
    float bands = fract(h * freq);
    float d = min(bands, 1.0 - bands) / freq;

#ifdef GL_OES_standard_derivatives
    float w = fwidth(h) * 0.7 + 0.001;
    float line = 1.0 - smoothstep(w * 0.5, w * 1.4, d);
#else
    float line = smoothstep(0.012, 0.004, d);
#endif

    // uniform strength across the whole screen
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
            gl.uniform1f(uGreen, dark ? 0.8 : 1.04);  // +30% green saturation for light mode
            gl.uniform1f(uScroll, scrollY);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
    }

    /* ---------- Soft-body SVG liquid cursor (18 anchors) ---------- */
    let cursorEl = null, cursorPath = null, cursorGlowSvg = null;
    let prevX = 0, prevY = 0, velX = 0, velY = 0;
    let tIdle = 0;

    const DISK_N = 18;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const DISK_R = 10;                     // base radius
    const DISK_K = 0.18;                   // bezier control scale for 20° segments
    const SPRING_K = 0.45;                 // spring stiffness (↑ more wobble)
    const DAMP_K   = 0.55;                 // damping (↓ more overshoot)
    const IDLE_A   = 3.0;                  // idle motion amplitude
    const GRAV_G   = 3.5;                  // gravity stretch
    const VEL_F    = 1.2;                  // velocity deformation strength
    const rNow  = Array(DISK_N).fill(DISK_R);  // current radii (soft-body state)
    const rVel  = Array(DISK_N).fill(0);       // radial velocity

    function initCursor() {
        if (cursorEl || !finePointer) return;
        const ns = 'http://www.w3.org/2000/svg';

        cursorEl = document.createElementNS(ns, 'svg');
        cursorEl.setAttribute('class', 'liquid-cursor');
        cursorEl.setAttribute('viewBox', '-32 -32 64 64');
        cursorEl.setAttribute('width', '64');
        cursorEl.setAttribute('height', '64');
        document.body.appendChild(cursorEl);
        document.documentElement.classList.add('has-custom-cursor');

        /* glow disc */
        cursorGlowSvg = document.createElementNS(ns, 'circle');
        cursorGlowSvg.setAttribute('cx', '0');
        cursorGlowSvg.setAttribute('cy', '0');
        cursorGlowSvg.setAttribute('r', '24');
        cursorGlowSvg.setAttribute('fill', 'none');
        cursorGlowSvg.setAttribute('opacity', '0');
        cursorGlowSvg.style.transition = 'opacity 0.25s ease';
        cursorEl.appendChild(cursorGlowSvg);

        cursorPath = document.createElementNS(ns, 'path');
        cursorPath.setAttribute('fill', 'var(--accent-cyan)');
        cursorEl.appendChild(cursorPath);

        /* --- path builder --- */
        function build() {
            const T = Math.PI * 2;
            let d = '';
            for (let i = 0; i < DISK_N; i++) {
                const a0 = (T * i) / DISK_N;
                const a1 = (T * (i + 1)) / DISK_N;
                const r0 = rNow[i], r1 = rNow[(i + 1) % DISK_N];
                const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0;
                const x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1;
                const tx0 = -Math.sin(a0), ty0 = Math.cos(a0);
                const tx1 = -Math.sin(a1), ty1 = Math.cos(a1);
                const cx1 = x0 + tx0 * DISK_K * r0, cy1 = y0 + ty0 * DISK_K * r0;
                const cx2 = x1 - tx1 * DISK_K * r1, cy2 = y1 - ty1 * DISK_K * r1;
                if (i === 0) d += `M${x0.toFixed(1)},${y0.toFixed(1)}`;
                d += ` C${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
            }
            d += 'Z';
            cursorPath.setAttribute('d', d);
        }

        /* --- physics integration --- */
        let lastT = 0;
        function tick(ts) {
            if (!cursorEl) return;
            const dt = lastT ? Math.min((ts - lastT) / 1000, 0.05) : 0.016;
            lastT = ts;
            tIdle = ts / 1000;
            const T = Math.PI * 2;
            const vx = velX / 10;
            const vy = velY / 10;
            const spd = Math.hypot(velX, velY) / 14;
            for (let i = 0; i < DISK_N; i++) {
                const a = (T * i) / DISK_N;
                const idle = Math.sin(tIdle * 3.4 + i * 1.6) * IDLE_A * 0.7 +
                             Math.cos(tIdle * 2.0 + i * 2.3) * IDLE_A * 0.5;
                const dot = Math.cos(a) * vx + Math.sin(a) * vy;
                const grav = (Math.sin(a) + 1) * GRAV_G * 0.55;
                const target = DISK_R + idle + dot * DISK_R * VEL_F * (1 + spd * 0.4) + grav + spd * 3;
                const accel = SPRING_K * (target - rNow[i]) - DAMP_K * rVel[i];
                rVel[i] += accel * dt;
                rNow[i] += rVel[i] * dt;
                rNow[i] = clamp(rNow[i], 2, 30);
            }
            build();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        /* --- pointer --- */
        const onMove = (e) => {
            const dx = e.clientX - prevX, dy = e.clientY - prevY;
            velX = clamp(velX * 0.2 + dx * 0.8, -20, 20);
            velY = clamp(velY * 0.2 + dy * 0.8, -20, 20);
            prevX = e.clientX; prevY = e.clientY;
            cursorEl.style.left = (e.clientX + velX * 0.55) + 'px';
            cursorEl.style.top  = (e.clientY + velY * 0.55) + 'px';
            updateCursorState(e.clientX, e.clientY);
        };
        const updateCursorState = (x, y) => {
            const t = document.elementFromPoint(x, y);
            if (t) {
                const nav = t.closest('.nav-item, .logo');
                const rip = t.closest('.ripple-host, a, button, .lang-switcher');
                cursorEl.classList.toggle('on-nav', !!nav && !rip);
                cursorEl.classList.toggle('on-ripple', !!rip);
                const glowOn = !!nav || (!rip && t.closest('a, button, .ripple-host'));
                if (cursorGlowSvg) cursorGlowSvg.setAttribute('opacity', glowOn ? '1' : '0');
            }
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('scroll', () => {
            if (cursorEl) updateCursorState(
                parseFloat(cursorEl.style.left) || 0,
                parseFloat(cursorEl.style.top) || 0
            );
        }, { passive: true });
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
