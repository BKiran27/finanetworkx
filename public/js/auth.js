/**
 * FinaNetwork — Authentication Page (auth.js)
 * Handles login / register forms, validation, and redirection.
 * Depends on: app.js (api, setToken, setUser, showToast)
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ── Element references ────────────────────── */
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');

  const regName = document.getElementById('register-name');
  const regEmail = document.getElementById('register-email');
  const regPassword = document.getElementById('register-password');
  const regConfirm = document.getElementById('register-confirm');
  const regTitle = document.getElementById('register-title');
  const registerBtn = document.getElementById('register-btn');

  /* ── Tab Switching ─────────────────────────── */
  function switchTab(tab) {
    if (tab === 'login') {
      loginTab && loginTab.classList.add('active');
      registerTab && registerTab.classList.remove('active');
      loginForm && (loginForm.style.display = 'block');
      registerForm && (registerForm.style.display = 'none');
    } else {
      loginTab && loginTab.classList.remove('active');
      registerTab && registerTab.classList.add('active');
      loginForm && (loginForm.style.display = 'none');
      registerForm && (registerForm.style.display = 'block');
    }
  }

  loginTab && loginTab.addEventListener('click', () => switchTab('login'));
  registerTab && registerTab.addEventListener('click', () => switchTab('register'));

  // Also support link-style tab triggers (e.g. "Don't have an account? Register")
  document.querySelectorAll('[data-switch-tab]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(el.dataset.switchTab);
    });
  });

  // Default to login tab, or check hash for register
  if (window.location.hash === '#register') {
    switchTab('register');
  } else {
    switchTab('login');
  }

  /* ── Validation Helpers ────────────────────── */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showFieldError(input, msg) {
    clearFieldError(input);
    input.classList.add('input-error');
    const errEl = document.createElement('span');
    errEl.className = 'field-error';
    errEl.textContent = msg;
    errEl.style.cssText = 'color:#f87171;font-size:12px;margin-top:4px;display:block;';
    input.parentNode.appendChild(errEl);
  }

  function clearFieldError(input) {
    input.classList.remove('input-error');
    const existing = input.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = '<span class="spinner"></span> Please wait…';
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }

  /* ── Real-time Validation ──────────────────── */
  if (loginEmail) {
    loginEmail.addEventListener('input', () => {
      if (loginEmail.value && !EMAIL_RE.test(loginEmail.value)) {
        showFieldError(loginEmail, 'Enter a valid email address');
      } else {
        clearFieldError(loginEmail);
      }
    });
  }

  if (regEmail) {
    regEmail.addEventListener('input', () => {
      if (regEmail.value && !EMAIL_RE.test(regEmail.value)) {
        showFieldError(regEmail, 'Enter a valid email address');
      } else {
        clearFieldError(regEmail);
      }
    });
  }

  if (regPassword) {
    regPassword.addEventListener('input', () => {
      if (regPassword.value && regPassword.value.length < 6) {
        showFieldError(regPassword, 'Password must be at least 6 characters');
      } else {
        clearFieldError(regPassword);
      }
    });
  }

  if (regConfirm) {
    regConfirm.addEventListener('input', () => {
      if (regConfirm.value && regConfirm.value !== regPassword.value) {
        showFieldError(regConfirm, 'Passwords do not match');
      } else {
        clearFieldError(regConfirm);
      }
    });
  }

  /* ── Password Visibility Toggle ────────────── */
  document.querySelectorAll('[data-toggle-password]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.dataset.togglePassword;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.textContent = isPassword ? '🙈' : '👁';
    });
  });

  /* ── Login Handler ─────────────────────────── */
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear previous errors
      [loginEmail, loginPassword].forEach((f) => f && clearFieldError(f));

      const email = (loginEmail?.value || '').trim();
      const password = loginPassword?.value || '';

      // Validate
      let hasError = false;
      if (!email || !EMAIL_RE.test(email)) {
        showFieldError(loginEmail, 'Enter a valid email address');
        hasError = true;
      }
      if (!password) {
        showFieldError(loginPassword, 'Password is required');
        hasError = true;
      }
      if (hasError) return;

      setLoading(loginBtn, true);

      try {
        const data = await api.post('/api/auth/login', { email, password });

        if (data && data.token) {
          setToken(data.token);
          setUser(data.user || { email });
          showToast('Welcome back!', 'success');
          // Small delay so toast is visible
          setTimeout(() => (window.location.href = '/dashboard.html'), 400);
        } else {
          showToast('Login failed — unexpected response.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Login failed', 'error');
        showFieldError(loginPassword, err.message || 'Invalid credentials');
      } finally {
        setLoading(loginBtn, false);
      }
    });
  }

  /* ── Register Handler ──────────────────────── */
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fields = [regName, regEmail, regPassword, regConfirm];
      fields.forEach((f) => f && clearFieldError(f));

      const name = (regName?.value || '').trim();
      const email = (regEmail?.value || '').trim();
      const password = regPassword?.value || '';
      const confirm = regConfirm?.value || '';
      const title = (regTitle?.value || '').trim();

      // Validate
      let hasError = false;

      if (!name) {
        showFieldError(regName, 'Name is required');
        hasError = true;
      }
      if (!email || !EMAIL_RE.test(email)) {
        showFieldError(regEmail, 'Enter a valid email address');
        hasError = true;
      }
      if (password.length < 6) {
        showFieldError(regPassword, 'Password must be at least 6 characters');
        hasError = true;
      }
      if (password !== confirm) {
        showFieldError(regConfirm, 'Passwords do not match');
        hasError = true;
      }
      if (hasError) return;

      setLoading(registerBtn, true);

      try {
        const payload = { name, email, password };
        if (title) payload.title = title;

        const data = await api.post('/api/auth/register', payload);

        if (data && data.token) {
          setToken(data.token);
          setUser(data.user || { name, email });
          showToast('Account created successfully!', 'success');
          setTimeout(() => (window.location.href = '/dashboard.html'), 400);
        } else {
          showToast('Registration failed — unexpected response.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Registration failed', 'error');
      } finally {
        setLoading(registerBtn, false);
      }
    });
  }

  /* ── Social Login handlers (Google & GitHub) ── */
  const googleBtn = document.getElementById('googleAuthBtn');
  const githubBtn = document.getElementById('githubAuthBtn');

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      setLoading(googleBtn, true);
      try {
        const mockEmail = 'google.user@gmail.com';
        const mockName = 'Google User';
        const mockPassword = 'GoogleMockPassword123!';
        
        let data;
        try {
          data = await api.post('/api/auth/login', { email: mockEmail, password: mockPassword });
        } catch {
          data = await api.post('/api/auth/register', { 
            name: mockName, 
            email: mockEmail, 
            password: mockPassword, 
            title: 'Quantitative Trader' 
          });
        }

        if (data && data.token) {
          setToken(data.token);
          setUser(data.user || { name: mockName, email: mockEmail });
          showToast('Logged in with Google!', 'success');
          setTimeout(() => (window.location.href = '/dashboard.html'), 400);
        }
      } catch (err) {
        showToast('Google login failed: ' + err.message, 'error');
      } finally {
        setLoading(googleBtn, false);
      }
    });
  }

  if (githubBtn) {
    githubBtn.addEventListener('click', async () => {
      setLoading(githubBtn, true);
      try {
        const mockEmail = 'github.user@github.com';
        const mockName = 'GitHub Developer';
        const mockPassword = 'GitHubMockPassword123!';
        
        let data;
        try {
          data = await api.post('/api/auth/login', { email: mockEmail, password: mockPassword });
        } catch {
          data = await api.post('/api/auth/register', { 
            name: mockName, 
            email: mockEmail, 
            password: mockPassword, 
            title: 'DeFi Developer' 
          });
        }

        if (data && data.token) {
          setToken(data.token);
          setUser(data.user || { name: mockName, email: mockEmail });
          showToast('Logged in with GitHub!', 'success');
          setTimeout(() => (window.location.href = '/dashboard.html'), 400);
        }
      } catch (err) {
        showToast('GitHub login failed: ' + err.message, 'error');
      } finally {
        setLoading(githubBtn, false);
      }
    });
  }
});
