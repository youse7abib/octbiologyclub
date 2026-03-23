/* ============================================================
   1. NAVBAR – scroll shrink & mobile toggle
   ============================================================ */
// Hamburger toggle
const hamburger = document.getElementById('hamburger');
const navbar = document.getElementById('navbar');
hamburger.addEventListener('click', () => {
  navbar.classList.toggle('menu-open');
});

// Mobile dropdown toggle
document.querySelectorAll('.navbar__mobile-dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    const dropdown = toggle.closest('.navbar__mobile-dropdown');
    dropdown.classList.toggle('active');
  });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Close mobile menu when clicking a link
document.querySelectorAll('.navbar__mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    navbar.classList.remove('menu-open');
  });
});

/* ============================================================
   2. HERO – typing animation + timed reveals
   ============================================================ */
(function () {
  const line1   = document.getElementById('typingLine1');
  const line2   = document.getElementById('typingLine2');
  const subtitle= document.getElementById('heroSubtitle');
  const buttons = document.getElementById('heroButtons');

  const text1 = 'Ignite Your Passion';
  const text2 = 'for Biology';

  function typeText(el, text, onComplete) {
    let i = 0;
    el.classList.add('typing');
    el.textContent = '';
    const interval = setInterval(() => {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
      } else {
        clearInterval(interval);
        el.classList.remove('typing');
        if (onComplete) onComplete();
      }
    }, 50);
  }

  // Start typing after 200 ms delay
  setTimeout(() => {
    typeText(line1, text1, () => {
      // After first line finishes, start second after a short pause
      setTimeout(() => {
        typeText(line2, text2, () => {
          // After second line finishes, fade in subtitle then buttons
          setTimeout(() => { subtitle.classList.add('visible'); }, 300);
          setTimeout(() => { buttons.classList.add('visible'); },  800);
        });
      }, 100);
    });
  }, 200);
})();

/* ============================================================
   3. HERO CANVAS – animated particles with mouse repulsion
   ============================================================ */
(function () {
  const canvas = document.getElementById('heroCanvas');
  const ctx    = canvas.getContext('2d');
  let mouseX   = 0, mouseY = 0;

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  /* Particle class */
  function Particle() {
    this.reset();
  }
  Particle.prototype.reset = function () {
    this.x  = Math.random() * canvas.width;
    this.y  = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 1;
    this.alpha  = Math.random() * 0.5 + 0.3;
  };
  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;

    // Mouse repulsion
    const dx   = this.x - mouseX;
    const dy   = this.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const R    = 150;
    if (dist < R) {
      const angle = Math.atan2(dy, dx);
      const force = (1 - dist / R) * 2;
      this.x += Math.cos(angle) * force;
      this.y += Math.sin(angle) * force;
    }

    // Wrap around edges
    if (this.x < 0)              this.x = canvas.width;
    if (this.x > canvas.width)   this.x = 0;
    if (this.y < 0)              this.y = canvas.height;
    if (this.y > canvas.height)  this.y = 0;
  };
  Particle.prototype.draw = function () {
    ctx.fillStyle = 'rgba(57,176,144,' + this.alpha + ')';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Create particle pool
  const PARTICLE_COUNT = 80;
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  // Draw connection lines between close particles
  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.strokeStyle = 'rgba(57,176,144,' + (0.3 * (1 - dist / 150)) + ')';
          ctx.lineWidth   = 0.8;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  // Main loop
  function animate() {
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ============================================================
   4. SCROLL REVEAL – IntersectionObserver for .reveal elements
      Supports optional [data-delay] for staggered entrance
   ============================================================ */
(function () {
  const reveals = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const delay = parseInt(entry.target.dataset.delay, 10) || 0;
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
})();

/* ============================================================
   5. STAT COUNTER – animate numbers when cards scroll into view
   ============================================================ */
(function () {
  const statNumbers = document.querySelectorAll('.stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);

      const target    = parseInt(entry.target.dataset.target, 10);
      const increment = target / 30;
      let current     = 0;

      const interval = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        entry.target.textContent = Math.floor(current);
      }, 50);
    });
  }, { threshold: 0.1 });

  statNumbers.forEach(el => observer.observe(el));
})();

/* ============================================================
   6. PROGRAM CARDS – set CSS custom property for hover icon color
   ============================================================ */
