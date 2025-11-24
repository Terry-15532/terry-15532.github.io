/* 
   ==========================================================================
   CORE LOGIC SYSTEM
   Refactored: 2025-11-22
   ========================================================================== 
*/

// --- DOM Helper ---
const $ = (id) => document.getElementById(id);

// --- Theme Management ---
function InitTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    UpdateThemeIcon(savedTheme);
}

function ToggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    UpdateThemeIcon(newTheme);
}

function UpdateThemeIcon(theme) {
    const icon = $('themeIcon');
    if (icon) {
        icon.innerHTML = theme === 'light' ? '☾' : '☀';
    }
}

// --- Navigation & SPA Logic ---
let isNavigating = false;

async function SwitchPage(url, title) {
    if (isNavigating) return;
    isNavigating = true;
    
    // 1. Update URL and Title
    if (title) document.title = title + " | Terry Li";
    window.history.pushState({}, "", "#" + url.replace('.html', ''));

    // 2. Fetch Content
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Page not found');
        const html = await response.text();
        
        // 3. Parse and Extract Content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // We assume the content we want is in a container with class 'wrapper' or similar, 
        // OR we just take the body content if it's a fragment.
        // For this refactor, let's assume we replace the content of #main-content
        const newContent = doc.querySelector('.wrapper') || doc.body;
        
        // 4. Animate Out
        const main = $('main-content');
        main.style.opacity = '0';
        main.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            // 5. Replace Content
            main.innerHTML = newContent.innerHTML;
            
            // 6. Execute Scripts AND Styles (Extract from the entire fetched document)
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                main.appendChild(newScript);
            });

            // Also inject inline styles from the loaded page
            const styles = doc.querySelectorAll('style');
            styles.forEach(oldStyle => {
                const newStyle = document.createElement('style');
                newStyle.appendChild(document.createTextNode(oldStyle.innerHTML));
                main.appendChild(newStyle);
            });
            
            // 7. Animate In
            window.scrollTo(0, 0);
            main.style.opacity = '1';
            main.style.transform = 'translateY(0)';
            
            isNavigating = false;
            
            // Re-init any components if needed
            if (typeof InitIcons === 'function') InitIcons();
            
        }, 400); // Match CSS transition time
        
    } catch (error) {
        console.error('Navigation Error:', error);
        isNavigating = false;
    }
}

// --- Component Loading ---
async function LoadComponent(id, url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        $(id).innerHTML = html;
        
        // Execute scripts in component
        const scripts = $(id).querySelectorAll('script');
        scripts.forEach(s => eval(s.innerHTML));
        
    } catch (e) {
        console.error(`Failed to load ${url}`, e);
    }
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    InitTheme();
    LoadComponent('header', 'header.html').then(() => UpdateThemeIcon(localStorage.getItem('theme')));
    LoadComponent('footer', 'footer.html');
    
    // Handle initial hash navigation
    const hash = window.location.hash.substring(1);
    if (hash) {
        SwitchPage(hash + '.html');
    }
});

// --- Global Utils ---
function OpenLink(url) {
    window.open(url, '_blank');
}
