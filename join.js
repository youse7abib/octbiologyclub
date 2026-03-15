/* ============================================================
   JOIN PAGE – Application Form Logic & Firebase Integration
   ============================================================ */

import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ======= CONFIG =======
// SET YOUR APPLICATION DEADLINE HERE (UTC)
// Format: new Date('YYYY-MM-DDTHH:mm:ssZ')
// Example: new Date('2026-02-15T23:59:59Z') = February 15, 2026 at 11:59 PM UTC
const APPLICATION_DEADLINE = new Date('2026-02-15T23:59:59Z');

// ======= APPLICATION STATUS CHECK =======
function isApplicationOpen() {
  const now = new Date();
  return now < APPLICATION_DEADLINE;
}

function getTimeRemaining() {
  const now = new Date();
  const diff = APPLICATION_DEADLINE - now;
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes };
}

// ======= DOM ELEMENTS =======
const joinFormSection = document.querySelector('.join-form-section');
const formCard = document.querySelector('.join-form-card');
const heroSection = document.querySelector('.join-hero__eyebrow');

// ======= INITIALIZE PAGE =======
document.addEventListener('DOMContentLoaded', () => {
  if (!isApplicationOpen()) {
    showApplicationClosed();
  } else {
    initializeForm();
  }
});

// ======= SHOW CLOSED MESSAGE =======
function showApplicationClosed() {
  // Hide the form section content
  if (formCard) formCard.style.display = 'none';
  
  // Update hero eyebrow
  if (heroSection) {
    heroSection.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Applications Closed
    `;
    heroSection.style.background = 'rgba(220, 38, 38, 0.15)';
    heroSection.style.borderColor = 'rgba(220, 38, 38, 0.4)';
    heroSection.style.color = '#dc2626';
  }
  
  // Create closed message
  const closedMessage = document.createElement('div');
  closedMessage.className = 'application-closed-message reveal';
  closedMessage.innerHTML = `
    <div class="closed-message__content">
      <div class="closed-message__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h2>Applications Are Currently Closed</h2>
      <p>Thank you for your interest in the Biology Club! Unfortunately, the application period has ended. We will open applications again next season.</p>
      <p class="closed-message__sub">Please check back soon or join our mailing list for updates.</p>
      <a href="index.html" class="closed-message__btn">← Back to Home</a>
    </div>
  `;
  
  if (joinFormSection) {
    joinFormSection.innerHTML = '';
    joinFormSection.appendChild(closedMessage);
  }
}

// ======= FORM INITIALIZATION =======
function initializeForm() {
  // Set up form step navigation
  setupFormNavigation();
  
  // Set up form submission
  setupFormSubmission();
  
  // Set up branch checkbox interaction
  setupBranchChips();
}

// ======= FORM NAVIGATION LOGIC =======
function setupFormNavigation() {
  const nextBtn1 = document.getElementById('nextBtn1');
  const nextBtn2 = document.getElementById('nextBtn2');
  const backBtn2 = document.getElementById('backBtn2');
  const backBtn3 = document.getElementById('backBtn3');
  const progress = document.getElementById('joinProgress');
  
  if (nextBtn1) {
    nextBtn1.addEventListener('click', () => {
      if (validateStep1()) {
        goToStep(2);
      }
    });
  }
  
  if (nextBtn2) {
    nextBtn2.addEventListener('click', () => {
      if (validateStep2()) {
        goToStep(3);
      }
    });
  }
  
  if (backBtn2) {
    backBtn2.addEventListener('click', () => goToStep(1));
  }
  
  if (backBtn3) {
    backBtn3.addEventListener('click', () => goToStep(2));
  }
}

function goToStep(step) {
  // Hide all steps
  document.querySelectorAll('.join-step').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show target step
  document.getElementById(`step${step}`).classList.add('active');
  
  // Update progress
  document.querySelectorAll('.join-progress__step').forEach((el, idx) => {
    el.classList.remove('active', 'completed');
    if (idx < step - 1) {
      el.classList.add('completed');
    } else if (idx === step - 1) {
      el.classList.add('active');
    }
  });
  
  // Update form title
  const titles = {
    1: 'Personal Information',
    2: 'Academic Background',
    3: 'Interests & Motivation'
  };
  const subs = {
    1: 'Tell us who you are — step 1 of 3',
    2: 'Let us know about your academic journey — step 2 of 3',
    3: 'Share your passion and interests — step 3 of 3'
  };
  
  document.getElementById('formTitle').textContent = titles[step];
  document.getElementById('formSub').textContent = subs[step];
  
  // Scroll to form
  setTimeout(() => {
    document.querySelector('.join-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ======= VALIDATION FUNCTIONS =======
function validateStep1() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const dob = document.getElementById('dob').value;
  
  if (!firstName || !lastName || !email || !phone || !dob) {
    showError('Please fill in all required fields');
    return false;
  }
  
  // Simple email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email address');
    return false;
  }
  
  return true;
}

function validateStep2() {
  const grade = document.getElementById('grade').value;
  
  if (!grade) {
    showError('Please select your grade/year');
    return false;
  }
  
  return true;
}

function validateStep3() {
  const selectedBranches = document.querySelectorAll('.branch-chip.checked input[type="checkbox"]');
  const motivation = document.getElementById('motivation').value.trim();
  
  if (selectedBranches.length === 0) {
    showError('Please select at least one branch of biology');
    return false;
  }
  
  if (!motivation) {
    showError('Please tell us why you want to join');
    return false;
  }
  
  return true;
}

// ======= BRANCH CHIP INTERACTION =======
function setupBranchChips() {
  document.querySelectorAll('.branch-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const checkbox = chip.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      chip.classList.toggle('checked', checkbox.checked);
    });
  });
}

// ======= FORM SUBMISSION =======
function setupFormSubmission() {
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');
  
  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      if (!validateStep3()) return;
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      try {
        const applicationData = collectFormData();
        const docRef = await addDoc(collection(db, 'applications'), {
          ...applicationData,
          submittedAt: serverTimestamp(),
          status: 'pending'
        });
        
        // Generate reference number
        const refNumber = `BIO-${new Date().getFullYear()}-${docRef.id.substring(0, 8).toUpperCase()}`;
        document.getElementById('successRef').textContent = `Application #${refNumber}`;
        
        // Show success screen
        document.getElementById('step3').classList.remove('active');
        document.getElementById('joinSuccess').classList.add('active');
        
        // Save ref to local storage for later reference
        localStorage.setItem(`bio_app_${docRef.id}`, refNumber);
        
      } catch (error) {
        console.error('Error submitting application:', error);
        showError('Failed to submit application. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
      }
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetForm();
      goToStep(1);
      document.getElementById('joinSuccess').classList.remove('active');
      document.getElementById('step1').classList.add('active');
    });
  }
}

