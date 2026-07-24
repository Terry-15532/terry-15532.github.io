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

    /* ---------- Global ambient loop (runs once) ---------- */
    let ambientStarted = false;
    let artCols = [];

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

        cards.forEach(card => {
            const img = card.querySelector('img');
            let h = 300;

            if (img && img.naturalWidth > 0) {
                h = (img.naturalHeight / img.naturalWidth) * 300;
            }

            let minIdx = 0;

            for (let c = 1; c < n; c++) {
                if (colHeights[c] < colHeights[minIdx]) {
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

        let targetTransX = 0;
        let targetTransY = 0;
        let curTransX = 0;
        let curTransY = 0;

        /*
         * 原逻辑每两个 60 Hz 帧执行一次 0.18 插值。
         * deltaFrames / 2 用于维持原来的磁吸响应时间。
         */
        el._magneticSpring = (deltaFrames = 2) => {
            if (!isHovering) return;

            const spring =
                1 - Math.pow(1 - 0.18, deltaFrames / 2);

            curTransX +=
                (targetTransX - curTransX) * spring;

            curTransY +=
                (targetTransY - curTransY) * spring;

            el.style.transform =
                `translate3d(` +
                `${curTransX.toFixed(1)}px, ` +
                `${curTransY.toFixed(1)}px, 0)`;
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

        function exitInks() {
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

            let exitX = rect.width / 2;
            let exitY = rect.height + 10;

            if (
                el.matches(
                    '.timeline-content.link-content'
                )
            ) {
                exitX = -10;
                exitY = rect.height / 2;
            } else {
                const textEl = el.querySelector(
                    '.card-content, ' +
                    '.card-info, ' +
                    '.project-card-info, ' +
                    '.art-info, ' +
                    '.card-body, ' +
                    '.card-text, ' +
                    '.card-overlay-content'
                );

                if (textEl) {
                    const tr =
                        textEl.getBoundingClientRect();

                    const textCenterX =
                        tr.left -
                        rect.left +
                        tr.width / 2;

                    exitX =
                        textCenterX > rect.width / 2
                            ? rect.width + 10
                            : -10;

                    exitY = rect.height / 2;
                }
            }

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
                        duration: 250,
                        easing:
                            'cubic-bezier(0.4, 0, 0.8, 1)',
                        fill: 'forwards'
                    }
                );

                setTimeout(() => ink.remove(), 340);
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

            if (isExiting) {
                clearExitTimers();

                isExiting = false;
                el.style.transition = '';
                el.style.transform = '';
            }

            isHovering = true;

            if (isMagnetic) {
                const rect =
                    el.getBoundingClientRect();

                const width = rect.width;
                const height = rect.height;

                const centerX =
                    rect.left + width / 2;

                const centerY =
                    rect.top + height / 2;

                const enterDx =
                    event.clientX - centerX;

                const enterDy =
                    event.clientY - centerY;

                const length =
                    Math.hypot(enterDx, enterDy) || 1;

                const isNavButton = el.matches(
                    '.theme-toggle, ' +
                    '.lang-switcher-btn, ' +
                    '.icon-link, ' +
                    '.footer-social-link'
                );

                const amplitude = isNavButton
                    ? 4.5
                    : width < 80 || height < 80
                        ? 3.5
                        : 2;

                const maxMove = isNavButton
                    ? 4
                    : width < 80 || height < 80
                        ? 3
                        : 2;

                targetTransX = clamp(
                    (enterDx / length) * amplitude,
                    -maxMove,
                    maxMove
                );

                targetTransY = clamp(
                    (enterDy / length) * amplitude,
                    -maxMove,
                    maxMove
                );

                curTransX = 0;
                curTransY = 0;
            }

            const oldInks =
                el.querySelectorAll('.ripple-ink');

            oldInks.forEach(ink => {
                ink.style.transition =
                    'opacity 0.2s ease';

                ink.style.opacity = '0';

                setTimeout(() => ink.remove(), 250);
            });

            liveInks = [];

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

            const x = event.clientX - elRect.left;
            const y = event.clientY - elRect.top;

            const ink = spawnInk(el, x, y);

            liveInks = [ink];
            ink.style.opacity = '0';

            growAnim = ink.animate(
                [
                    {
                        transform:
                            'translate(-50%, -50%) scale(0)'
                    },
                    {
                        transform:
                            `translate(-50%, -50%) ` +
                            `scale(${maxScale.toFixed(2)})`
                    }
                ],
                {
                    duration: inkDur,
                    easing: 'linear',
                    fill: 'forwards'
                }
            );

            ink.animate(
                [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                {
                    duration: 200,
                    easing: 'ease-out',
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
                const width = elRect.width;
                const height = elRect.height;

                const centerX =
                    elRect.left + width / 2;

                const centerY =
                    elRect.top + height / 2;

                const dx = event.clientX - centerX;
                const dy = event.clientY - centerY;

                const isNavButton = el.matches(
                    '.theme-toggle, ' +
                    '.lang-switcher-btn, ' +
                    '.icon-link, ' +
                    '.footer-social-link'
                );

                const ratio = isNavButton
                    ? 0.5
                    : width < 80 || height < 80
                        ? 0.3
                        : 0.2;

                const limit = isNavButton
                    ? 13
                    : width < 80 || height < 80
                        ? 8
                        : 6;

                targetTransX =
                    clamp(dx * ratio, -limit, limit);

                targetTransY =
                    clamp(dy * ratio, -limit, limit);
            }

            if (liveInks.length) {
                moveInks(
                    event.clientX - elRect.left,
                    event.clientY - elRect.top
                );
            }

            if (cursorGlow) {
                cursorGlow.style.left =
                    `${event.clientX - elRect.left}px`;

                cursorGlow.style.top =
                    `${event.clientY - elRect.top}px`;
            }
        });

        el._scrollTick = () => {
            if (!isHovering) return;

            const rect = el.getBoundingClientRect();
            const x = mouseX - rect.left;
            const y = mouseY - rect.top;

            if (liveInks.length) {
                moveInks(x, y);
            }

            if (cursorGlow) {
                cursorGlow.style.left = `${x}px`;
                cursorGlow.style.top = `${y}px`;
            }
        };

        el.addEventListener('pointerleave', () => {
            if (cursorGlow) {
                cursorGlow.classList.remove('active');
            }

            isHovering = false;

            if (!growAnim && !isExiting) {
                startExit();
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

        function startExit() {
            isExiting = true;

            exitInks();

            if (isMagnetic) {
                targetTransX = 0;
                targetTransY = 0;

                el.style.transition =
                    'transform 0.55s ' +
                    'cubic-bezier(0.175, 1.55, 0.35, 1.15)';

                el.style.transform =
                    'translate3d(0, 0, 0)';

                const timer = setTimeout(() => {
                    el.style.transition = '';
                    isExiting = false;
                }, 600);

                exitTimers.push(timer);
            } else {
                const timer = setTimeout(() => {
                    isExiting = false;
                }, 500);

                exitTimers.push(timer);
            }

            el.classList.remove('ripple-filled');

            if (solid) {
                el.classList.remove('rippling');
            }

            el.classList.remove('is-hovered');
            isHovering = false;
        }
    }

    function initRipples() {
        document
            .querySelectorAll(RIPPLE_SELECTOR)
            .forEach(bindRipple);
    }

    /* ---------- Full-screen circular sweeps ---------- */
    const SWEEP_SIZE = 26;

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
                duration: 300,
                easing:
                    'cubic-bezier(0.34, 1.1, 0.9, 1)',
                fill: 'forwards'
            }
        );

        sweepBrand =
            makeBrand('P . R . T . S .', 90);

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
                duration: 360,
                easing:
                    'cubic-bezier(0.34, 1.56, 0.64, 1)',
                fill: 'forwards'
            }
        );

        let brand = null;

        if (brandContent) {
            brand =
                makeBrand(brandContent, 100);

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
uniform float uGreen;

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

    uv.y -= uScroll * 0.00005;

    vec2 p =
        uv + vec2(t * 0.006, -t * 0.004);

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
    float bands = fract(h * freq);

    float d =
        min(bands, 1.0 - bands) / freq;

#ifdef GL_OES_standard_derivatives
    float w = fwidth(h) * 0.7 + 0.001;

    float line =
        1.0 -
        smoothstep(w * 0.5, w * 1.4, d);
#else
    float line =
        smoothstep(0.012, 0.004, d);
#endif

    vec3 accent =
        vec3(
            0.0,
            uGreen,
            0.24 * (0.8 / uGreen)
        );

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

        const greenLocation =
            gl.getUniformLocation(program, 'uGreen');

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
                dark ? 0.5 : 0.3
            );

            gl.uniform1f(
                greenLocation,
                dark ? 0.8 : 1.04
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
                                0 0 0 35 -13
                            "
                            result="gooey"
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
                        --accent-cyan,
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

        element.style.background =
            'var(--accent-cyan, #00f0ff)';

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

        function updateElementHoverState(
            clientX,
            clientY
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

            const ripple = target
                ? target.closest(
                    '.ripple-host, ' +
                    'a, ' +
                    'button, ' +
                    '.lang-switcher-btn, ' +
                    '.theme-toggle'
                )
                : null;

            if (ripple === currentHoveredHost) {
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
                !isInteractive
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

                anchorElement.style.background =
                    'var(--accent-cyan, #00f0ff)';

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

            const ripple = target.closest(
                '.ripple-host, ' +
                'a, ' +
                'button, ' +
                '.lang-switcher-btn, ' +
                '.theme-toggle'
            );

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
            mouseX = event.clientX;
            mouseY = event.clientY;

            updateElementHoverState(
                event.clientX,
                event.clientY
            );

            updateCursorState(
                event.clientX,
                event.clientY
            );
        };

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
                    hoveredTarget.closest(
                        '.ripple-host, ' +
                        'a, ' +
                        'button, ' +
                        '.lang-switcher-btn, ' +
                        '.theme-toggle'
                    );

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

            const oldVx = mouseVx;
            const oldVy = mouseVy;

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

            const acceleration =
                (
                    speed -
                    Math.hypot(oldVx, oldVy)
                ) / safeDeltaFrames;

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
                acceleration > 10 &&
                now - lastBurstTime > 200
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
                REFERENCE_FRAME_MS * 2
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
                    REFERENCE_FRAME_MS * 2;
            }

            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);

        window.addEventListener(
            'pointermove',
            onMove,
            { passive: true }
        );

        window.addEventListener(
            'scroll',
            () => {
                if (cursorEl) {
                    updateCursorState(
                        mouseX,
                        mouseY
                    );
                }
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

        document.documentElement.addEventListener(
            'mouseleave',
            () => {
                if (cursorEl) {
                    cursorEl.classList.add(
                        'cursor-in-iframe'
                    );
                }
            }
        );

        document.documentElement.addEventListener(
            'mouseenter',
            event => {
                if (!cursorEl) return;

                cursorEl.classList.remove(
                    'cursor-in-iframe'
                );

                cursorEl.style.opacity = '';

                mouseX = event.clientX;
                mouseY = event.clientY;

                lastMouseX = mouseX;
                lastMouseY = mouseY;

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
                    target &&
                    target.closest(
                        '.ripple-host, ' +
                        'a, ' +
                        'button, ' +
                        '.lang-switcher-btn, ' +
                        '.theme-toggle'
                    );

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
            }
        );

        document.addEventListener(
            'pointerover',
            event => {
                if (
                    event.target &&
                    event.target.tagName === 'IFRAME'
                ) {
                    cursorEl.classList.add(
                        'cursor-in-iframe'
                    );

                    document.documentElement
                        .classList.remove(
                            'has-custom-cursor'
                        );
                } else {
                    cursorEl.classList.remove(
                        'cursor-in-iframe'
                    );

                    if (finePointer) {
                        document.documentElement
                            .classList.add(
                                'has-custom-cursor'
                            );
                    }
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
                    cursorEl.classList.add(
                        'cursor-in-iframe'
                    );

                    document.documentElement
                        .classList.remove(
                            'has-custom-cursor'
                        );
                }
            }
        );
    }

    function initDitherNoise() {
        if (
            document.querySelector(
                '.dither-noise-overlay'
            )
        ) {
            return;
        }

        const dither =
            document.createElement('div');

        dither.className =
            'dither-noise-overlay';

        document.body.appendChild(dither);
    }

    function init() {
        initDitherNoise();
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
        abortSweep
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