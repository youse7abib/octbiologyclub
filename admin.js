import { db, auth } from './firebase.js';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';

// Allowed admin emails – you can edit this list later.
const ALLOWED_ADMIN_EMAILS = new Set([
  'yousef7abib2008@gmail.com',
  'webmaster@octbioclub.org',
]);

// Firestore collections
const appsCol = collection(db, 'applications');
const artsCol = collection(db, 'magazine');

// State
let allApps = [];
let allArts = [];
let appFilter = 'all';
let artFilter = 'all';
let confirmCb = null;
let activeDetailId = null;
let activeDetailCol = null;

// DOM helpers
const $ = (id) => document.getElementById(id);
const setText = (id, v) => {
  const el = $(id);
  if (el) el.textContent = v;
};
const esc = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusColor = (s) => {
  const map = {
    pending: '#fbbf24',
    accepted: '#34d399',
    declined: '#f87171',
    reviewing: '#60a5fa',
  };
  return map[s] || '#6b7280';
};

const updateSideBadge = (id, count) => {
  const el = $(id);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? '' : 'none';
};

// Toast
const showToast = (msg, type = 'info') => {
  const icons = { success: '✓', error: '✕', info: 'i' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'i'}</span><span>${msg}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => el.remove(), 260);
  }, 3200);
};

// Login / Auth
const authInstance = getAuth();

const updateAuthUI = (user) => {
  if (user && ALLOWED_ADMIN_EMAILS.has(user.email || '')) {
    $('loginScreen').style.display = 'none';
    $('appLayout').style.display = 'flex';
    $('loginError').classList.remove('show');
    setText('topbarBadge', `Signed in as ${user.email}`);
    loadAll();
  } else {
    $('appLayout').style.display = 'none';
    $('loginScreen').style.display = 'flex';
    const passEl = $('loginPass');
    if (passEl) passEl.value = '';
  }
};

$('loginBtn').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  const err = $('loginError');
  const btn = $('loginBtn');

  err.classList.remove('show');

  if (!email || !pass) {
    err.textContent = 'Please enter email and password.';
    err.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" style="width:1rem;height:1rem;animation:spin .8s linear infinite" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Signing in…';

  try {
    const cred = await signInWithEmailAndPassword(authInstance, email, pass);
    const user = cred.user;
    if (!ALLOWED_ADMIN_EMAILS.has(user.email || '')) {
      await signOut(authInstance);
      throw new Error('This account is not an admin for BioClub.');
    }
    updateAuthUI(user);
  } catch (e) {
    console.error('Login error', e);
    err.textContent =
      e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
        ? 'Incorrect email or password.'
        : e.message || 'Sign-in failed.';
    err.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M15 3h6v18h-6M10 17l5-5-5-5M15 12H3"/></svg> Sign In';
  }
});

$('loginPass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('loginBtn').click();
});

// Logout
$('logoutBtn').addEventListener('click', async () => {
  try {
    await signOut(authInstance);
    updateAuthUI(null);
  } catch (e) {
    showToast('Failed to sign out: ' + e.message, 'error');
  }
});

// Listen to auth changes
onAuthStateChanged(authInstance, (user) => {
  updateAuthUI(user);
});

// Navigation
const showView = (name) => {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document
    .querySelectorAll('.nav-item[data-view]')
    .forEach((n) => n.classList.remove('active'));
  const view = $(`view-${name}`);
  if (view) view.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (nav) nav.classList.add('active');
  const titles = {
    dashboard: 'Dashboard',
    applications: 'Membership Applications',
    articles: 'Article Submissions',
  };
  setText('topbarTitle', titles[name] || name);
};

document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
  el.addEventListener('click', () => {
    const v = el.getAttribute('data-view');
    if (v) showView(v);
  });
});

document.querySelectorAll('[data-jump-view]').forEach((el) => {
  el.addEventListener('click', () => {
    const v = el.getAttribute('data-jump-view');
    if (v) showView(v);
  });
});

