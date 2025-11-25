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
    
    // Handle Browser Back/Forward
    window.addEventListener('popstate', () => {
        const path = window.location.hash.slice(1) || 'index.html';
        loadPage(path, false);
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
});
function initPage() {
    // Re-attach event listeners and initialize effects
    initHoverEffects();
    // initGlitchEffect(); // Disabled
    initScrollAnimations();
    updateActiveNav();
    initDecoAnimations(); // New function
    initDotController(); // Initialize 3D dots controller
    initLightbox(); // Initialize Lightbox
    initAboutButton(); // Initialize about button visibility
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

// Dot-only 2D Xbox-style controller (repelling points, transparent background)
function initDotController() {
    const canvas = document.getElementById('gamepad-canvas');

    if (!canvas) {
        if (window._dotControllerCleanup) window._dotControllerCleanup();
        return;
    }

    if (window._dotControllerCleanup) window._dotControllerCleanup();

    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;

    const DESIGN_W = 480; // design coordinate space
    const DESIGN_H = 420;

    let scale = 1;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        const pw = Math.max(1, canvas.clientWidth);
        const ph = Math.max(1, canvas.clientHeight);
        canvas.width = Math.round(pw * dpr);
        canvas.height = Math.round(ph * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scale = Math.min(canvas.clientWidth / DESIGN_W, canvas.clientHeight / DESIGN_H);
    }

    resize();
    window.addEventListener('resize', resize);

    // Directly use the provided SVG path as the source of dot positions.
    // We sample the SVG path deterministically (fixed spacing) and create points that map to the canvas design space.
    const points = [];
    const UNIFORM_DOT = 1.5;

    // SVG path data (two paths combined from the user-supplied SVG)
    const svgPathData = `M11.5 6.027a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm2.5-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm-6.5-3h1v1h1v1h-1v1h-1v-1h-1v-1h1v-1z M3.051 3.26a.5.5 0 0 1 .354-.613l1.932-.518a.5.5 0 0 1 .62.39c.655-.079 1.35-.117 2.043-.117.72 0 1.443.041 2.12.126a.5.5 0 0 1 .622-.399l1.932.518a.5.5 0 0 1 .306.729c.14.09.266.19.373.297.408.408.78 1.05 1.095 1.772.32.733.599 1.591.805 2.466.206.875.34 1.78.364 2.606.024.816-.059 1.602-.328 2.21a1.42 1.42 0 0 1-1.445.83c-.636-.067-1.115-.394-1.513-.773-.245-.232-.496-.526-.739-.808-.126-.148-.25-.292-.368-.423-.728-.804-1.597-1.527-3.224-1.527-1.627 0-2.496.723-3.224 1.527-.119.131-.242.275-.368.423-.243.282-.494.575-.739.808-.398.38-.877.706-1.513.773a1.42 1.42 0 0 1-1.445-.83c-.27-.608-.352-1.395-.329-2.21.024-.826.16-1.73.365-2.606.206-.875.486-1.733.805-2.466.315-.722.687-1.364 1.094-1.772a2.34 2.34 0 0 1 .433-.335.504.504 0 0 1-.028-.079zm2.036.412c-.877.185-1.469.443-1.733.708-.276.276-.587.783-.885 1.465a13.748 13.748 0 0 0-.748 2.295 12.351 12.351 0 0 0-.339 2.406c-.022.755.062 1.368.243 1.776a.42.42 0 0 0 .426.24c.327-.034.61-.199.929-.502.212-.202.4-.423.615-.674.133-.156.276-.323.44-.504C4.861 9.969 5.978 9.027 8 9.027s3.139.942 3.965 1.855c.164.181.307.348.44.504.214.251.403.472.615.674.318.303.601.468.929.503a.42.42 0 0 0 .426-.241c.18-.408.265-1.02.243-1.776a12.354 12.354 0 0 0-.339-2.406 13.753 13.753 0 0 0-.748-2.295c-.298-.682-.61-1.19-.885-1.465-.264-.265-.856-.523-1.733-.708-.85-.179-1.877-.27-2.913-.27-1.036 0-2.063.091-2.913.27z`;

    const svgNS = 'http://www.w3.org/2000/svg';
    const tmpSvg = document.createElementNS(svgNS, 'svg');
    tmpSvg.setAttribute('viewBox', '0 0 16 16');
    tmpSvg.style.position = 'absolute';
    tmpSvg.style.left = '-9999px';
    tmpSvg.style.width = '1px';
    tmpSvg.style.height = '1px';
    tmpSvg.style.opacity = '0';

    const tmpPath = document.createElementNS(svgNS, 'path');
    tmpPath.setAttribute('d', svgPathData);
    tmpSvg.appendChild(tmpPath);
    document.body.appendChild(tmpSvg);

    try {
        const totalLen = Math.max(1, tmpPath.getTotalLength());
        // sample density: fewer samples for a lighter dotted look
        const samples = Math.min(400, Math.max(100, Math.round(totalLen * 6)));

        const scaleToDesignX = (DESIGN_W / 16);
        const scaleToDesignY = (DESIGN_H / 16);

        for (let i = 0; i < samples; i++) {
            const pt = tmpPath.getPointAtLength((i / (samples - 1)) * totalLen);
            const rx = pt.x - 8; // center around 0
            const ry = pt.y - 8;
            const bx = rx * scaleToDesignX;
            const by = ry * scaleToDesignY;
            points.push({ bx, by, x: bx, y: by, baseSize: UNIFORM_DOT });
        }
    } catch (err) {
        // if sampling fails, fallback to a simpler ring
        for (let a = 0; a < Math.PI * 2; a += 0.04) {
            const bx = Math.cos(a) * 160;
            const by = Math.sin(a) * 60;
            points.push({ bx, by, x: bx, y: by, baseSize: UNIFORM_DOT });
        }
    } finally {
        if (tmpSvg && tmpSvg.parentNode) tmpSvg.parentNode.removeChild(tmpSvg);
    }


    // visual parameters
    // Make avoiding effect smaller and subtler
    const repulsionRadius = 150; // px — reduced avoiding radius
    const repulsionStrength = 30; // reduced avoidance force
    const easePos = 0.05; // easing factor for movement (no bouncing)

    let pointerX = null, pointerY = null;

    function onPointerMove(e) {
        const rect = canvas.getBoundingClientRect();
        pointerX = (e.clientX - rect.left);
        pointerY = (e.clientY - rect.top);
    }

    function onPointerLeave() {
        pointerX = null; pointerY = null;
    }

    // make sure canvas responds directly
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', (e) => { onPointerMove(e); });
    canvas.addEventListener('pointerleave', onPointerLeave);

    let rafId = null;

    function draw() {
        // transparent background — clear leaves it transparent
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        // dynamic monochrome color based on theme (white on dark, black on light)
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const dotColor = isDark ? '#ffffffc0' : '#000000c0';

        // center transform
        const cx = canvas.clientWidth / 2;
        const cy = canvas.clientHeight / 2 + 6;

        // ease positions toward target (base + repulsion offset) — avoids bounce
        for (let p of points) {
            let targetX = p.bx;
            let targetY = p.by;

            if (pointerX !== null) {
                const baseScreenX = cx + p.bx * scale;
                const baseScreenY = cy + p.by * scale;
                const dx = baseScreenX - pointerX;
                const dy = baseScreenY - pointerY;
                const dist = Math.hypot(dx, dy);

                if (dist < repulsionRadius && dist > 0.01) {
                    const norm = 1 - (dist / repulsionRadius);
                    const push = (norm * norm) * repulsionStrength; // screen-space push in pixels
                    // convert push to design space (divide by scale)
                    const pushX = (dx / dist) * push / scale;
                    const pushY = (dy / dist) * push / scale;
                    targetX = p.bx + pushX;
                    targetY = p.by + pushY;
                }
            }

            // ease current toward target position
            p.x += (targetX - p.x) * easePos;
            p.y += (targetY - p.y) * easePos;
        }

        // draw dots
        for (let p of points) {
            const sx = cx + p.x * scale;
            const sy = cy + p.y * scale;
            const size = Math.max(0.8, p.baseSize) * scale;

            ctx.beginPath();
            ctx.fillStyle = dotColor;
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }

        rafId = requestAnimationFrame(draw);
    }

    // start animation
    draw();

    // store cleanup for SPA re-init
    window._dotControllerCleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('resize', resize);
        window._dotControllerCleanup = null;
    };
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

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    // Simple Particle Class
    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 1; // Random horizontal speed
            this.vy = (Math.random() - 0.5) * 1; // Random vertical speed
            this.size = Math.random() * 3; // Random size
            this.alpha = Math.random() * 0.2 + 0.2;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off edges
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
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
        
        particles.forEach(p => {
            p.update();
            p.draw();
        });

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
            if(Math.random() > 0.95) {
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
        if(img) {
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
