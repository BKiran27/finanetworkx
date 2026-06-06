/**
 * FinaNetwork — Landing Page Animations (landing.js)
 * Smooth scroll, scroll-triggered animations, animated counters,
 * navbar shadow, and floating particles.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ──────────────────────────────────────────────
     1. Smooth Scroll for Anchor Links
     ────────────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ──────────────────────────────────────────────
     2. Intersection Observer — Fade-In Sections
     ────────────────────────────────────────────── */
  const animatedSections = document.querySelectorAll(
    '.animate-on-scroll, section, .feature-card, .stat-item'
  );

  if (animatedSections.length) {
    // Pre-hide elements
    animatedSections.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    animatedSections.forEach((el) => observer.observe(el));
  }

  /* ──────────────────────────────────────────────
     3. Animated Number Counters
     ────────────────────────────────────────────── */
  const counters = document.querySelectorAll('[data-count]');

  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 2000; // ms
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.floor(eased * target);
      el.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  if (counters.length) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => counterObserver.observe(c));
  }

  /* ──────────────────────────────────────────────
     4. Navbar Scroll Effect (shadow on scroll)
     ────────────────────────────────────────────── */
  const navbar = document.querySelector('.navbar, nav, header');
  if (navbar) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 20) {
            navbar.classList.add('scrolled');
            navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.3)';
          } else {
            navbar.classList.remove('scrolled');
            navbar.style.boxShadow = 'none';
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ──────────────────────────────────────────────
     5. Floating Particle / Shape Animation
     ────────────────────────────────────────────── */
  const heroSection = document.querySelector('.hero, .hero-section, #hero');

  if (heroSection) {
    // Create a particle container
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    Object.assign(particleContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '0',
    });

    // Ensure hero is positioned
    const heroPos = getComputedStyle(heroSection).position;
    if (heroPos === 'static') heroSection.style.position = 'relative';

    heroSection.prepend(particleContainer);

    const PARTICLE_COUNT = 15;
    const colors = [
      'rgba(99,102,241,0.3)',
      'rgba(139,92,246,0.3)',
      'rgba(236,72,153,0.25)',
      'rgba(34,197,94,0.25)',
      'rgba(59,130,246,0.3)',
    ];
    const shapes = ['circle', 'square', 'triangle'];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = document.createElement('div');
      const size = Math.random() * 20 + 8;
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const duration = Math.random() * 15 + 10;
      const delay = Math.random() * -20;

      Object.assign(particle.style, {
        position: 'absolute',
        width: size + 'px',
        height: size + 'px',
        left: x + '%',
        top: y + '%',
        background: shape === 'triangle' ? 'transparent' : color,
        borderRadius: shape === 'circle' ? '50%' : shape === 'square' ? '3px' : '0',
        opacity: '0.6',
        animation: `floatParticle ${duration}s ${delay}s ease-in-out infinite`,
      });

      if (shape === 'triangle') {
        Object.assign(particle.style, {
          width: '0',
          height: '0',
          borderLeft: `${size / 2}px solid transparent`,
          borderRight: `${size / 2}px solid transparent`,
          borderBottom: `${size}px solid ${color}`,
          background: 'transparent',
        });
      }

      particleContainer.appendChild(particle);
    }

    // Inject keyframes if not already present
    if (!document.getElementById('particle-keyframes')) {
      const style = document.createElement('style');
      style.id = 'particle-keyframes';
      style.textContent = `
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25%      { transform: translate(20px, -30px) rotate(90deg); }
          50%      { transform: translate(-15px, -60px) rotate(180deg); }
          75%      { transform: translate(25px, -20px) rotate(270deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* ──────────────────────────────────────────────
     6. Mobile Nav Toggle
     ────────────────────────────────────────────── */
  const hamburger = document.querySelector('.hamburger, .menu-toggle, [data-toggle="nav"]');
  const mobileNav = document.querySelector('.nav-links, .mobile-nav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      mobileNav.classList.toggle('active');
      hamburger.classList.toggle('active');
    });
  }
});