// Load data
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Timeout after ${ms / 1000}s — check Firestore Rules allow reads for admins`,
            ),
          ),
        ms,
      ),
    ),
  ]);

const loadApplications = async () => {
  try {
    const snap = await withTimeout(getDocs(appsCol), 8000);
    allApps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allApps.sort((a, b) => {
      const ta = a.submittedAt?.toDate?.()?.getTime() || 0;
      const tb = b.submittedAt?.toDate?.()?.getTime() || 0;
      return tb - ta;
    });
    renderApps();
    updateSideBadge(
      'sideAppBadge',
      allApps.filter((a) => a.status === 'pending').length,
    );
  } catch (e) {
    console.error('Applications load error:', e);
    $('appTableBody').innerHTML =
      `<tr><td colspan="7"><div class="empty-state" style="color:var(--red)">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p><strong>Error loading applications</strong><br><span style="font-size:0.72rem">${esc(
          e.message,
        )}</span></p>
        <p style="font-size:0.7rem;margin-top:0.5rem;color:var(--text-dim)">Check Firestore Rules → allow read for authenticated admins, and open browser console for details.</p>
      </div></td></tr>`;
    showToast('Applications: ' + e.message, 'error');
  }
};

const loadArticles = async () => {
  try {
    const snap = await withTimeout(getDocs(artsCol), 8000);
    allArts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allArts.sort((a, b) => {
      const ta = a.submittedAt?.toDate?.()?.getTime() || 0;
      const tb = b.submittedAt?.toDate?.()?.getTime() || 0;
      return tb - ta;
    });
    renderArts();
    updateSideBadge(
      'sideArtBadge',
      allArts.filter((a) => a.status === 'pending').length,
    );
  } catch (e) {
    console.error('Articles load error:', e);
    $('artTableBody').innerHTML =
      `<tr><td colspan="7"><div class="empty-state" style="color:var(--red)">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p><strong>Error loading articles</strong><br><span style="font-size:0.72rem">${esc(
          e.message,
        )}</span></p>
        <p style="font-size:0.7rem;margin-top:0.5rem;color:var(--text-dim)">Check Firestore Rules → allow read for authenticated admins, and open browser console for details.</p>
      </div></td></tr>`;
    showToast('Articles: ' + e.message, 'error');
  }
};

const loadAll = async () => {
  $('activityFeed').innerHTML =
    '<div class="loading-state"><div class="spinner"></div><span>Connecting to Firestore…</span></div>';
  $('gradeChart').innerHTML =
    '<div class="loading-state" style="padding:1rem"><div class="spinner"></div></div>';
  $('typeChart').innerHTML =
    '<div class="loading-state" style="padding:1rem"><div class="spinner"></div></div>';
  setText('dTotalApps', '…');
  setText('dTotalArts', '…');
  setText('dAccepted', '…');
  setText('dDeclined', '…');
  await Promise.allSettled([loadApplications(), loadArticles()]);
  buildDashboard();
};

$('refreshBtn').addEventListener('click', () => {
  const btn = $('refreshBtn');
  btn.style.opacity = '0.5';
  loadAll().then(() => {
    btn.style.opacity = '';
    showToast('Data refreshed', 'success');
  });
});

// Dashboard / charts
const buildDashboard = () => {
  const totalApps = allApps.length;
  const totalArts = allArts.length;
  const pendingApps = allApps.filter((a) => a.status === 'pending').length;
  const pendingArts = allArts.filter((a) => a.status === 'pending').length;
  const accepted =
    allApps.filter((a) => a.status === 'accepted').length +
    allArts.filter((a) => a.status === 'accepted').length;
  const declined =
    allApps.filter((a) => a.status === 'declined').length +
    allArts.filter((a) => a.status === 'declined').length;

  setText('dTotalApps', totalApps);
  setText('dTotalArts', totalArts);
  setText('dAccepted', accepted);
  setText('dDeclined', declined);
  setText('dPendingApps', `${pendingApps} pending review`);
  setText('dPendingArts', `${pendingArts} pending review`);
  setText('activityTimestamp', 'Updated ' + new Date().toLocaleTimeString());

  // Grade chart (applications)
  const gradeCounts = {};
  allApps.forEach((a) => {
    const g = a.grade || 'Unknown';
    gradeCounts[g] = (gradeCounts[g] || 0) + 1;
  });
  const maxGrade = Math.max(1, ...Object.values(gradeCounts || { 0: 1 }));
  const grades = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1]);
  const gradeColors = ['#39B090', '#1D5858', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa'];
  $('gradeChart').innerHTML = grades.length
    ? grades
        .map(
          ([g, c], i) => `
    <div class="bar-item">
      <div class="bar-label">${g}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(
        (c / maxGrade) *
        100
      ).toFixed(0)}%;background:${gradeColors[i % gradeColors.length]}"></div></div>
      <div class="bar-count">${c}</div>
    </div>`,
        )
        .join('')
    : '<div style="font-size:0.75rem;color:var(--text-dim);padding:0.5rem">No data</div>';

  // Article type chart
  const typeCounts = {};
  allArts.forEach((a) => {
    const t = a.articleType || 'Other';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const maxType = Math.max(1, ...Object.values(typeCounts || { 0: 1 }));
  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const typeColors = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];
  $('typeChart').innerHTML = types.length
    ? types
        .map(
          ([t, c], i) => `
    <div class="bar-item">
      <div class="bar-label">${t}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(
        (c / maxType) *
        100
      ).toFixed(0)}%;background:${typeColors[i % typeColors.length]}"></div></div>
      <div class="bar-count">${c}</div>
    </div>`,
        )
        .join('')
    : '<div style="font-size:0.75rem;color:var(--text-dim);padding:0.5rem">No data</div>';

  // Activity feed
  const items = [
    ...allApps.map((a) => ({ ...a, _type: 'app' })),
    ...allArts.map((a) => ({ ...a, _type: 'art' })),
  ]
    .sort((a, b) => {
      const ta = a.submittedAt?.toDate?.() || new Date(0);
      const tb = b.submittedAt?.toDate?.() || new Date(0);
      return tb - ta;
    })
    .slice(0, 10);

  const feedEl = $('activityFeed');
  if (!items.length) {
    feedEl.innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>No activity yet</p></div>';
    return;
  }

  feedEl.innerHTML = items
    .map((item) => {
      const isApp = item._type === 'app';
      const color = statusColor(item.status);
      const icon = isApp ? '👤' : '📄';
      const name = item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim();
      const action =
        item.status === 'pending'
          ? 'submitted a new'
          : `status changed to <strong>${item.status}</strong> for`;
      const kind = isApp ? 'membership application' : 'article';
      const time = fmtDate(item.submittedAt);
      return `
      <div class="activity-item" data-activity-id="${item.id}" data-activity-type="${item._type}">
        <div class="activity-dot" style="background:${color}22;color:${color}">${icon}</div>
        <div class="activity-content">
          <div class="activity-text"><strong>${esc(name)}</strong> ${action} ${kind}${
            isApp ? '' : ': <em>' + esc(item.title || '') + '</em>'
          }</div>
          <div class="activity-time">${time}</div>
        </div>
        <span class="badge badge--${item.status || 'pending'}"><span class="badge-dot"></span>${
          item.status || 'pending'
        }</span>
      </div>`;
    })
    .join('');

  // Attach click handlers for activity items
  document.querySelectorAll('.activity-item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-activity-id');
      const type = el.getAttribute('data-activity-type');
      if (type === 'app') openAppDetail(id);
      else openArtDetail(id);
    });
  });
};

// Applications table
const renderApps = () => {
  const q = ($('appSearch')?.value || '').toLowerCase();
  const filtered = allApps.filter((a) => {
    const matchFilter = appFilter === 'all' || a.status === appFilter;
    const matchQ =
      !q ||
      (a.fullName || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.grade || '').toLowerCase().includes(q);
    return matchFilter && matchQ;
  });

  const tbody = $('appTableBody');
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No applications found</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((a) => {
      const branchesArray =
        Array.isArray(a.preferredBranches) && a.preferredBranches.length
          ? a.preferredBranches
          : Array.isArray(a.branches)
          ? a.branches
          : [];
      const branchesHtml = branchesArray.length
        ? branchesArray
            .slice(0, 2)
            .map((b) => `<span class="tag">${esc(b)}</span>`)
            .join(' ') +
          (branchesArray.length > 2
            ? `<span class="tag">+${branchesArray.length - 2}</span>`
            : '')
        : '—';
      const name = a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const gpa = a.gpa || a.GPA || '—';
      const submitted = fmtDate(a.submittedAt);
      const status = a.status || 'pending';
      return `
    <tr data-app-id="${a.id}">
      <td>
        <div class="td-name">${esc(name || 'Unnamed')}</div>
        <div class="td-meta">${esc(a.email || '')}</div>
      </td>
      <td>${esc(a.grade || '')}</td>
      <td>${esc(gpa)}</td>
      <td>${branchesHtml}</td>
      <td><span class="badge badge--${status}"><span class="badge-dot"></span>${status}</span></td>
      <td class="td-date">${submitted}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn review" data-quick-status="reviewing" title="Mark Reviewing">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="action-btn accept" data-quick-status="accepted" title="Accept">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="action-btn decline" data-quick-status="declined" title="Decline">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
    })
    .join('');

  // Row click handlers
  tbody.querySelectorAll('tr[data-app-id]').forEach((row) => {
    const id = row.getAttribute('data-app-id');
    row.addEventListener('click', () => openAppDetail(id));
    row.querySelectorAll('[data-quick-status]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const status = btn.getAttribute('data-quick-status');
        quickStatus('applications', id, status);
      });
    });
  });
};

