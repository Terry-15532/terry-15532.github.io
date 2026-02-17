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
            setLanguage(currentLang === 'zh' ? 'en' : 'zh');
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
