// Language Switching Functionality
document.addEventListener('DOMContentLoaded', () => {
    const langButtons = document.querySelectorAll('.lang-btn');
    let currentLang = 'en';

    // Language switching
    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            if (lang === currentLang) return;

            // Update button states
            langButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = lang;

            // Update all translatable elements
            updateLanguage(lang);
        });
    });

    function updateLanguage(lang) {
        const elements = document.querySelectorAll('[data-en][data-ru]');
        
        elements.forEach(el => {
            const text = el.dataset[lang];
            if (text) {
                // Animate the transition
                el.style.opacity = '0';
                setTimeout(() => {
                    el.textContent = text;
                    el.style.opacity = '1';
                }, 150);
            }
        });

        // Update HTML lang attribute
        document.documentElement.lang = lang === 'en' ? 'en' : 'ru';
    }

    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe sections and cards for animation
    const animateElements = document.querySelectorAll(
        '.problem-card, .feature-card, .market-card, .tech-card, .usecase-card, .vision-item, .section-header'
    );

    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animation class styles
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.background = 'rgba(11, 15, 26, 0.95)';
            navbar.style.borderBottom = '1px solid rgba(102, 126, 234, 0.2)';
        } else {
            navbar.style.background = 'rgba(11, 15, 26, 0.8)';
            navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
        }
        
        lastScroll = currentScroll;
    });

    // Parallax effect for gradient orbs
    window.addEventListener('mousemove', (e) => {
        const orbs = document.querySelectorAll('.gradient-orb');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        orbs.forEach((orb, index) => {
            const speed = (index + 1) * 20;
            const xOffset = (x - 0.5) * speed;
            const yOffset = (y - 0.5) * speed;
            orb.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });

    // Stats counter animation
    const statValues = document.querySelectorAll('.stat-value');
    let statsAnimated = false;

    const animateStats = () => {
        if (statsAnimated) return;
        
        const statsSection = document.querySelector('.hero-stats');
        const rect = statsSection.getBoundingClientRect();
        
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            statsAnimated = true;
            statValues.forEach(stat => {
                stat.style.animation = 'fadeInUp 0.6s ease forwards';
            });
        }
    };

    window.addEventListener('scroll', animateStats);
    animateStats(); // Check on load

    // Add loading transition
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    window.addEventListener('load', () => {
        document.body.style.opacity = '1';
    });

    // Console easter egg
    console.log('%c⚡ EdgeFocus', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #667eea, #764ba2, #ed64a6); -webkit-background-clip: text; color: transparent;');
    console.log('%cYour Edge in Productivity', 'font-size: 14px; color: #667eea;');
    console.log('%cInterested in investing? Contact: investor@edgefocus.ru', 'font-size: 12px; color: #a0aec0;');
});
