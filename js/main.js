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
