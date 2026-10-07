/* ============================================
   SAMI'S SCENT — Main JavaScript
   Theme Management, Animations, Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initParticles();
    initScrollReveal();
    initNavbar();
    initMobileMenu();
    initNewsletterForm();
    initSmoothScroll();
});

/* ---------- Theme Management ---------- */
function initTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const storedTheme = localStorage.getItem('samis-scent-theme');

    // Apply saved theme or use system preference
    if (storedTheme) {
        html.setAttribute('data-theme', storedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('samis-scent-theme')) {
            html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });

    // Toggle button
    themeToggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('samis-scent-theme', next);
    });
}

/* ---------- Particle Background ---------- */
function initParticles() {
    const container = document.getElementById('particles');
    const particleCount = window.innerWidth < 768 ? 20 : 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const size = Math.random() * 4 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 15 + 10}s`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        particle.style.opacity = Math.random() * 0.5 + 0.2;

        container.appendChild(particle);
    }
}

/* ---------- Scroll Reveal Animation ---------- */
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(el => observer.observe(el));
}

/* ---------- Navbar Scroll Effect ---------- */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            navbar.style.boxShadow = 'var(--shadow-md)';
        } else {
            navbar.style.boxShadow = 'none';
        }

        lastScroll = currentScroll;
    });
}

/* ---------- Mobile Menu ---------- */
function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');

    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            btn.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

/* ---------- Newsletter Form ---------- */
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

        // Show loading
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
                message.textContent = data.message || '🎉 Welcome to Sami\'s Scent family! Check your email.';
                message.classList.add('success');
                emailInput.value = '';
            } else {
                throw new Error(data.detail || 'Something went wrong');
            }
        } catch (error) {
            message.textContent = error.message || '❌ Failed to subscribe. Please try again.';
            message.classList.add('error');
        } finally {
            btnText.hidden = false;
            btnLoader.hidden = true;
        }
    });
}

/* ---------- Smooth Scroll ---------- */
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

/* ---------- CEO Image Tilt Effect ---------- */
const ceoFrame = document.querySelector('.ceo-frame');
if (ceoFrame) {
    ceoFrame.addEventListener('mousemove', (e) => {
        const rect = ceoFrame.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 15;
        const rotateY = (centerX - x) / 15;

        ceoFrame.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    ceoFrame.addEventListener('mouseleave', () => {
        ceoFrame.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        ceoFrame.style.transition = 'transform 0.5s ease';
    });

    ceoFrame.addEventListener('mouseenter', () => {
        ceoFrame.style.transition = 'none';
    });
}
