/* ============================================
   SAMI'S SCENT — Professional Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initScrollReveal();
    initNavbar();
    initMobileMenu();
    initNewsletterForm();
    initSmoothScroll();
});

/* --- Theme Management --- */
function initTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const storedTheme = localStorage.getItem('samis-scent-theme');

    if (storedTheme) {
        html.setAttribute('data-theme', storedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('samis-scent-theme')) {
            html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });

    themeToggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('samis-scent-theme', next);
    });
}

/* --- Scroll Reveal (Subtle, respects reduced motion) --- */
function initScrollReveal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* --- Navbar Scroll Effect --- */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 20) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }, { passive: true });
}

/* --- Mobile Menu --- */
function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');

    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            btn.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

/* --- Newsletter Form (Preserves existing Resend logic) --- */
function initNewsletterForm() {
    const form = document.getElementById('newsletterForm');
    const emailInput = document.getElementById('emailInput');
    const message = document.getElementById('formMessage');
    const btnText = form.querySelector('.btn-text');
    const btnLoader = form.querySelector('.btn-loader');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) return;

        btnText.hidden = true;
        btnLoader.hidden = false;
        message.textContent = '';
        message.className = 'form-message';

        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                message.textContent = 'Welcome to the inner circle. Please check your email.';
                message.classList.add('success');
                emailInput.value = '';
            } else {
                throw new Error(data.detail || 'Subscription failed. Please try again.');
            }
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('error');
        } finally {
            btnText.hidden = false;
            btnLoader.hidden = true;
        }
    });
}

/* --- Smooth Scroll --- */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}
