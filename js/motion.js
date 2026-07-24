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
            { el: document.querySelector('.orb-wrap-1'), ax: 12, ay: 9, bx: 8, by: 6, cx: 5, cy: 7, px: 0.3, py: 0.35, fx: 0.07, fy: 0.11 },
            { el: document.querySelector('.orb-wrap-2'), ax: 10, ay: 11, bx: 7, by: 5, cx: 6, cy: 4, px: 0.6, py: 0.55, fx: 0.09, fy: 0.13 },
            { el: document.querySelector('.orb-wrap-3'), ax: 9, ay: 8, bx: 6, by: 7, cx: 4, cy: 5, px: 0.45, py: 0.6, fx: 0.08, fy: 0.10 }
        ].filter(o => o.el);

        const hw = window.innerWidth * 0.2;
        const hh = window.innerHeight * 0.2;

        function frame() {
            const t = performance.now() * 0.001; // seconds

            for (const o of orbWraps) {
                // 每个 orb 使用三组不同频率的正弦波叠加，位置互不重复
                const px = Math.sin(t * o.fx + o.px * Math.PI) * o.ax +
                           Math.cos(t * o.fy + o.py * Math.PI) * o.bx +
                           Math.sin(t * 0.13 + 1.2) * o.cx;
                const py = Math.cos(t * o.fy + o.py * Math.PI) * o.ay +
                           Math.sin(t * o.fx + o.px * Math.PI * 0.7) * o.by +
                           Math.cos(t * 0.17 + 2.5) * o.cy;
                o.el.style.transform = `translate3d(${clamp(px, -hw, hw).toFixed(2)}px, ${clamp(py, -hh, hh).toFixed(2)}px, 0)`;
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
        '.scroll-card', '.art-scroll-card', '.card', '.timeline-content.link-content'
    ].join(', ');

    const SOLID_SELECTOR = [
        '.rhombus-btn', '.featured-cta-btn', '.featured-arts-btn', '.game-start-btn',
        '.icon-link', '.footer-social-link', '.theme-toggle', '.lang-switcher-btn', '.project-back-btn'
    ].join(', ');

    // 全局注册表：记录所有绑定了 ripple 的宿主元素，用于滚动时实时同步辉光
    const _rippleHosts = new Set();

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
        _rippleHosts.add(el);

        const solid = el.matches(SOLID_SELECTOR);
        el.classList.add(solid ? 'ripple-solid' : 'ripple-tint');

        // 所有卡片和按钮均启用磁吸、随动、弹性回弹，navbar 等元素除外
        const isMagnetic = !el.matches('.nav-item, .logo, .lang-option');
        let targetTransX = 0, targetTransY = 0;
        let curTransX = 0, curTransY = 0;

        // 磁吸弹簧插值函数：每帧由全局 tick 调用，保证平滑弹性
        el._magneticSpring = () => {
            if (!isHovering) return;
            // 弹性弹簧：向目标位置插值，系数越低越 Q 弹
            const spring = 0.18;
            curTransX += (targetTransX - curTransX) * spring;
            curTransY += (targetTransY - curTransY) * spring;
            el.style.transform = `translate3d(${curTransX.toFixed(1)}px, ${curTransY.toFixed(1)}px, 0)`;
        };

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
            // Bow Seat 奖项卡片始终从左侧退出
            if (el.matches('.timeline-content.link-content')) {
                exitX = -10;
                exitY = rect.height / 2;
            } else {
                const textEl = el.querySelector('.card-content, .card-info, .project-card-info, .art-info, .card-body, .card-text, .card-overlay-content');
                if (textEl) {
                    const tr = textEl.getBoundingClientRect();
                    const textCenterX = tr.left - rect.left + tr.width / 2;
                    exitX = textCenterX > rect.width / 2 ? rect.width + 10 : -10;
                    exitY = rect.height / 2;
                }
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

            // 如果退场动画正在进行，取消退场，平滑回到 hover 状态
            if (isExiting) {
                clearExitTimers();
                isExiting = false;
                el.style.transition = '';
                el.style.transform = '';
            }

            isHovering = true;

            if (isMagnetic) {
                const r = el.getBoundingClientRect();
                const w = r.width, h = r.height;
                const cx = r.left + w / 2;
                const cy = r.top + h / 2;
                const enterDx = e.clientX - cx;
                const enterDy = e.clientY - cy;
                const len = Math.hypot(enterDx, enterDy) || 1;
                
                const isNavBtn = el.matches('.theme-toggle, .lang-switcher-btn, .icon-link, .footer-social-link');
                const amp = isNavBtn ? 5.5 : (w < 80 || h < 80) ? 3.5 : 2.0;
                const maxMove = isNavBtn ? 5.0 : (w < 80 || h < 80) ? 3.0 : 2.0;
                
                targetTransX = clamp((enterDx / len) * amp, -maxMove, maxMove);
                targetTransY = clamp((enterDy / len) * amp, -maxMove, maxMove);
                // 重置弹簧当前位置为 0，让吸附动画从零开始平滑过渡
                curTransX = 0;
                curTransY = 0;
            }

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
            el.classList.add('is-hovered');

            elRect = el.getBoundingClientRect();
            maxScale = (Math.hypot(elRect.width, elRect.height) / 24) * 2;
            inkDur = solid ? 300 : 450;
            el.dataset.maxScale = maxScale;

            // Show cursor glow only on large interactive elements (skip nav, small buttons)
            if (!el.classList.contains('nav-item') &&
                !el.classList.contains('rhombus-btn') &&
                !el.classList.contains('lang-switcher-btn') &&
                !el.classList.contains('theme-toggle') &&
                !el.classList.contains('footer-social-link') &&
                !el.classList.contains('icon-link')) {
                const glow = ensureCursorGlow();
                glow.style.left = (e.clientX - elRect.left) + 'px';
                glow.style.top = (e.clientY - elRect.top) + 'px';
                glow.classList.add('active');
            }

            const x = e.clientX - elRect.left;
            const y = e.clientY - elRect.top;
            const ink1 = spawnInk(el, x, y);
            liveInks = [ink1];

            ink1.style.opacity = '0';
            growAnim = ink1.animate(
                [{ transform: 'translate(-50%, -50%) scale(0)' },
                 { transform: `translate(-50%, -50%) scale(${maxScale.toFixed(2)})` }],
                { duration: inkDur, easing: 'linear', fill: 'forwards' }
            );
            ink1.animate([{ opacity: 0 }, { opacity: 1 }],
                { duration: 200, easing: 'ease-out', fill: 'forwards' });

            growAnim.onfinish = () => {
                growAnim = null;
                // 如果鼠标已经离开，启动退场流程（不提前移除任何状态类）
                if (!isHovering) {
                    startExit();
                }
            };
        });

        el.addEventListener('pointermove', (e) => {
            if (!finePointer || !isHovering) return;
            elRect = el.getBoundingClientRect();

            if (isMagnetic) {
                const rw = elRect.width, rh = elRect.height;
                const cx = elRect.left + rw / 2;
                const cy = elRect.top + rh / 2;
                const dx = e.clientX - cx;
                const dy = e.clientY - cy;
                
                // 驱动轻微随动（导航栏小按钮用更大系数）
                const isNavBtn = el.matches('.theme-toggle, .lang-switcher-btn, .icon-link, .footer-social-link');
                const ratio = isNavBtn ? 0.5 : (rw < 80 || rh < 80) ? 0.3 : 0.2;
                const limit = isNavBtn ? 13.0 : (rw < 80 || rh < 80) ? 8.0 : 6.0;
                targetTransX = clamp(dx * ratio, -limit, limit);
                targetTransY = clamp(dy * ratio, -limit, limit);
            }

            if (liveInks.length) {
                moveInks(e.clientX - elRect.left, e.clientY - elRect.top);
            }
            if (cursorGlow) {
                cursorGlow.style.left = (e.clientX - elRect.left) + 'px';
                cursorGlow.style.top = (e.clientY - elRect.top) + 'px';
            }
        });

        // 滚动时持续响应鼠标位置，不等待滚动结束
        el._scrollTick = () => {
            if (!isHovering) return;
            const rect = el.getBoundingClientRect();
            const x = mouseX - rect.left;
            const y = mouseY - rect.top;
            if (liveInks.length) {
                moveInks(x, y);
            }
            if (cursorGlow) {
                cursorGlow.style.left = x + 'px';
                cursorGlow.style.top = y + 'px';
            }
        };

        el.addEventListener('pointerleave', () => {
            // 辉光立即消失，不等入场动画结束
            if (cursorGlow) cursorGlow.classList.remove('active');
            // 仅标记离开意图，视觉变更由 startExit 统一处理
            isHovering = false;
            if (!growAnim && !isExiting) {
                startExit();
            }
        });

        // 统一退场函数：入场动画结束后才调用，保证不打断
        let isExiting = false;
        let exitTimers = [];

        function clearExitTimers() {
            exitTimers.forEach(t => clearTimeout(t));
            exitTimers = [];
        }

        function startExit() {
            isExiting = true;
            exitInks();

            if (isMagnetic) {
                targetTransX = 0;
                targetTransY = 0;
                el.style.transition = 'transform 0.55s cubic-bezier(0.175, 1.55, 0.35, 1.15)';
                el.style.transform = 'translate3d(0, 0, 0)';
                const t = setTimeout(() => { el.style.transition = ''; isExiting = false; }, 600);
                exitTimers.push(t);
            } else {
                const t = setTimeout(() => { isExiting = false; }, 500);
                exitTimers.push(t);
            }

            // 移除状态类，CSS transition 驱动颜色/背景平滑回退
            el.classList.remove('ripple-filled');
            if (solid) el.classList.remove('rippling');
            el.classList.remove('is-hovered');
            isHovering = false;
        }

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
            el.style.opacity = '1';
            const grow = el.animate(
                [{ transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
                 { transform: `translate(-50%, -50%) scale(${scale.toFixed(2)})`, opacity: 1 }],
                { duration: 300, easing: 'cubic-bezier(0.34, 1.1, 0.9, 1)', fill: 'forwards' }
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
        c.style.opacity = '1';
        document.body.appendChild(c);
        const scale = coverScale(x, y);
        const grow = c.animate(
            [{ transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
             { transform: `translate(-50%, -50%) scale(${scale.toFixed(2)})`, opacity: 1 }],
            { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
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

        // 允许用户在控制台切换: window.__useSystemCursor = true/false
        if (typeof window.__useSystemCursor === 'undefined') {
            window.__useSystemCursor = false;
        }

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

    let spawnTimer = 0;
    let spawnThreshold = 5;
    let idleTime = 0;
    let lastBurstTime = 0;
    let clickSplitTime = 0;
    let isHoveringInteract = false;
    let tickFrame = 0; // 帧计数器，用于 30fps 衰减操作
    let morphAmp = 0.0; // 控制静止蠕动幅度的平滑过渡值

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // 动态分离水珠粒子池与离开粘连锚点
    const tempDrops = []; // { el, x, y, vx, vy, size, life, maxLife }
    const MAX_TEMP_DROPS = 60; // 严格上限，超出时移除最旧的粒子
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
                transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 1;
            }
            .liquid-cursor.cursor-in-iframe {
                opacity: 0;
            }
            .drop-node {
                position: absolute !important;
                background: var(--accent-cyan, #00f0ff) !important; /* 纯色实心填充 */
                border-radius: 50%;
                transform-origin: center center !important;
                pointer-events: none !important;
                will-change: transform, width, height, border-radius !important;
            }
            /* 隐藏原生光标（仅当未启用双光标模式时） */
            html.has-custom-cursor:not(.show-system-cursor), 
            html.has-custom-cursor:not(.show-system-cursor) * {
                cursor: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function spawnDrop(x, y, size, life, vx, vy, isBurst = false) {
        if (!cursorEl) return;
        // 粒子总数上限：超出时直接移除最旧的
        while (tempDrops.length >= MAX_TEMP_DROPS) {
            const old = tempDrops.shift();
            if (old && old.el) old.el.remove();
        }
        const el = document.createElement('div');
        el.className = 'drop-node temp-drop' + (isBurst ? ' burst-drop' : '');
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
            maxLife: life,
            isBurst
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
        // 遵守 __useSystemCursor 切换：true 时显示系统光标
        if (!window.__useSystemCursor) {
            document.documentElement.classList.add('has-custom-cursor');
        }
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

        // 当前处于鼠标悬停状态的页面交互元素，用于在滚动时实时同步事件
        let currentHoveredHost = null;

        function updateElementHoverState(clientX, clientY) {
            if (typeof document.elementFromPoint !== 'function' || !cursorEl) return;
            const t = document.elementFromPoint(clientX, clientY);
            const rip = t ? t.closest('.ripple-host, a, button, .lang-switcher-btn, .theme-toggle') : null;
            
            if (rip !== currentHoveredHost) {
                const wasOnInteract = !!currentHoveredHost;
                const isInteract = !!rip;
                
                // 1. 移出前一个交互元素 (模拟派发 pointerleave)
                if (currentHoveredHost) {
                    const leaveEvent = new PointerEvent('pointerleave', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    });
                    currentHoveredHost.dispatchEvent(leaveEvent);
                }
                
                // 2. 触发离开时的"物理粘滞拉扯"与"离开爆开"
                if (wasOnInteract && !isInteract) {
                    if (stickyAnchor) {
                        stickyAnchor.el.remove();
                    }
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
                        x: headX,
                        y: headY
                    };

                    const burstCount = 6 + Math.floor(Math.random() * 3);
                    for (let j = 0; j < burstCount; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1.5 + Math.random() * 2.0;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        const size = 6.0 + Math.random() * 3.0;
                        const life = 0.35 + Math.random() * 0.20;
                        spawnDrop(headX, headY, size, life, vx, vy, true);
                    }
                }
                
                // 3. 移入新宿主 (模拟派发 pointerenter)
                currentHoveredHost = rip;
                if (currentHoveredHost) {
                    const enterEvent = new PointerEvent('pointerenter', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    });
                    currentHoveredHost.dispatchEvent(enterEvent);
                }
                
                // 4. 刚进入新宿主：触发"磁性吸附"与"进入爆开"
                if (isInteract && !wasOnInteract) {
                    const rect = rip.getBoundingClientRect();
                    const btnCenterX = rect.left + rect.width / 2;
                    const btnCenterY = rect.top + rect.height / 2;
                    
                    headX = lerp(headX, btnCenterX, 0.4);
                    headY = lerp(headY, btnCenterY, 0.4);

                    const burstCount = 8 + Math.floor(Math.random() * 3);
                    for (let j = 0; j < burstCount; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1.8 + Math.random() * 2.8;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        const size = 7.0 + Math.random() * 3.5;
                        const life = 0.45 + Math.random() * 0.25;
                        spawnDrop(clientX, clientY, size, life, vx, vy, true);
                    }
                }
            }
        }

        const onMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            updateElementHoverState(e.clientX, e.clientY);
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

            // 运行时响应 __useSystemCursor 切换，用户可在控制台即时切换
            // true = 双光标模式（自定义光标 + 系统指针同时显示）
            // false = 仅自定义光标（隐藏系统指针）
            const html = document.documentElement;
            if (window.__useSystemCursor) {
                html.classList.add('show-system-cursor');
                if (!html.classList.contains('has-custom-cursor')) {
                    html.classList.add('has-custom-cursor');
                }
            } else {
                html.classList.remove('show-system-cursor');
                if (!html.classList.contains('has-custom-cursor')) {
                    html.classList.add('has-custom-cursor');
                }
            }

            const now = performance.now();

            // 0. Re-check hover state every frame to catch slow entries
            const ht = document.elementFromPoint(mouseX, mouseY);
            if (ht) {
                const rip = ht.closest('.ripple-host, a, button, .lang-switcher-btn, .theme-toggle');
                const nav = ht.closest('.nav-item, .logo');
                isHoveringInteract = !!rip;
                cursorEl.classList.toggle('on-nav', !!nav && !rip);
                cursorEl.classList.toggle('on-ripple', !!rip);
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

            // 鼠标运动方向的归一化单位向量（用于水珠惯性飞溅）
            const mouseVxNorm = speed > 0.1 ? mouseVx / speed : 0;
            const mouseVyNorm = speed > 0.1 ? mouseVy / speed : 0;

            // 2. 轨迹与速度预测算法 (Predictive Lookahead)
            const predFactor = speed < 1.0 ? 0 : 0.6;
            const predX = mouseX + mouseVx * predFactor;
            const predY = mouseY + mouseVy * predFactor;

            // 3. 极速跟手响应
            headX += (predX - headX) * 0.95;
            headY += (predY - headY) * 0.95;

            // 4. 状态判定
            const isIdle = speed < 0.25;

            // 5. 永久节点的跟随物理与硬性距离约束 (拖尾粘稠、拉伸明显)
            let targetBodyX = headX;
            let targetBodyY = headY;
            let targetTailX = headX;
            let targetTailY = headY;

            if (!isIdle) {
                // 5.1 运动状态：身体跟随头部（更粘稠的跟随）
                bodyX += (headX - bodyX) * 0.4;
                bodyY += (headY - bodyY) * 0.4;

                const dx1 = bodyX - headX;
                const dy1 = bodyY - headY;
                const dist1 = Math.hypot(dx1, dy1);
                // 允许最大拉伸距离为头部尺寸的 100% (约 22px)，拉出明显拖尾
                const maxDist1 = currentHeadSize * 0.6; 

                if (dist1 > maxDist1 && dist1 > 0) {
                    bodyX = headX + (dx1 / dist1) * maxDist1;
                    bodyY = headY + (dy1 / dist1) * maxDist1;
                }
                targetBodyX = bodyX;
                targetBodyY = bodyY;

                // 5.2 运动状态：尾部跟随身体（更粘稠）
                tailX += (bodyX - tailX) * 0.35;
                tailY += (bodyY - tailY) * 0.35;

                const dx2 = tailX - bodyX;
                const dy2 = tailY - bodyY;
                const dist2 = Math.hypot(dx2, dy2);
                // 允许尾部到身体的最大拉伸距离为身体尺寸的 110% (约 15px)
                const maxDist2 = currentBodySize * 0.8;

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
                const snapDist = 38.0; // 超过 38px 瞬间断开，拉断更清脆

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
                        spawnDrop(snapX, snapY, size, life, vx, vy, true);
                    }
                    
                    // 销毁锚点
                    stickyAnchor.el.remove();
                    stickyAnchor = null;
                }
            }

            // 6.5. 加速爆发特效 —— 猛加速时爆开一圈水珠 (不在交互元素内)
            // 6.5. 加速爆发特效 —— 和按钮进入时的爆发完全一致，0.3s 冷却
            if (!isHoveringInteract && accel > 8 && (now - lastBurstTime) > 200) {
                lastBurstTime = now;
                const burstCount = 8 + Math.floor(Math.random() * 3);
                for (let j = 0; j < burstCount; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1.8 + Math.random() * 2.8;
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    const size = 7.0 + Math.random() * 3.5;
                    const life = 0.45 + Math.random() * 0.25;
                    spawnDrop(headX, headY, size, life, vx, vy, true);
                }
            }

            // 7. 动态水滴 —— 元素内不生成，运动时更频繁，静止时点缀
            if (!isHoveringInteract) {
            if (!isIdle && speed > 4.0) {
                spawnTimer++;
                if (spawnTimer > spawnThreshold) {
                    spawnTimer = 0;
                    spawnThreshold = 2 + Math.floor(Math.random() * 17);

                    // 随机生成 1~3 颗水滴，数量高度不规律
                    const count = 1 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < count; i++) {
                        // 水滴方向大致与鼠标移动相反，加上 ±0.4 弧度的随机散角
                        const baseAngle = Math.atan2(mouseVy, mouseVx) + Math.PI;
                        const spread = (Math.random() - 0.5) * 0.8;
                        const a = baseAngle + spread;

                        const dist = currentTailSize * (0.3 + Math.random() * 0.5);
                        const sx = tailX + Math.cos(a) * dist;
                        const sy = tailY + Math.sin(a) * dist;

                        // 惯性初速度：与光标移动方向一致，大小为光标速度的 20%~60%（均值约 40%），附带少量随机扰动
                        const inertia = speed * (0.20 + Math.random() * 0.30);
                        const vx = mouseVxNorm * inertia + (Math.random() - 0.5) * 0.6;
                        const vy = mouseVyNorm * inertia + (Math.random() - 0.5) * 0.6;

                        const size = 7.0 + Math.random() * 4.5;
                        const life = 0.25 + Math.random() * 0.25;
                        spawnDrop(sx, sy, size, life, vx, vy);
                    }
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

            // 8. 交互吸附：主光标 3 节点即刻隐藏 + 清理非爆发粒子 + 清理粘滞锚点
            if (isHoveringInteract) {
                currentHeadSize = 0; currentBodySize = 0; currentTailSize = 0;
                for (let k = 0; k < 3; k++) {
                    cursorNodes[k].style.width = '0px'; 
                    cursorNodes[k].style.height = '0px';
                    cursorNodes[k].style.opacity = '0';
                }
                // 只清理非 burst 的一般跟随水滴，把爆发式散射水滴留下，确保它们能够完整触发和展示！
                for (let i = tempDrops.length - 1; i >= 0; i--) {
                    if (!tempDrops[i].isBurst) {
                        if (tempDrops[i].el) tempDrops[i].el.remove();
                        tempDrops.splice(i, 1);
                    }
                }
                if (stickyAnchor) {
                    stickyAnchor.el.remove();
                    stickyAnchor = null;
                }
                spawnTimer = 0;
            } else {
                currentHeadSize += (BASE_SIZES[0] - currentHeadSize) * 0.15;
                currentBodySize += (BASE_SIZES[1] - currentBodySize) * 0.15;
                currentTailSize += (BASE_SIZES[2] - currentTailSize) * 0.15;
                
                cursorNodes[0].style.width = `${currentHeadSize.toFixed(1)}px`;
                cursorNodes[0].style.height = `${currentHeadSize.toFixed(1)}px`;
                cursorNodes[0].style.opacity = '';
                
                cursorNodes[1].style.width = `${currentBodySize.toFixed(1)}px`;
                cursorNodes[1].style.height = `${currentBodySize.toFixed(1)}px`;
                cursorNodes[1].style.opacity = '';
                
                cursorNodes[2].style.width = `${currentTailSize.toFixed(1)}px`;
                cursorNodes[2].style.height = `${currentTailSize.toFixed(1)}px`;
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

                // 随着生命值衰减进行缩放，限制最小缩放为 0.5，确保其在滤镜吞噬前产生完美的"Pop"融化断裂感
                const scale = 0.5 + (d.life / d.maxLife) * 0.7;
                d.el.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
            }

            // 为所有磁吸元素执行弹性弹簧插值（每帧一次，平滑渐入跟随）
            // 仅在 tick 数可被 2 整除时运行 = 30fps 更新频率（不可见差异，减少 50% 负载）
            if (tickFrame % 2 === 0) {
                for (const el of _rippleHosts) {
                    if (el._magneticSpring) el._magneticSpring();
                }
            }

            tickFrame++;

            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('scroll', () => {
            if (cursorEl) updateCursorState(mouseX, mouseY);
        }, { passive: true });
        // Click burst — no cooldown, always fires at cursor position
        window.addEventListener('pointerdown', (e) => {
            const localX = e.clientX;
            const localY = e.clientY;
            const burstCount = 10 + Math.floor(Math.random() * 4);
            for (let j = 0; j < burstCount; j++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2.0 + Math.random() * 3.5;
                spawnDrop(localX, localY, 6.0 + Math.random() * 4, 0.5 + Math.random() * 0.3, Math.cos(angle) * speed, Math.sin(angle) * speed, true);
            }
            clickSplitTime = 1.0;
        });
        // Hide cursor when mouse leaves the window
        document.documentElement.addEventListener('mouseleave', () => {
            if (cursorEl) cursorEl.classList.add('cursor-in-iframe');
        });
        document.documentElement.addEventListener('mouseenter', (e) => {
            if (cursorEl) {
                cursorEl.classList.remove('cursor-in-iframe');
                // 清除初始化时的 inline opacity:0，让 CSS opacity:1 生效
                cursorEl.style.opacity = '';
                // 强行将物理坐标跃变到移入时的鼠标当前位置，消除前一次离开的物理坐标残留闪烁
                mouseX = e.clientX;
                mouseY = e.clientY;
                lastMouseX = mouseX;
                lastMouseY = mouseY;
                headX = mouseX; headY = mouseY;
                bodyX = mouseX; bodyY = mouseY;
                tailX = mouseX; tailY = mouseY;

                // 立即进行一次交互状态判定，防止闪烁绿色
                const t = document.elementFromPoint(mouseX, mouseY);
                const rip = t && t.closest('.ripple-host, a, button, .lang-switcher-btn, .theme-toggle');
                isHoveringInteract = !!rip;
                if (isHoveringInteract) {
                    currentHeadSize = 0; currentBodySize = 0; currentTailSize = 0;
                    for (let k = 0; k < 3; k++) {
                        cursorNodes[k].style.width = '0px'; 
                        cursorNodes[k].style.height = '0px';
                        cursorNodes[k].style.opacity = '0';
                    }
                }
            }
        });

        // 10. 跨域/同域通用的 iframe 鼠标进出检测
        document.addEventListener('pointerover', (e) => {
            if (e.target && e.target.tagName === 'IFRAME') {
                cursorEl.classList.add('cursor-in-iframe');
                document.documentElement.classList.remove('has-custom-cursor');
            } else {
                cursorEl.classList.remove('cursor-in-iframe');
                if (finePointer) {
                    document.documentElement.classList.add('has-custom-cursor');
                }
            }
        });

        // 11. 点击 Start Game 时立即隐藏光标
        document.addEventListener('pointerdown', (e) => {
            if (e.target && e.target.closest('.game-start-btn')) {
                cursorEl.classList.add('cursor-in-iframe');
                document.documentElement.classList.remove('has-custom-cursor');
            }
        });
    }

    function initDitherNoise() {
        if (document.querySelector('.dither-noise-overlay')) return;
        const dither = document.createElement('div');
        dither.className = 'dither-noise-overlay';
        document.body.appendChild(dither);
    }

    /* ---------- Public init (idempotent, called per page) ---------- */
    function init() {
        initDitherNoise();
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
