/**
 * FinaNetwork — Network / Connections (network.js)
 * Discover users, manage connections, handle pending requests.
 * Depends on: app.js
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!isAuthenticated()) return;

  /* ── State ──────────────────────────────────── */
  let currentTab = 'discover';
  const currentUser = getUser();

  /* ══════════════════════════════════════════════
     1. TAB SWITCHING
     ══════════════════════════════════════════════ */
  const tabs = document.querySelectorAll('[data-network-tab]');
  const panels = document.querySelectorAll('.network-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.networkTab;
      currentTab = target;

      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      panels.forEach((p) => {
        p.style.display = p.id === `${target}-panel` ? 'block' : 'none';
      });

      // Load data for the selected tab
      if (target === 'discover') loadDiscover();
      else if (target === 'connections') loadConnections();
      else if (target === 'pending') loadPending();
    });
  });

  /* ══════════════════════════════════════════════
     2. DISCOVER TAB
     ══════════════════════════════════════════════ */
  const searchInput = document.getElementById('user-search');
  const discoverGrid = document.getElementById('discover-grid');

  async function loadDiscover(query = '') {
    if (!discoverGrid) return;

    discoverGrid.innerHTML = '<div class="loading-indicator">Searching…</div>';

    try {
      const url = query ? `/api/users?search=${encodeURIComponent(query)}` : '/api/users';
      const data = await api.get(url);
      const users = Array.isArray(data) ? data : data?.users || [];

      // Filter out current user
      const filtered = users.filter(
        (u) => u._id !== currentUser?._id && u.id !== currentUser?.id
      );

      if (!filtered.length) {
        discoverGrid.innerHTML = '<p class="text-muted text-center" style="padding:40px;">No users found</p>';
        return;
      }

      discoverGrid.innerHTML = filtered
        .map((u) => renderUserCard(u, 'connect'))
        .join('');
    } catch (err) {
      console.error('Discover error:', err);
      discoverGrid.innerHTML = '<p class="text-muted text-center">Failed to load users</p>';
    }
  }

  // Debounced search
  if (searchInput) {
    const debouncedSearch = debounce((val) => loadDiscover(val), 300);
    searchInput.addEventListener('input', () => debouncedSearch(searchInput.value.trim()));
  }

  /* ══════════════════════════════════════════════
     3. MY CONNECTIONS TAB
     ══════════════════════════════════════════════ */
  const connectionsGrid = document.getElementById('connections-grid');

  async function loadConnections() {
    if (!connectionsGrid) return;

    connectionsGrid.innerHTML = '<div class="loading-indicator">Loading…</div>';

    try {
      const data = await api.get('/api/network/connections');
      const connections = Array.isArray(data) ? data : data?.connections || [];

      if (!connections.length) {
        connectionsGrid.innerHTML =
          '<p class="text-muted text-center" style="padding:40px;">No connections yet — discover people to connect with!</p>';
        return;
      }

      connectionsGrid.innerHTML = connections
        .map((c) => {
          // The connection object may have the other user under 'user', 'sender', or 'receiver'
          const user = c.user || c.sender || c.receiver || c;
          return renderUserCard(user, 'connected');
        })
        .join('');
    } catch (err) {
      console.error('Connections error:', err);
      connectionsGrid.innerHTML = '<p class="text-muted text-center">Failed to load connections</p>';
    }
  }

  /* ══════════════════════════════════════════════
     4. PENDING TAB
     ══════════════════════════════════════════════ */
  const pendingGrid = document.getElementById('pending-grid');

  async function loadPending() {
    if (!pendingGrid) return;

    pendingGrid.innerHTML = '<div class="loading-indicator">Loading…</div>';

    try {
      const data = await api.get('/api/network/pending');
      const pending = Array.isArray(data) ? data : data?.pending || [];

      if (!pending.length) {
        pendingGrid.innerHTML =
          '<p class="text-muted text-center" style="padding:40px;">No pending requests</p>';
        return;
      }

      pendingGrid.innerHTML = pending
        .map((p) => {
          const user = p.sender || p.user || p;
          const requestId = p._id || p.id || '';
          return renderUserCard(user, 'pending', requestId);
        })
        .join('');
    } catch (err) {
      console.error('Pending error:', err);
      pendingGrid.innerHTML = '<p class="text-muted text-center">Failed to load pending requests</p>';
    }
  }

  /* ══════════════════════════════════════════════
     5. USER CARD RENDERER
     ══════════════════════════════════════════════ */
  function renderUserCard(user, mode = 'connect', requestId = '') {
    const name = user.name || 'Unknown User';
    const title = user.title || user.bio || '';
    const initials = getInitials(name);
    const bgColor = avatarColor(name);
    const userId = user._id || user.id || '';

    let actionHTML = '';

    if (mode === 'connect') {
      actionHTML = `
        <button class="btn btn-primary btn-sm connect-btn" data-user-id="${userId}">
          <span>+ Connect</span>
        </button>`;
    } else if (mode === 'pending') {
      actionHTML = `
        <div class="pending-actions">
          <button class="btn btn-success btn-sm accept-btn" data-request-id="${requestId}">
            ✓ Accept
          </button>
          <button class="btn btn-outline btn-sm decline-btn" data-request-id="${requestId}">
            ✕ Decline
          </button>
        </div>`;
    } else if (mode === 'connected') {
      actionHTML = `<span class="badge badge-success">Connected</span>`;
    }

    return `
      <div class="user-card" data-user-id="${userId}">
        <div class="user-avatar" style="background-color:${bgColor}">
          ${initials}
        </div>
        <div class="user-info">
          <h4 class="user-name">${escapeHtml(name)}</h4>
          ${title ? `<p class="user-title text-muted">${escapeHtml(title)}</p>` : ''}
        </div>
        <div class="user-actions">
          ${actionHTML}
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════
     6. ACTION HANDLERS (Event Delegation)
     ══════════════════════════════════════════════ */

  // Connect
  document.addEventListener('click', async (e) => {
    const connectBtn = e.target.closest('.connect-btn');
    if (!connectBtn) return;

    const userId = connectBtn.dataset.userId;
    if (!userId) return;

    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span>Sending…</span>';

    try {
      await api.post('/api/network/connect', { receiver_id: userId });
      showToast('Connection request sent!', 'success');
      connectBtn.innerHTML = '<span>Pending</span>';
      connectBtn.classList.remove('btn-primary');
      connectBtn.classList.add('btn-outline');
    } catch (err) {
      showToast(err.message || 'Failed to send request', 'error');
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<span>+ Connect</span>';
    }
  });

  // Accept
  document.addEventListener('click', async (e) => {
    const acceptBtn = e.target.closest('.accept-btn');
    if (!acceptBtn) return;

    const requestId = acceptBtn.dataset.requestId;
    if (!requestId) return;

    acceptBtn.disabled = true;

    try {
      await api.put(`/api/network/respond/${requestId}`, { status: 'accepted' });
      showToast('Connection accepted!', 'success');

      // Remove card from pending
      const card = acceptBtn.closest('.user-card');
      if (card) {
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.remove(), 300);
      }
    } catch (err) {
      showToast(err.message || 'Failed to accept', 'error');
      acceptBtn.disabled = false;
    }
  });

  // Decline
  document.addEventListener('click', async (e) => {
    const declineBtn = e.target.closest('.decline-btn');
    if (!declineBtn) return;

    const requestId = declineBtn.dataset.requestId;
    if (!requestId) return;

    declineBtn.disabled = true;

    try {
      await api.put(`/api/network/respond/${requestId}`, { status: 'rejected' });
      showToast('Request declined', 'info');

      const card = declineBtn.closest('.user-card');
      if (card) {
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.remove(), 300);
      }
    } catch (err) {
      showToast(err.message || 'Failed to decline', 'error');
      declineBtn.disabled = false;
    }
  });

  /* ══════════════════════════════════════════════
     7. HTML ESCAPING
     ══════════════════════════════════════════════ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ══════════════════════════════════════════════
     8. INIT — Load default tab
     ══════════════════════════════════════════════ */
  loadDiscover();
});