function collectFormData() {
  const selectedBranches = Array.from(
    document.querySelectorAll('.branch-chip.checked input[type="checkbox"]')
  ).map(cb => cb.value);
  
  return {
    // Step 1: Personal
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    dateOfBirth: document.getElementById('dob').value,
    gender: document.getElementById('gender').value,
    
    // Step 2: Academic
    grade: document.getElementById('grade').value,
    gpa: document.getElementById('gpa').value.trim(),
    section: document.getElementById('section').value.trim(),
    experience: document.getElementById('experience').value,
    competitions: document.getElementById('competitions').value,
    language: document.getElementById('language').value,
    
    // Step 3: Interests
    preferredBranches: selectedBranches,
    programInterest: document.getElementById('programInterest').value,
    motivation: document.getElementById('motivation').value.trim(),
    additionalInfo: document.getElementById('extra').value.trim()
  };
}

function resetForm() {
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="date"], textarea, select').forEach(field => {
    field.value = '';
  });
  
  document.querySelectorAll('.branch-chip').forEach(chip => {
    chip.classList.remove('checked');
    chip.querySelector('input[type="checkbox"]').checked = false;
  });
}

// ======= ERROR TOAST =======
function showError(message) {
  let toast = document.querySelector('.join-toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'join-toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ======= REVEAL ANIMATION OBSERVER =======
const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || '0';
        entry.target.style.animationDelay = `${delay}ms`;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}
