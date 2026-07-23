(function(){
    const STORAGE_KEY = 'siteLangPref';
    function detectDefault(){
        const saved = localStorage.getItem(STORAGE_KEY);
        if(saved) return saved;
        const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
        return /^(zh|zh-)/i.test(nav) ? 'zh' : 'en';
    }

    function applyLang(lang){
        if(lang === 'zh'){
            document.documentElement.classList.add('lang-zh');
            document.documentElement.classList.remove('lang-en');
        } else {
            document.documentElement.classList.remove('lang-zh');
            document.documentElement.classList.add('lang-en');
        }
        try{ localStorage.setItem(STORAGE_KEY, lang); }catch(e){}
    }

    function setLanguage(lang){
        applyLang(lang);
    }

    function createSwitcher(){
        const nav = document.querySelector('nav');
        if(!nav) return;
        // avoid duplicate switcher
        if(nav.querySelector('.lang-switcher-btn')) return;
        
        const btn = document.createElement('button');
        btn.className = 'lang-switcher-btn';
        btn.title = 'Switch Language / 切换语言';
        btn.innerHTML = '<span class="lang-option lang-en">EN</span><span class="lang-divider">/</span><span class="lang-option lang-zh">中</span>';
        
        btn.onclick = () => {
            const currentLang = document.documentElement.classList.contains('lang-zh') ? 'zh' : 'en';
            const newLang = currentLang === 'zh' ? 'en' : 'zh';

            // Immediately switch only the button label visibility
            const enOpt = btn.querySelector('.lang-option.lang-en');
            const zhOpt = btn.querySelector('.lang-option.lang-zh');
            if (newLang === 'zh') {
                enOpt.style.display = 'none';
                zhOpt.style.display = '';
            } else {
                zhOpt.style.display = 'none';
                enOpt.style.display = '';
            }

            // Trigger Q-bouncy pop animation on the now-visible label
            const visibleLabel = btn.querySelector(
                newLang === 'zh' ? '.lang-option.lang-zh' : '.lang-option.lang-en'
            );
            if (visibleLabel) {
                visibleLabel.classList.remove('lang-pop');
                void visibleLabel.offsetWidth;
                visibleLabel.classList.add('lang-pop');
                visibleLabel.addEventListener('animationend', function h() {
                    visibleLabel.removeEventListener('animationend', h);
                    visibleLabel.classList.remove('lang-pop');
                });
            }

            if (window.MotionUX && MotionUX.fxCircle) {
                const rect = btn.getBoundingClientRect();
                const dark = document.documentElement.getAttribute('data-theme') === 'dark';
                const color = dark ? 'rgba(13, 16, 13, 0.85)' : 'rgba(255, 255, 255, 0.85)';
                const label = newLang === 'zh' ? '加载中文模块' : 'Loading English Module';
                MotionUX.fxCircle(rect.left + rect.width / 2, rect.top + rect.height / 2, color, () => {
                    // Switch page content AFTER mask fully covers screen
                    applyLang(newLang);
                    // Clean up inline display overrides — CSS classes now handle visibility
                    enOpt.style.display = '';
                    zhOpt.style.display = '';
                }, label);
            } else {
                applyLang(newLang);
            }
        };
        
        // try to append to nav .nav-links or to nav directly
        const target = nav.querySelector('.nav-links') || nav;
        target.insertAdjacentElement('afterend', btn);
    }

    // initialize
    const lang = detectDefault();
    document.addEventListener('DOMContentLoaded', function(){
        applyLang(lang);
        createSwitcher();
    });

    // expose for console/manual calls
    window.siteI18n = { setLanguage, applyLang };
})();
