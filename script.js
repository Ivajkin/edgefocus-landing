// Multi-Language System with Auto-Detection
document.addEventListener('DOMContentLoaded', () => {
    // Supported languages with metadata
    const LANGUAGES = {
        en: { name: 'English', flag: '🇬🇧', dir: 'ltr' },
        ru: { name: 'Русский', flag: '🇷🇺', dir: 'ltr' },
        ar: { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
        zh: { name: '中文', flag: '🇨🇳', dir: 'ltr' }
    };

    // Detect browser language and get initial language
    function detectLanguage() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && LANGUAGES[urlLang]) return urlLang;

        const savedLang = localStorage.getItem('edgefocus-lang');
        if (savedLang && LANGUAGES[savedLang]) return savedLang;

        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.split('-')[0].toLowerCase();

        if (langCode === 'ru' || langCode === 'uk' || langCode === 'be') return 'ru';
        if (langCode === 'ar') return 'ar';
        if (langCode === 'zh') return 'zh';
        return 'en';
    }

    let currentLang = detectLanguage();

    // Initialize language dropdown
    function initLanguageDropdown() {
        const langSwitcher = document.querySelector('.lang-switcher');
        if (!langSwitcher) return;

        langSwitcher.innerHTML = `
            <button class="lang-dropdown-btn" aria-label="Select language" aria-expanded="false">
                <span class="current-lang-flag">${LANGUAGES[currentLang].flag}</span>
                <span class="current-lang-code">${currentLang.toUpperCase()}</span>
                <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="lang-dropdown-menu" role="menu">
                ${Object.entries(LANGUAGES).map(([code, lang]) => `
                    <button class="lang-option ${code === currentLang ? 'active' : ''}" data-lang="${code}" role="menuitem">
                        <span class="lang-flag">${lang.flag}</span>
                        <span class="lang-name">${lang.name}</span>
                        <span class="lang-code">${code.toUpperCase()}</span>
                    </button>
                `).join('')}
            </div>
        `;

        const dropdownBtn = langSwitcher.querySelector('.lang-dropdown-btn');
        const dropdownMenu = langSwitcher.querySelector('.lang-dropdown-menu');

        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = langSwitcher.classList.toggle('open');
            dropdownBtn.setAttribute('aria-expanded', isOpen);
        });

        document.addEventListener('click', () => {
            langSwitcher.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
        });

        dropdownMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.lang-option');
            if (!option) return;

            const lang = option.dataset.lang;
            if (lang === currentLang) return;

            langSwitcher.querySelectorAll('.lang-option').forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            langSwitcher.querySelector('.current-lang-flag').textContent = LANGUAGES[lang].flag;
            langSwitcher.querySelector('.current-lang-code').textContent = lang.toUpperCase();
            langSwitcher.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');

            currentLang = lang;
            localStorage.setItem('edgefocus-lang', lang);
            updateLanguage(lang);
        });
    }

    function updateLanguage(lang) {
        const elements = document.querySelectorAll('[data-en]');
        elements.forEach(el => {
            const text = el.dataset[lang] || el.dataset.en;
            if (text) {
                el.style.opacity = '0';
                setTimeout(() => {
                    el.textContent = text;
                    el.style.opacity = '1';
                }, 150);
            }
        });

        document.documentElement.lang = lang;
        document.documentElement.dir = LANGUAGES[lang].dir;

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            const baseUrl = 'https://landing.edgefocus.ru';
            canonical.href = lang === 'en' ? baseUrl : `${baseUrl}?lang=${lang}`;
        }

        document.body.classList.toggle('rtl', lang === 'ar');
    }

    // Initialize
    initLanguageDropdown();
    updateLanguage(currentLang);

    // Intersection Observer for scroll animations
    // (.animate-in styles live in styles.css)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll(
        '.problem-card, .feature-card, .market-card, .tech-card, .usecase-card, .vision-item, .section-header'
    ).forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Unified RAF-throttled scroll handler
    const navbar = document.querySelector('.navbar');
    const statValues = document.querySelectorAll('.stat-value');
    const statsSection = document.querySelector('.hero-stats');
    let statsAnimated = false;
    let scrollTicking = false;

    function onScroll() {
        const currentScroll = window.pageYOffset;

        // Navbar
        if (currentScroll > 100) {
            navbar.style.background = 'rgba(11, 15, 26, 0.95)';
            navbar.style.borderBottom = '1px solid rgba(102, 126, 234, 0.2)';
        } else {
            navbar.style.background = 'rgba(11, 15, 26, 0.8)';
            navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
        }

        // Stats animation (runs once)
        if (!statsAnimated && statsSection) {
            const rect = statsSection.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                statsAnimated = true;
                statValues.forEach(stat => {
                    stat.style.animation = 'fadeInUp 0.6s ease forwards';
                });
            }
        }

        scrollTicking = false;
    }

    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            requestAnimationFrame(onScroll);
            scrollTicking = true;
        }
    }, { passive: true });

    onScroll(); // Run once on load

    // RAF-throttled mousemove parallax for gradient orbs
    const orbs = document.querySelectorAll('.gradient-orb');
    let mouseTicking = false;

    window.addEventListener('mousemove', (e) => {
        if (!mouseTicking) {
            requestAnimationFrame(() => {
                const x = e.clientX / window.innerWidth;
                const y = e.clientY / window.innerHeight;
                orbs.forEach((orb, index) => {
                    const speed = (index + 1) * 20;
                    orb.style.transform = `translate(${(x - 0.5) * speed}px, ${(y - 0.5) * speed}px)`;
                });
                mouseTicking = false;
            });
            mouseTicking = true;
        }
    }, { passive: true });

    // Console easter egg
    console.log('%c⚡ EdgeFocus', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #667eea, #764ba2, #ed64a6); -webkit-background-clip: text; color: transparent;');
    console.log('%cYour Edge in Productivity', 'font-size: 14px; color: #667eea;');
    console.log('%cTelegram: @TimothyIvaikin', 'font-size: 12px; color: #a0aec0;');
});
