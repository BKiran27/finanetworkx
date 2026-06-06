/**
 * FinaNetwork — Profile Page (profile.js)
 * View & edit current user profile, display stats.
 * Depends on: app.js
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!isAuthenticated()) return;

  /* ── Element references ────────────────────── */
  const profileAvatar = document.getElementById('profile-avatar');
  const profileName = document.getElementById('profile-name');
  const profileTitle = document.getElementById('profile-title');
  const profileEmail = document.getElementById('profile-email');
  const profileSince = document.getElementById('profile-since');

  const statConnections = document.getElementById('profile-stat-connections');
  const statAssets = document.getElementById('profile-stat-assets');

  const editForm = document.getElementById('edit-profile-form');
  const editNameInput = document.getElementById('edit-name');
  const editTitleInput = document.getElementById('edit-title');
  const editBioInput = document.getElementById('edit-bio');
  const editBtn = document.getElementById('edit-profile-btn');
  const saveBtn = document.getElementById('save-profile-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  const profileView = document.getElementById('profile-view');
  const profileEditView = document.getElementById('profile-edit');

  /* ══════════════════════════════════════════════
     1. LOAD PROFILE
     ══════════════════════════════════════════════ */
  async function loadProfile() {
    try {
      const user = await api.get('/api/auth/me');
      if (!user) return;

      // Update localStorage
      setUser(user);

      renderProfile(user);
      populateEditForm(user);
    } catch (err) {
      console.error('Profile load error:', err);
      showToast('Failed to load profile', 'error');

      // Fall back to cached user
      const cached = getUser();
      if (cached) renderProfile(cached);
    }
  }

  function renderProfile(user) {
    const name = user.name || 'User';

    // Avatar
    if (profileAvatar) {
      profileAvatar.textContent = getInitials(name);
      profileAvatar.style.backgroundColor = avatarColor(name);
    }

    // Text fields
    setText(profileName, name);
    setText(profileTitle, user.title || 'FinaNetwork Member');
    setText(profileEmail, user.email || '');

    // Member since
    if (profileSince && user.createdAt) {
      const d = new Date(user.createdAt);
      setText(profileSince, `Member since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
    } else if (profileSince && user.created_at) {
      const d = new Date(user.created_at);
      setText(profileSince, `Member since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
    }
  }

  function populateEditForm(user) {
    if (editNameInput) editNameInput.value = user.name || '';
    if (editTitleInput) editTitleInput.value = user.title || '';
    if (editBioInput) editBioInput.value = user.bio || '';
  }

  /* ══════════════════════════════════════════════
     2. LOAD STATS
     ══════════════════════════════════════════════ */
  async function loadStats() {
    // Connections count
    try {
      const data = await api.get('/api/network/connections');
      const count = Array.isArray(data) ? data.length : data?.count ?? 0;
      setText(statConnections, count);
    } catch {
      setText(statConnections, '0');
    }

    // Assets count
    try {
      const data = await api.get('/api/portfolio');
      const holdings = Array.isArray(data) ? data : data?.holdings || [];
      setText(statAssets, holdings.length);
    } catch {
      setText(statAssets, '0');
    }
  }

  /* ══════════════════════════════════════════════
     3. EDIT PROFILE
     ══════════════════════════════════════════════ */
  // Toggle to edit mode
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (profileView) profileView.style.display = 'none';
      if (profileEditView) profileEditView.style.display = 'block';
    });
  }

  // Cancel edit
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (profileView) profileView.style.display = 'block';
      if (profileEditView) profileEditView.style.display = 'none';
      // Restore original values
      const user = getUser();
      if (user) populateEditForm(user);
    });
  }

  // Save profile
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = (editNameInput?.value || '').trim();
      const title = (editTitleInput?.value || '').trim();
      const bio = (editBioInput?.value || '').trim();

      if (!name) {
        showToast('Name is required', 'warning');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
      }

      try {
        const updated = await api.put('/api/users/profile', { name, title, bio });

        // Update localStorage
        const user = getUser();
        const merged = { ...user, ...updated, name, title, bio };
        setUser(merged);

        renderProfile(merged);

        // Switch back to view mode
        if (profileView) profileView.style.display = 'block';
        if (profileEditView) profileEditView.style.display = 'none';

        showToast('Profile updated!', 'success');

        // Update nav avatar/name if present
        const navName = document.getElementById('nav-user-name');
        if (navName) navName.textContent = merged.name;
        const navAvatar = document.getElementById('nav-user-avatar');
        if (navAvatar) {
          navAvatar.textContent = getInitials(merged.name);
          navAvatar.style.backgroundColor = avatarColor(merged.name);
        }
      } catch (err) {
        showToast(err.message || 'Failed to update profile', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      }
    });
  }

  /* ══════════════════════════════════════════════
     4. CHANGE PASSWORD (optional section)
     ══════════════════════════════════════════════ */
  const passwordForm = document.getElementById('change-password-form');

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPw = document.getElementById('current-password')?.value || '';
      const newPw = document.getElementById('new-password')?.value || '';
      const confirmPw = document.getElementById('confirm-new-password')?.value || '';

      if (!currentPw) {
        showToast('Enter your current password', 'warning');
        return;
      }
      if (newPw.length < 6) {
        showToast('New password must be at least 6 characters', 'warning');
        return;
      }
      if (newPw !== confirmPw) {
        showToast('Passwords do not match', 'warning');
        return;
      }

      const pwBtn = passwordForm.querySelector('button[type="submit"]');
      if (pwBtn) pwBtn.disabled = true;

      try {
        await api.put('/api/users/password', {
          currentPassword: currentPw,
          newPassword: newPw,
        });
        showToast('Password changed successfully!', 'success');
        passwordForm.reset();
      } catch (err) {
        showToast(err.message || 'Failed to change password', 'error');
      } finally {
        if (pwBtn) pwBtn.disabled = false;
      }
    });
  }

  /* ══════════════════════════════════════════════
     5. LOGOUT BUTTON
     ══════════════════════════════════════════════ */
  const logoutBtn = document.getElementById('profile-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        logout();
      }
    });
  }

  /* ══════════════════════════════════════════════
     6. HELPERS
     ══════════════════════════════════════════════ */
  function setText(el, value) {
    if (el) el.textContent = value;
  }

  /* ══════════════════════════════════════════════
     7. INIT
     ══════════════════════════════════════════════ */
  Promise.allSettled([loadProfile(), loadStats()]);
});
