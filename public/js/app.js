/**
 * FinaNetwork — Global Utilities (app.js)
 * Loaded on every page. Provides API client, auth helpers,
 * toast notifications, modals, formatting, and nav guards.
 */

/* ──────────────────────────────────────────────
   1. Constants
   ────────────────────────────────────────────── */
const TOKEN_KEY = 'finanetwork_token';
const USER_KEY = 'finanetwork_user';

// Pages that require authentication
const PROTECTED_PAGES = [
  '/dashboard.html',
  '/portfolio.html',
  '/network.html',
  '/profile.html',
];

/* ──────────────────────────────────────────────
   2. Token / User Management
   ────────────────────────────────────────────── */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem(USER_KEY);
}

function isAuthenticated() {
  return !!getToken();
}

function logout() {
  removeToken();
  removeUser();
  window.location.href = '/auth.html';
}

/* ──────────────────────────────────────────────
   3. API Client
   ────────────────────────────────────────────── */
const api = {
  /**
   * Internal helper — builds headers and handles response.
   */
  async _request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    try {
      const res = await fetch(url, options);

      // Handle 401 — token expired / invalid
      if (res.status === 401) {
        removeToken();
        removeUser();
        window.location.href = '/auth.html';
        return null;
      }

      // Try to parse JSON; fall back to null for 204 / empty body
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!res.ok) {
        const errorMsg =
          (data && (data.message || data.error)) || `Request failed (${res.status})`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      // Network error (offline, DNS, etc.)
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        showToast('Network error — please check your connection.', 'error');
      }
      throw err;
    }
  },

  get(url) {
    return this._request('GET', url);
  },
  post(url, data) {
    return this._request('POST', url, data);
  },
  put(url, data) {
    return this._request('PUT', url, data);
  },
  delete(url) {
    return this._request('DELETE', url);
  },
};

/* ──────────────────────────────────────────────
   4. Toast Notification System
   ────────────────────────────────────────────── */
function _ensureToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    // Position fixed top-right via inline styles (CSS may override)
    Object.assign(container.style, {
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration  — ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = _ensureToastContainer();

  const colorMap = {
    success: { bg: '#059669', icon: '✓' },
    error: { bg: '#dc2626', icon: '✕' },
    info: { bg: '#2563eb', icon: 'ℹ' },
    warning: { bg: '#d97706', icon: '⚠' },
  };
  const { bg, icon } = colorMap[type] || colorMap.info;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  Object.assign(toast.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderRadius: '8px',
    background: bg,
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 20px rgba(0,0,0,.35)',
    pointerEvents: 'auto',
    opacity: '0',
    transform: 'translateX(40px)',
    transition: 'opacity .3s ease, transform .3s ease',
    maxWidth: '380px',
    wordBreak: 'break-word',
  });

  toast.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), duration);

  // Allow click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(40px)';
  setTimeout(() => toast.remove(), 300);
}

/* ──────────────────────────────────────────────
   5. Modal Helpers
   ────────────────────────────────────────────── */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Close on backdrop click
  const backdropHandler = (e) => {
    if (e.target === modal) closeModal(id);
  };
  modal._backdropHandler = backdropHandler;
  modal.addEventListener('click', backdropHandler);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  if (modal._backdropHandler) {
    modal.removeEventListener('click', modal._backdropHandler);
  }
}

// Global escape-key listener for modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal.active, .modal-overlay.active');
    if (activeModal) closeModal(activeModal.id);
  }
});

/* ──────────────────────────────────────────────
   6. Formatting Helpers
   ────────────────────────────────────────────── */
/**
 * Format a number as US-dollar currency: $1,234.56
 */
function formatCurrency(num) {
  if (num == null || isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a percentage with sign and colour class.
 * Returns an HTML string: <span class="text-green">+1.23%</span>
 */
function formatPercentage(num) {
  if (num == null || isNaN(num)) return '<span class="text-muted">0.00%</span>';
  const sign = num >= 0 ? '+' : '';
  const cls = num >= 0 ? 'text-green' : 'text-red';
  return `<span class="${cls}">${sign}${num.toFixed(2)}%</span>`;
}

/**
 * Abbreviate large numbers: 1.2K, 3.4M, 1.2B, 5.6T
 */
function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1e12) return (num / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(num % 1 === 0 ? 0 : 2);
}

/**
 * Human-readable time-ago string.
 */
function formatTimeAgo(date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ──────────────────────────────────────────────
   7. Miscellaneous Helpers
   ────────────────────────────────────────────── */

/**
 * Generate a consistent avatar color from a string (e.g. user name).
 */
function avatarColor(str) {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Get initials from a full name (max 2 chars).
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Debounce helper.
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ──────────────────────────────────────────────
   8. Navigation Guard (DOMContentLoaded)
   ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  // Redirect unauthenticated users away from protected pages
  const isProtected = PROTECTED_PAGES.some(
    (p) => path === p || path.endsWith(p)
  );

  if (isProtected && !isAuthenticated()) {
    window.location.href = '/auth.html';
    return;
  }

  // If user is logged in and visits auth page, send them to dashboard
  if ((path === '/auth.html' || path.endsWith('/auth.html')) && isAuthenticated()) {
    window.location.href = '/dashboard.html';
    return;
  }

  // Wire up any global logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  });

  // Populate user name/avatar in nav if elements exist
  const user = getUser();
  if (user) {
    const nameEl = document.getElementById('nav-user-name');
    if (nameEl) nameEl.textContent = user.name || 'User';

    const avatarEl = document.getElementById('nav-user-avatar');
    if (avatarEl) {
      avatarEl.textContent = getInitials(user.name);
      avatarEl.style.backgroundColor = avatarColor(user.name);
    }
  }
});