$('appSearch').addEventListener('input', () => renderApps());
document.querySelectorAll('#appFilters .filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('#appFilters .filter-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    appFilter = btn.getAttribute('data-status') || 'all';
    renderApps();
  });
});

// Articles table
const renderArts = () => {
  const q = ($('artSearch')?.value || '').toLowerCase();
  const filtered = allArts.filter((a) => {
    const matchFilter = artFilter === 'all' || a.status === artFilter;
    const matchQ =
      !q ||
      (a.title || '').toLowerCase().includes(q) ||
      (a.fullName || '').toLowerCase().includes(q) ||
      (a.articleType || '').toLowerCase().includes(q);
    return matchFilter && matchQ;
  });

  const tbody = $('artTableBody');
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No articles found</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((a) => {
      const status = a.status || 'pending';
      const name = a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const submitted = fmtDate(a.submittedAt);
      const kws =
        Array.isArray(a.keywords) && a.keywords.length
          ? a.keywords
              .slice(0, 3)
              .map((k) => `<span class="tag">${esc(k)}</span>`)
              .join(' ')
          : '';
      const hasFileIcon = a.manuscriptURL
        ? '<svg title="Has uploaded file" viewBox="0 0 24 24" style="width:0.8rem;height:0.8rem;stroke:var(--accent);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>'
        : '';
      const hasGdocIcon = a.gdocLink
        ? '<svg title="Has Google Doc" viewBox="0 0 24 24" style="width:0.8rem;height:0.8rem;stroke:var(--blue);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
        : '';
      const wc = a.wordCount ? Number(a.wordCount).toLocaleString() : '—';
      return `
    <tr data-art-id="${a.id}">
      <td>
        <div class="td-name" style="display:flex;align-items:center;gap:0.4rem">
          ${esc(a.title || 'Untitled')}
          ${hasFileIcon}
          ${hasGdocIcon}
        </div>
        <div class="td-meta">${kws}</div>
      </td>
      <td>
        <div class="td-name">${esc(name || 'Unnamed')}</div>
        <div class="td-meta">${esc(a.email || '')}</div>
      </td>
      <td>${esc(a.articleType || '')}</td>
      <td>${wc}</td>
      <td><span class="badge badge--${status}"><span class="badge-dot"></span>${status}</span></td>
      <td class="td-date">${submitted}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn review" data-quick-status="reviewing" title="Mark Reviewing">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="action-btn accept" data-quick-status="accepted" title="Accept">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="action-btn decline" data-quick-status="declined" title="Decline">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
    })
    .join('');

  tbody.querySelectorAll('tr[data-art-id]').forEach((row) => {
    const id = row.getAttribute('data-art-id');
    row.addEventListener('click', () => openArtDetail(id));
    row.querySelectorAll('[data-quick-status]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const status = btn.getAttribute('data-quick-status');
        quickStatus('magazine', id, status);
      });
    });
  });
};

$('artSearch').addEventListener('input', () => renderArts());
document.querySelectorAll('#artFilters .filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('#artFilters .filter-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    artFilter = btn.getAttribute('data-status') || 'all';
    renderArts();
  });
});

// Detail helpers
const df = (label, val, full = false, raw = false, isHtml = false) => {
  const v = val == null || val === '' ? '—' : val;
  const display = isHtml ? v : esc(v);
  return `<div class="detail-item${full ? ' full' : ''}">
    <div class="detail-item__label">${label}</div>
    <div class="detail-item__val">${display}</div>
  </div>`;
};

// Detail modals
const openAppDetail = (id) => {
  const app = allApps.find((a) => a.id === id);
  if (!app) return;
  activeDetailId = id;
  activeDetailCol = 'applications';

  $('modalIcon').innerHTML =
    '<div style="width:100%;height:100%;background:rgba(57,176,144,0.12);border-radius:0.65rem;display:flex;align-items:center;justify-content:center;color:var(--accent)"><svg viewBox="0 0 24 24" style="width:1.2rem;height:1.2rem;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
  const name = app.fullName || `${app.firstName || ''} ${app.lastName || ''}`.trim();
  $('modalTitle').textContent = name || 'Applicant';
  $('modalSub').innerHTML = `<span class="badge badge--${app.status || 'pending'}"><span class="badge-dot"></span>${
    app.status || 'pending'
  }</span> &nbsp; BIO-${app.year || new Date().getFullYear()}-${id
    .slice(0, 6)
    .toUpperCase()}`;

  const branchesArray =
    Array.isArray(app.preferredBranches) && app.preferredBranches.length
      ? app.preferredBranches
      : Array.isArray(app.branches)
      ? app.branches
      : [];
  const branches = branchesArray.length ? branchesArray.join(', ') : '—';

  $('modalBody').innerHTML = `
    <div class="detail-grid">
      ${df('Email', app.email)}
      ${df('Phone', app.phone)}
      ${df('Grade', app.grade)}
      ${df('GPA', app.gpa)}
      ${df('Section', app.section)}
      ${df('Gender', app.gender)}
      ${df('Date of Birth', app.dateOfBirth || app.dob)}
      ${df('Language', app.language)}
      ${df('Experience Level', app.experience)}
      ${df('Competitions', app.competitions)}
      ${df('Program Interest', app.programInterest)}
      ${df('Branches of Interest', branches, false, true)}
      ${df('Motivation', app.motivation, true)}
      ${df('Additional Info', app.additionalInfo || app.extra, true)}
      ${df('Submitted', fmtDate(app.submittedAt))}
      ${app.adminNotes ? df('Admin Notes', app.adminNotes, true) : ''}
    </div>
    <div class="notes-label">Admin Notes</div>
    <textarea class="notes-area" id="notesArea" placeholder="Add internal notes about this application…">${app.adminNotes || ''}</textarea>
  `;

  $('modalFooter').innerHTML = `
    <button class="btn btn-ghost" id="detailCloseBtn">Close</button>
    <button class="btn btn-ghost" id="saveNotesBtn">
      <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg>
      Save Notes
    </button>
    <button class="btn btn-blue" id="detailReviewBtn">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Reviewing
    </button>
    <button class="btn btn-red" id="detailDeclineBtn">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Decline
    </button>
    <button class="btn btn-green" id="detailAcceptBtn">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      Accept
    </button>
  `;

  $('detailOverlay').classList.add('open');
  $('detailCloseBtn').addEventListener('click', closeDetail);
  $('saveNotesBtn').addEventListener('click', saveNotes);
  $('detailReviewBtn').addEventListener('click', () => updateStatus('reviewing'));
  $('detailDeclineBtn').addEventListener('click', confirmDecline);
  $('detailAcceptBtn').addEventListener('click', confirmAccept);
};

const openArtDetail = (id) => {
  const art = allArts.find((a) => a.id === id);
  if (!art) return;
  activeDetailId = id;
  activeDetailCol = 'magazine';

  $('modalIcon').innerHTML =
    '<div style="width:100%;height:100%;background:rgba(96,165,250,0.12);border-radius:0.65rem;display:flex;align-items:center;justify-content:center;color:var(--blue)"><svg viewBox="0 0 24 24" style="width:1.2rem;height:1.2rem;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>';
  $('modalTitle').textContent = art.title || 'Untitled Article';
  $('modalSub').innerHTML = `<span class="badge badge--${art.status || 'pending'}"><span class="badge-dot"></span>${
    art.status || 'pending'
  }</span> &nbsp; MAG-${art.year || new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`;

  const coauthorsHtml =
    Array.isArray(art.coauthors) && art.coauthors.length
      ? art.coauthors
          .map((c) => `${c.name}${c.email ? ' (' + c.email + ')' : ''}`)
          .join('; ')
      : '—';

  const manuscriptHtml = (() => {
    if (art.manuscriptURL && art.manuscriptName) {
      const ext = art.manuscriptName.split('.').pop().toLowerCase();
      return `<div class="files-section">
        <div class="files-section-label">Manuscript File</div>
        <div class="file-attachments">
          <a href="${esc(art.manuscriptURL)}" target="_blank" class="file-pill">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${esc(art.manuscriptName)}</span>
            <span class="ext-badge">${esc(ext)}</span>
            <svg viewBox="0 0 24 24" style="margin-left:auto"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>`;
    }
    return '';
  })();

  const figuresHtml = (() => {
    if (Array.isArray(art.figureURLs) && art.figureURLs.length) {
      const pills = art.figureURLs
        .map((url, i) => {
          const name = (art.figureNames && art.figureNames[i]) || `Figure ${i + 1}`;
          const ext = name.split('.').pop().toLowerCase();
          return `<a href="${esc(
            url,
          )}" target="_blank" class="file-pill">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>${esc(name)}</span>
          <span class="ext-badge">${esc(ext)}</span>
          <svg viewBox="0 0 24 24" style="margin-left:auto"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>`;
        })
        .join('');
      return `<div class="files-section">
        <div class="files-section-label">Supporting Figures (${art.figureURLs.length})</div>
        <div class="file-attachments">${pills}</div>
      </div>`;
    }
    return '';
  })();

  const noFilesHtml =
    !art.manuscriptURL && (!art.figureURLs || !art.figureURLs.length) && !art.gdocLink
      ? '<div class="detail-item full"><div class="detail-item__label">Files</div><div class="detail-item__val" style="color:var(--text-dim)">No files uploaded — Google Doc link only, or no file provided.</div></div>'
      : '';

  $('modalBody').innerHTML = `
    <div class="detail-grid">
      ${df('Author', art.fullName || `${art.firstName || ''} ${art.lastName || ''}`.trim())}
      ${df('Email', art.email)}
      ${df('Grade', art.grade)}
      ${df('Branch', art.branch)}
      ${df('Co-Authors', coauthorsHtml, false, true)}
      ${df('Article Type', art.articleType)}
      ${df('Target Issue', art.targetIssue)}
      ${df(
        'Word Count',
        art.wordCount ? Number(art.wordCount).toLocaleString() + ' words' : '—',
      )}
      ${noFilesHtml}
    </div>
    ${
      art.gdocLink
        ? `<div class="files-section" style="margin-bottom:0.75rem"><div class="files-section-label">Google Doc Link</div><a href="${esc(
            art.gdocLink,
          )}" target="_blank" class="file-pill"><svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>Open in Google Docs</span><svg viewBox="0 0 24 24" style="margin-left:auto"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>`
        : ''
    }
    ${manuscriptHtml}
    ${figuresHtml}
    <div class="detail-grid">
      ${df(
        'Keywords',
        Array.isArray(art.keywords) && art.keywords.length
          ? art.keywords.map((k) => `<span class="tag">${esc(k)}</span>`).join(' ')
          : '—',
        false,
        true,
        true,
      )}
      ${df('Abstract', art.abstract, true)}
      ${df('Cover Letter', art.coverLetter, true)}
      ${df('References', art.references, true)}
      ${art.editorNotes ? df('Submitted Notes', art.editorNotes, true) : ''}
      ${df('Submitted', fmtDate(art.submittedAt))}
      ${art.adminNotes ? df('Admin Notes', art.adminNotes, true) : ''}
    </div>
    <div class="notes-label">Admin Notes / Editorial Feedback</div>
    <textarea class="notes-area" id="notesArea" placeholder="Add editorial feedback or internal notes…">${art.adminNotes || ''}</textarea>
  `;

  $('modalFooter').innerHTML = `
    <button class="btn btn-ghost" id="detailCloseBtn">Close</button>
    <button class="btn btn-ghost" id="saveNotesBtn">
      <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 0-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg>
      Save Notes
    </button>
    <button class="btn btn-blue" id="detailReviewBtn">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Reviewing
    </button>
    <button class="btn btn-red" id="detailDeclineBtn">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Decline
    </button>
    <button class="btn btn-green" id="detailAcceptBtn">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      Accept
    </button>
  `;

  $('detailOverlay').classList.add('open');
  $('detailCloseBtn').addEventListener('click', closeDetail);
  $('saveNotesBtn').addEventListener('click', saveNotes);
  $('detailReviewBtn').addEventListener('click', () => updateStatus('reviewing'));
  $('detailDeclineBtn').addEventListener('click', confirmDecline);
  $('detailAcceptBtn').addEventListener('click', confirmAccept);
};

const closeDetail = () => {
  $('detailOverlay').classList.remove('open');
};

$('detailOverlay').addEventListener('click', (e) => {
  if (e.target === $('detailOverlay')) closeDetail();
});

// Save notes
const saveNotes = async () => {
  const notes = $('notesArea').value.trim();
  if (!activeDetailId || !activeDetailCol) return;
  try {
    const ref = doc(db, activeDetailCol, activeDetailId);
    await updateDoc(ref, { adminNotes: notes });
    if (activeDetailCol === 'applications') {
      const a = allApps.find((x) => x.id === activeDetailId);
      if (a) a.adminNotes = notes;
    } else {
      const a = allArts.find((x) => x.id === activeDetailId);
      if (a) a.adminNotes = notes;
    }
    showToast('Notes saved', 'success');
  } catch (e) {
    showToast('Failed to save notes: ' + e.message, 'error');
  }
};

// Status updates
const doStatusUpdate = async (col, id, newStatus) => {
  try {
    const ref = doc(db, col, id);
    await updateDoc(ref, {
      status: newStatus,
      reviewedAt: serverTimestamp(),
    });
    if (col === 'applications') {
      const a = allApps.find((x) => x.id === id);
      if (a) a.status = newStatus;
      renderApps();
      updateSideBadge(
        'sideAppBadge',
        allApps.filter((a) => a.status === 'pending').length,
      );
    } else {
      const a = allArts.find((x) => x.id === id);
      if (a) a.status = newStatus;
      renderArts();
      updateSideBadge(
        'sideArtBadge',
        allArts.filter((a) => a.status === 'pending').length,
      );
    }
    buildDashboard();
    const label = {
      accepted: 'Accepted ✓',
      declined: 'Declined ✗',
      reviewing: 'Marked as Reviewing',
      pending: 'Reset to Pending',
    };
    showToast(
      label[newStatus] || 'Status updated',
      newStatus === 'accepted'
        ? 'success'
        : newStatus === 'declined'
        ? 'error'
        : 'info',
    );
  } catch (e) {
    showToast('Failed to update: ' + e.message, 'error');
  }
};

const updateStatus = async (newStatus) => {
  if (!activeDetailId || !activeDetailCol) return;
  await doStatusUpdate(activeDetailCol, activeDetailId, newStatus);
  const col = activeDetailCol;
  const id = activeDetailId;
  closeDetail();
  setTimeout(() => {
    if (col === 'applications') openAppDetail(id);
    else openArtDetail(id);
  }, 200);
};

const quickStatus = async (col, id, newStatus) => {
  await doStatusUpdate(col, id, newStatus);
};

// Confirm dialogs
const openConfirm = (iconHtml, title, msg, btnClass, cb) => {
  $('confirmIcon').innerHTML = iconHtml;
  setText('confirmTitle', title);
  setText('confirmMsg', msg);
  const btn = $('confirmBtn');
  btn.className = 'btn ' + btnClass;
  btn.textContent = 'Confirm';
  confirmCb = cb;
  $('confirmDialog').classList.add('open');
};

const closeConfirm = () => {
  $('confirmDialog').classList.remove('open');
  confirmCb = null;
};

const runConfirm = () => {
  const cb = confirmCb;
  closeConfirm();
  if (cb) cb();
};

$('confirmBtn').addEventListener('click', runConfirm);
document
  .querySelector('#confirmDialog .btn-ghost')
  .addEventListener('click', closeConfirm);

const confirmAccept = () => {
  openConfirm(
    '<div style="background:var(--green-bg);color:var(--green)"><svg viewBox="0 0 24 24" style="width:1.3rem;height:1.3rem;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg></div>',
    'Accept this submission?',
    'This will mark the submission as accepted and update the database.',
    'btn-green',
    () => updateStatus('accepted'),
  );
};

const confirmDecline = () => {
  openConfirm(
    '<div style="background:var(--red-bg);color:var(--red)"><svg viewBox="0 0 24 24" style="width:1.3rem;height:1.3rem;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>',
    'Decline this submission?',
    'This will mark the submission as declined. You can always reverse this later.',
    'btn-red',
    () => updateStatus('declined'),
  );
};

// Initialize focus on email field
if ($('loginEmail')) {
  $('loginEmail').focus();
}

