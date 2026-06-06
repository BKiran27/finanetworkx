/**
 * FinaNetwork — Dashboard (dashboard.js)
 * The main hub: real-time market data via Socket.IO, charts,
 * portfolio summary, trending coins, notifications.
 * Depends on: app.js, charts.js
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ──────────────────────────────────────────────
     0. Auth check (redundant safety net — app.js also guards)
     ────────────────────────────────────────────── */
  if (!isAuthenticated()) {
    window.location.href = '/auth.html';
    return;
  }

  /* ══════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════ */
  let socket = null;
  let mainChartRef = null; // { chart, series }
  let portfolioDonut = null;
  let currentChartDays = 7;
  let marketPrices = []; // cached for socket updates

  /* ══════════════════════════════════════════════
     1. SOCKET.IO CONNECTION
     ══════════════════════════════════════════════ */
  function initSocket() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client not loaded');
      return;
    }

    socket = io({
      auth: { token: getToken() },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    // ── Connection lifecycle ─────────────────
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setLiveStatus(true);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      setLiveStatus(false);
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      setLiveStatus(true);
      showToast('Reconnected to live data', 'success', 2000);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setLiveStatus(false);
    });

    // ── Market updates ───────────────────────
    socket.on('market-update', (data) => {
      handleMarketUpdate(data);
    });

    // ── Notifications ────────────────────────
    socket.on('notification', (data) => {
      showToast(data.message || 'New notification', 'info');
      incrementNotificationBadge();
    });

    // ── Portfolio updates ────────────────────
    socket.on('portfolio-update', (data) => {
      if (data) updatePortfolioWidget(data);
    });
  }

  /** Update the live-status indicator dot */
  function setLiveStatus(online) {
    const dot = document.getElementById('live-status');
    if (!dot) return;
    dot.classList.toggle('online', online);
    dot.classList.toggle('offline', !online);
    dot.title = online ? 'Live' : 'Disconnected';
  }

  /* ══════════════════════════════════════════════
     2. MARKET TICKER STRIP
     ══════════════════════════════════════════════ */
  function renderTicker(coins) {
    const strip = document.getElementById('ticker-strip');
    if (!strip || !coins?.length) return;

    strip.innerHTML = coins
      .slice(0, 20)
      .map((c) => {
        const change = c.price_change_percentage_24h ?? 0;
        const cls = change >= 0 ? 'text-green' : 'text-red';
        const sign = change >= 0 ? '+' : '';
        return `
          <div class="ticker-item">
            <span class="ticker-symbol">${(c.symbol || '').toUpperCase()}</span>
            <span class="ticker-price">$${Number(c.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span class="ticker-change ${cls}">${sign}${change.toFixed(2)}%</span>
          </div>`;
      })
      .join('');
  }

  /* ══════════════════════════════════════════════
     3. STAT CARDS
     ══════════════════════════════════════════════ */
  async function loadStatCards() {
    // Portfolio summary
    try {
      const summary = await api.get('/api/portfolio/summary');
      if (summary) {
        setTextContent('stat-total-value', formatCurrency(summary.totalValue ?? 0));
        const changeEl = document.getElementById('stat-24h-change');
        if (changeEl) {
          changeEl.innerHTML = formatPercentage(summary.change24h ?? 0);
        }
        setTextContent('stat-assets-count', summary.assetsCount ?? 0);
      }
    } catch (err) {
      console.error('Portfolio summary error:', err);
    }

    // Connections count
    try {
      const connections = await api.get('/api/network/connections');
      const count = Array.isArray(connections) ? connections.length : connections?.count ?? 0;
      setTextContent('stat-connections', count);
    } catch (err) {
      console.error('Connections count error:', err);
    }
  }

  /* ══════════════════════════════════════════════
     4. MAIN CHART (TradingView Lightweight Charts)
     ══════════════════════════════════════════════ */
  async function loadMainChart(days = 7) {
    currentChartDays = days;
    const container = document.getElementById('main-chart');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="chart-loading">Loading chart…</div>';

    try {
      const raw = await api.get(`/api/market/chart/bitcoin?days=${days}`);
      let chartData = [];

      if (raw && raw.prices && Array.isArray(raw.prices)) {
        // CoinGecko format: [[timestamp, price], ...]
        chartData = raw.prices.map(([ts, val]) => ({
          time: Math.floor(ts / 1000),
          value: val,
        }));
      } else if (Array.isArray(raw)) {
        chartData = raw.map((item) => ({
          time: typeof item.time === 'number' ? item.time : Math.floor(new Date(item.time).getTime() / 1000),
          value: item.value ?? item.price ?? 0,
        }));
      }

      // Sort ascending by time
      chartData.sort((a, b) => a.time - b.time);

      // Remove duplicates (TradingView requires unique timestamps)
      const seen = new Set();
      chartData = chartData.filter((d) => {
        if (seen.has(d.time)) return false;
        seen.add(d.time);
        return true;
      });

      if (mainChartRef) {
        // Update existing chart
        mainChartRef.series.setData(chartData);
        mainChartRef.chart.timeScale().fitContent();
      } else {
        mainChartRef = createMainChart('main-chart', chartData);
      }
    } catch (err) {
      console.error('Chart load error:', err);
      container.innerHTML = '<div class="chart-error">Failed to load chart</div>';
    }
  }

  // Timeframe buttons
  document.querySelectorAll('[data-chart-days]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-chart-days]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadMainChart(parseInt(btn.dataset.chartDays, 10));
    });
  });

  /* ══════════════════════════════════════════════
     5. MARKET PRICES TABLE
     ══════════════════════════════════════════════ */
  async function loadMarketTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;

    try {
      const coins = await api.get('/api/market/prices');
      if (!Array.isArray(coins)) return;

      marketPrices = coins;
      renderMarketTable(coins, tbody);
      renderTicker(coins);
    } catch (err) {
      console.error('Market table error:', err);
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Failed to load market data</td></tr>';
    }
  }

  function renderMarketTable(coins, tbody) {
    tbody.innerHTML = coins
      .slice(0, 50)
      .map((coin, idx) => {
        const change24h = coin.price_change_percentage_24h ?? 0;
        const change7d = coin.price_change_percentage_7d_in_currency ?? 0;
        const cls24 = change24h >= 0 ? 'text-green' : 'text-red';
        const cls7d = change7d >= 0 ? 'text-green' : 'text-red';
        const sparkId = `spark-${coin.id || idx}`;

        return `
          <tr data-coin-id="${coin.id || ''}" class="market-row">
            <td>${coin.market_cap_rank ?? idx + 1}</td>
            <td>
              <div class="coin-name-cell">
                ${coin.image ? `<img src="${coin.image}" alt="${coin.name}" width="24" height="24" loading="lazy">` : ''}
                <div>
                  <span class="coin-name">${coin.name || '—'}</span>
                  <span class="coin-symbol">${(coin.symbol || '').toUpperCase()}</span>
                </div>
              </div>
            </td>
            <td class="price-cell" data-price-for="${coin.id}">$${Number(coin.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="${cls24}">${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%</td>
            <td class="${cls7d}">${change7d >= 0 ? '+' : ''}${change7d.toFixed(2)}%</td>
            <td>$${formatNumber(coin.market_cap || 0)}</td>
            <td><canvas id="${sparkId}" width="120" height="40" class="sparkline-canvas"></canvas></td>
          </tr>`;
      })
      .join('');

    // Draw sparklines
    coins.slice(0, 50).forEach((coin, idx) => {
      const canvas = document.getElementById(`spark-${coin.id || idx}`);
      const sparkData = coin.sparkline_in_7d?.price;
      if (canvas && sparkData) {
        createSparkline(canvas, sparkData);
      }
    });
  }

  /* ── Handle real-time market updates ──────── */
  function handleMarketUpdate(data) {
    if (!data) return;

    const updates = Array.isArray(data) ? data : [data];

    updates.forEach((coin) => {
      const id = coin.id || coin.coin_id;
      if (!id) return;

      // Update price cell in table
      const priceCell = document.querySelector(`[data-price-for="${id}"]`);
      if (priceCell && coin.current_price != null) {
        const oldPrice = parseFloat(priceCell.textContent.replace(/[$,]/g, ''));
        const newPrice = coin.current_price;
        priceCell.textContent = `$${Number(newPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Flash animation
        if (newPrice !== oldPrice) {
          const flashClass = newPrice > oldPrice ? 'flash-green' : 'flash-red';
          priceCell.classList.add(flashClass);
          setTimeout(() => priceCell.classList.remove(flashClass), 600);
        }
      }

      // Update ticker strip price
      const tickerItems = document.querySelectorAll('.ticker-item');
      tickerItems.forEach((item) => {
        const sym = item.querySelector('.ticker-symbol');
        if (sym && sym.textContent === (coin.symbol || '').toUpperCase()) {
          const priceEl = item.querySelector('.ticker-price');
          if (priceEl && coin.current_price != null) {
            priceEl.textContent = `$${Number(coin.current_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      });
    });
  }

  /* ══════════════════════════════════════════════
     6. PORTFOLIO SUMMARY WIDGET
     ══════════════════════════════════════════════ */
  async function loadPortfolioWidget() {
    try {
      const portfolio = await api.get('/api/portfolio');
      if (!portfolio) return;

      const holdings = Array.isArray(portfolio) ? portfolio : portfolio.holdings || [];
      if (!holdings.length) {
        const widget = document.getElementById('portfolio-widget');
        if (widget) widget.innerHTML = '<p class="text-muted text-center">No assets yet</p>';
        return;
      }

      // Donut chart
      const labels = holdings.slice(0, 8).map((h) => h.coin_name || h.symbol || 'Unknown');
      const values = holdings.slice(0, 8).map((h) => h.current_value ?? h.amount * (h.current_price || 0));

      portfolioDonut = createDonutChart('portfolio-donut', labels, values);

      // Top 3 holdings list
      const listEl = document.getElementById('top-holdings');
      if (listEl) {
        listEl.innerHTML = holdings
          .slice(0, 3)
          .map((h) => {
            const val = h.current_value ?? h.amount * (h.current_price || 0);
            return `
              <div class="holding-item">
                <span class="holding-name">${h.coin_name || h.symbol || '—'}</span>
                <span class="holding-value">${formatCurrency(val)}</span>
              </div>`;
          })
          .join('');
      }
    } catch (err) {
      console.error('Portfolio widget error:', err);
    }
  }

  function updatePortfolioWidget(data) {
    // Lightweight update from socket
    setTextContent('stat-total-value', formatCurrency(data.totalValue ?? 0));
    const changeEl = document.getElementById('stat-24h-change');
    if (changeEl) changeEl.innerHTML = formatPercentage(data.change24h ?? 0);
  }

  /* ══════════════════════════════════════════════
     7. TRENDING COINS
     ══════════════════════════════════════════════ */
  async function loadTrending() {
    const container = document.getElementById('trending-list');
    if (!container) return;

    try {
      const data = await api.get('/api/market/trending');
      let coins = [];

      if (data && data.coins) {
        coins = data.coins.slice(0, 5).map((c) => c.item || c);
      } else if (Array.isArray(data)) {
        coins = data.slice(0, 5);
      }

      if (!coins.length) {
        container.innerHTML = '<p class="text-muted">No trending data</p>';
        return;
      }

      container.innerHTML = coins
        .map((c, i) => {
          const price = c.price_btc
            ? `${c.price_btc.toFixed(8)} BTC`
            : c.current_price
              ? formatCurrency(c.current_price)
              : '';
          return `
            <div class="trending-item">
              <span class="trending-rank">#${c.market_cap_rank || i + 1}</span>
              ${c.thumb ? `<img src="${c.thumb}" alt="${c.name}" width="24" height="24">` : ''}
              <span class="trending-name">${c.name || '—'} <small class="text-muted">${(c.symbol || '').toUpperCase()}</small></span>
              <span class="trending-price">${price}</span>
            </div>`;
        })
        .join('');
    } catch (err) {
      console.error('Trending error:', err);
    }
  }

  /* ══════════════════════════════════════════════
     8. NOTIFICATION BELL
     ══════════════════════════════════════════════ */
  const bellBtn = document.getElementById('notification-bell');
  const notifPanel = document.getElementById('notification-panel');

  if (bellBtn) {
    bellBtn.addEventListener('click', () => {
      if (notifPanel) {
        notifPanel.classList.toggle('active');
        if (notifPanel.classList.contains('active')) {
          loadNotifications();
          clearNotificationBadge();
        }
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (notifPanel && !notifPanel.contains(e.target) && !bellBtn.contains(e.target)) {
        notifPanel.classList.remove('active');
      }
    });
  }

  async function loadNotifications() {
    if (!notifPanel) return;
    try {
      const notifs = await api.get('/api/notifications');
      const list = Array.isArray(notifs) ? notifs : notifs?.notifications || [];

      const listEl = notifPanel.querySelector('.notification-list') || notifPanel;
      if (!list.length) {
        listEl.innerHTML = '<p class="text-muted text-center" style="padding:20px;">No notifications</p>';
        return;
      }

      listEl.innerHTML = list
        .slice(0, 15)
        .map(
          (n) => `
          <div class="notification-item ${n.read ? '' : 'unread'}">
            <p class="notification-text">${n.message || n.text || ''}</p>
            <span class="notification-time">${formatTimeAgo(n.created_at || n.date)}</span>
          </div>`
        )
        .join('');
    } catch {
      // Endpoint may not exist — silently ignore
    }
  }

  function incrementNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    const current = parseInt(badge.textContent, 10) || 0;
    badge.textContent = current + 1;
    badge.style.display = 'flex';
  }

  function clearNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
      badge.textContent = '0';
      badge.style.display = 'none';
    }
  }

  /* ══════════════════════════════════════════════
     9. LOADING SKELETON REMOVAL
     ══════════════════════════════════════════════ */
  function removeSkeletons() {
    document.querySelectorAll('.skeleton, .skeleton-line, .skeleton-card').forEach((el) => {
      el.classList.add('skeleton-fade-out');
      setTimeout(() => el.remove(), 300);
    });
  }

  /* ══════════════════════════════════════════════
     10. MOBILE SIDEBAR TOGGLE
     ══════════════════════════════════════════════ */
  const hamburger = document.getElementById('hamburger-menu');
  const sidebar = document.querySelector('.sidebar');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });

    // Close sidebar on overlay click
    document.addEventListener('click', (e) => {
      if (
        sidebar.classList.contains('active') &&
        !sidebar.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        sidebar.classList.remove('active');
      }
    });
  }

  /* ══════════════════════════════════════════════
     11. HELPER
     ══════════════════════════════════════════════ */
  function setTextContent(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ══════════════════════════════════════════════
     12. INJECT FLASH ANIMATION STYLES
     ══════════════════════════════════════════════ */
  if (!document.getElementById('dashboard-flash-styles')) {
    const style = document.createElement('style');
    style.id = 'dashboard-flash-styles';
    style.textContent = `
      .flash-green {
        animation: flashGreen 0.6s ease;
      }
      .flash-red {
        animation: flashRed 0.6s ease;
      }
      @keyframes flashGreen {
        0%   { background-color: rgba(34,197,94,0.3); }
        100% { background-color: transparent; }
      }
      @keyframes flashRed {
        0%   { background-color: rgba(239,68,68,0.3); }
        100% { background-color: transparent; }
      }
      .chart-loading, .chart-error {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 300px;
        color: #9ca3af;
        font-size: 14px;
      }
      .skeleton-fade-out {
        opacity: 0;
        transition: opacity 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════
     13. BOOT SEQUENCE
     ══════════════════════════════════════════════ */
  async function init() {
    try {
      // Fire off all fetches in parallel
      await Promise.allSettled([
        loadStatCards(),
        loadMainChart(currentChartDays),
        loadMarketTable(),
        loadPortfolioWidget(),
        loadTrending(),
      ]);
    } catch (err) {
      console.error('Dashboard init error:', err);
    } finally {
      removeSkeletons();
    }

    // Connect socket after initial data is rendered
    initSocket();
  }

  init();
});
