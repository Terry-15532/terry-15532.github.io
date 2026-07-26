/*
 * Critical UI bootstrap.
 *
 * This file intentionally has no dependency on main.js or motion.js. It is
 * loaded with high priority and creates the language/theme controls as soon as
 * the parser reaches <nav>, without waiting for DOMContentLoaded.
 */
(function () {
    'use strict';

    const LANGUAGE_STORAGE_KEY = 'siteLangPref';
    const THEME_STORAGE_KEY = 'theme';
    const FONT_QUERY =
        'css2?family=Inter:wght@400;500;700;800;900' +
        '&family=Noto+Sans+SC:wght@400;500;700;800;900' +
        '&display=swap';

    function loadSansFontSources() {
        [
            `https://fonts.googleapis.com/${FONT_QUERY}`,
            `https://fonts.loli.net/${FONT_QUERY}`
        ].forEach((href, index) => {
            if (document.querySelector(`link[href="${href}"]`)) return;

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.media = 'print';
            link.dataset.fontSource =
                index === 0 ? 'google' : 'china-mirror';
            link.onload = () => {
                link.media = 'all';
            };
            document.head.appendChild(link);
        });
    }

    loadSansFontSources();

    const sunIcon =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

    const moonIcon =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (_) {}
    }

    function detectLanguage() {
        const saved =
            readStorage(LANGUAGE_STORAGE_KEY);

        if (saved) return saved;

        const browserLanguage =
            (
                navigator.languages &&
                navigator.languages[0]
            ) ||
            navigator.language ||
            'en';

        return /^(zh|zh-)/i.test(browserLanguage)
            ? 'zh'
            : 'en';
    }

    function applyLanguage(language) {
        document.documentElement.classList.toggle(
            'lang-zh',
            language === 'zh'
        );

        document.documentElement.classList.toggle(
            'lang-en',
            language !== 'zh'
        );

        writeStorage(
            LANGUAGE_STORAGE_KEY,
            language
        );
    }

    function detectTheme() {
        return readStorage(THEME_STORAGE_KEY) || 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute(
            'data-theme',
            theme
        );
    }

    function createLanguageSwitcher(nav) {
        if (nav.querySelector('.lang-switcher-btn')) {
            return;
        }

        const button =
            document.createElement('button');

        button.className = 'lang-switcher-btn';
        button.type = 'button';
        button.title =
            'Switch Language / 切换语言';

        button.innerHTML =
            '<span class="lang-option lang-en">EN</span>' +
            '<span class="lang-divider">/</span>' +
            '<span class="lang-option lang-zh">中</span>';

        button.addEventListener('click', () => {
            const currentLanguage =
                document.documentElement.classList
                    .contains('lang-zh')
                    ? 'zh'
                    : 'en';

            const nextLanguage =
                currentLanguage === 'zh'
                    ? 'en'
                    : 'zh';

            const englishOption =
                button.querySelector(
                    '.lang-option.lang-en'
                );

            const chineseOption =
                button.querySelector(
                    '.lang-option.lang-zh'
                );

            if (nextLanguage === 'zh') {
                chineseOption.style.display = 'none';
                englishOption.style.display = 'inline';
            } else {
                englishOption.style.display = 'none';
                chineseOption.style.display = 'inline';
            }

            const visibleOption =
                nextLanguage === 'zh'
                    ? englishOption
                    : chineseOption;

            visibleOption.classList.remove('lang-pop');
            void visibleOption.offsetWidth;
            visibleOption.classList.add('lang-pop');

            clearTimeout(visibleOption._popTimer);

            visibleOption._popTimer = setTimeout(
                () => {
                    visibleOption.classList.remove(
                        'lang-pop'
                    );
                },
                500
            );

            const finish = () => {
                applyLanguage(nextLanguage);
                englishOption.style.display = '';
                chineseOption.style.display = '';
            };

            if (
                window.MotionUX &&
                window.MotionUX.fxCircle
            ) {
                const rect =
                    button.getBoundingClientRect();

                const dark =
                    document.documentElement
                        .getAttribute('data-theme') ===
                    'dark';

                const color = dark
                    ? 'rgba(13, 16, 13, 0.85)'
                    : 'rgba(255, 255, 255, 0.85)';

                const label =
                    nextLanguage === 'zh'
                        ? '加载中文模块'
                        : 'Loading English Module';

                window.MotionUX.fxCircle(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                    color,
                    finish,
                    label
                );
            } else {
                finish();
            }
        });

        const navLinks =
            nav.querySelector('.nav-links');

        (navLinks || nav).insertAdjacentElement(
            'afterend',
            button
        );
    }

    function createThemeToggle(nav) {
        if (nav.querySelector('.theme-toggle')) {
            return;
        }

        const currentTheme = detectTheme();
        const button =
            document.createElement('button');

        button.className = 'theme-toggle';
        button.type = 'button';
        button.setAttribute(
            'aria-label',
            'Toggle theme'
        );

        button.innerHTML =
            currentTheme === 'dark'
                ? sunIcon
                : moonIcon;

        button.addEventListener('click', () => {
            const theme =
                document.documentElement.getAttribute(
                    'data-theme'
                );

            const nextTheme =
                theme === 'dark'
                    ? 'light'
                    : 'dark';

            nav.classList.add(
                nextTheme === 'dark'
                    ? 'nav-hint-dark'
                    : 'nav-hint-light'
            );

            writeStorage(
                THEME_STORAGE_KEY,
                nextTheme
            );

            const iconWrap =
                button.querySelector(
                    '.ripple-content'
                );

            const nextIcon =
                nextTheme === 'dark'
                    ? sunIcon
                    : moonIcon;

            if (iconWrap) {
                iconWrap.innerHTML = nextIcon;
            } else {
                button.innerHTML = nextIcon;
            }

            const finish = () => {
                applyTheme(nextTheme);

                nav.classList.remove(
                    'nav-hint-dark',
                    'nav-hint-light'
                );
            };

            if (
                window.MotionUX &&
                window.MotionUX.fxCircle
            ) {
                const rect =
                    button.getBoundingClientRect();

                const transitionIcon =
                    document.createElement('span');

                transitionIcon.style.color =
                    nextTheme === 'dark'
                        ? '#ffffff'
                        : '#000000';

                transitionIcon.style.display = 'flex';
                transitionIcon.innerHTML =
                    nextTheme === 'dark'
                        ? moonIcon
                        : sunIcon;

                window.MotionUX.fxCircle(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                    nextTheme === 'dark'
                        ? '#0a0d0a'
                        : '#f6faf6',
                    finish,
                    transitionIcon,
                    nextTheme === 'dark'
                        ? '#00CC33'
                        : '#008A22'
                );
            } else {
                finish();
            }
        });

        nav.appendChild(button);
    }

    function ensureCriticalControls() {
        const nav = document.querySelector('nav');

        if (!nav) return false;

        createLanguageSwitcher(nav);
        createThemeToggle(nav);

        if (
            window.MotionUX &&
            window.MotionUX.init
        ) {
            window.MotionUX.init();
        }

        return true;
    }

    const language = detectLanguage();
    const theme = detectTheme();

    applyLanguage(language);
    applyTheme(theme);

    if (!ensureCriticalControls()) {
        const observer = new MutationObserver(() => {
            if (ensureCriticalControls()) {
                observer.disconnect();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        document.addEventListener(
            'DOMContentLoaded',
            () => {
                ensureCriticalControls();
                observer.disconnect();
            },
            { once: true }
        );
    }

    window.siteI18n = {
        setLanguage: applyLanguage,
        applyLang: applyLanguage
    };
})();