(function () {
  document.querySelectorAll('.program-card').forEach(card => {
    const color = card.dataset.color;
    if (color) card.style.setProperty('--card-color', color);
  });
})();


/* ============================================================
   8. CONTACT SECTION - Scroll reveal & Form handling
   ============================================================ */
(function () {
  // Scroll reveal
  const contactSection = document.querySelector('[data-contact-section]');
  const contactInner = document.querySelector('.contact-inner');
  
  if (contactSection && contactInner) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          contactInner.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    observer.observe(contactSection);
  }

  // Form handling
  const form = document.getElementById('contactForm');
  const statusDiv = document.getElementById('contactStatus');
  
  if (form && statusDiv) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const formData = new FormData(form);

      const data = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
      };

      emailjs.send("service_7gwh9pf", "template_7ufv0gk", data)
        .then(function () {
          statusDiv.textContent = "✅ Message sent to Biology Club!";
          statusDiv.className = "contact-status success show";
          form.reset();

          setTimeout(() => {
            statusDiv.classList.remove("show");
          }, 4000);
        })
        .catch(function (error) {
          statusDiv.textContent = "❌ Failed to send message.";
          statusDiv.className = "contact-status error show";
          console.log("Error:", error);
        });
    });

  }
})();



/* ============================================================
   9. CONTACT BUTTON - Smooth scroll to contact section
   ============================================================ */
(function () {
  const contactButtons = document.querySelectorAll('.navbar__btn--contact, .btn-contact');
  
  contactButtons.forEach(function (button) {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        const navbar = document.getElementById('navbar');
        const offset = navbar ? navbar.offsetHeight + 16 : 80;
        const targetPosition = contactSection.getBoundingClientRect().top + window.scrollY - offset;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
})();

/* ============================================================
   8. PROGRAM MODALS
   ============================================================ */

// Modal functionality
document.addEventListener('DOMContentLoaded', function() {
  // Get all Learn More buttons
  const learnMoreButtons = document.querySelectorAll('.program-card__cta');
  
  // Modal elements
  const modals = {
    research: document.getElementById('researchModal'),
    bioleague: document.getElementById('bioleagueModal'),
    workshops: document.getElementById('workshopsModal'),
    computational: document.getElementById('computationalModal')
  };
  
  // Open modal function
  function openModal(modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }
  
  // Close modal function
  function closeModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
  }
  
  // Add click event to Learn More buttons
  learnMoreButtons.forEach(button => {
    button.addEventListener('click', function() {
      const card = this.closest('.program-card');
      const titles = card.querySelectorAll('h3');
      const titleText = titles.length ? titles[0].textContent.trim() : '';
      let modalType = '';
      
      if (titleText === 'Research Program') {
        modalType = 'research';
      } else if (titleText === 'BioLeague Competition') {
        modalType = 'bioleague';
      } else if (titleText === 'Hands-on Workshops') {
        modalType = 'workshops';
      } else if (titleText === 'Computational Biology') {
        modalType = 'computational';
      } else if (this.dataset.modal) {
        modalType = this.dataset.modal;
      }

      if (modalType && modals[modalType]) {
        openModal(modals[modalType]);
      }
    });
  });
  
  // Add close functionality to close buttons
  Object.values(modals).forEach(modal => {
    const closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeModal(modal);
      });
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
  
  // Close modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      Object.values(modals).forEach(modal => {
        if (modal.style.display === 'block') {
          closeModal(modal);
        }
      });
    }
  });
  
  // Branch modals functionality
  const branchModals = {
    anatomy: document.getElementById('anatomyModal'),
    genetics: document.getElementById('geneticsModal'),
    biochemistry: document.getElementById('biochemistryModal'),
    ecology: document.getElementById('ecologyModal')
  };
  
  // Add click event to branch "Explore Branch" buttons
  const branchCards = document.querySelectorAll('.branch-card');
  branchCards.forEach(card => {
    const btn = card.querySelector('.branch-card__cta');
    if (btn) {
      btn.addEventListener('click', function() {
        const branchType = card.dataset.branch;
        if (branchType && branchModals[branchType]) {
          openModal(branchModals[branchType]);
        }
      });
    }
  });
  
  // Add close functionality to branch modal close buttons
  Object.values(branchModals).forEach(modal => {
    if (modal) {
      const closeBtn = modal.querySelector('.modal__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          closeModal(modal);
        });
      }
      
      // Close modal when clicking outside
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
    }
  });
});
