(function(){
    const STORAGE_KEY = 'siteLangPref';
    function detectDefault(){
        let saved = null;
        try{ saved = localStorage.getItem(STORAGE_KEY); }catch(e){}
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

            const enOpt = btn.querySelector('.lang-option.lang-en');
            const zhOpt = btn.querySelector('.lang-option.lang-zh');

            // 立即强制切换按钮文字：用显式 inline display 覆盖 CSS 类规则
            if (newLang === 'zh') {
                zhOpt.style.display = 'none';
                enOpt.style.display = 'inline';
            } else {
                enOpt.style.display = 'none';
                zhOpt.style.display = 'inline';
            }

            // 弹入动画
            const visibleLabel = newLang === 'zh' ? enOpt : zhOpt;
            if (visibleLabel) {
                visibleLabel.classList.remove('lang-pop');
                void visibleLabel.offsetWidth;
                visibleLabel.classList.add('lang-pop');
                clearTimeout(visibleLabel._popTimer);
                visibleLabel._popTimer = setTimeout(() => visibleLabel.classList.remove('lang-pop'), 500);
            }

            if (window.MotionUX && MotionUX.fxCircle) {
                const rect = btn.getBoundingClientRect();
                const dark = document.documentElement.getAttribute('data-theme') === 'dark';
                const color = dark ? 'rgba(13, 16, 13, 0.85)' : 'rgba(255, 255, 255, 0.85)';
                const label = newLang === 'zh' ? '加载中文模块' : 'Loading English Module';
                MotionUX.fxCircle(rect.left + rect.width / 2, rect.top + rect.height / 2, color, () => {
                    applyLang(newLang);
                    // 清除 inline display，CSS 类接管可见性
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
