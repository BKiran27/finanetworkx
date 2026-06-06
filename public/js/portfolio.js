/**
 * FinaNetwork — Portfolio Management (portfolio.js)
 * Holdings table, allocation donut, performance chart,
 * add/delete assets, real-time value updates.
 * Depends on: app.js, charts.js
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!isAuthenticated()) return;

  /* ── State ──────────────────────────────────── */
  let holdings = [];
  let donutChart = null;
  let perfChart = null;
  let socket = null;

  /* ══════════════════════════════════════════════
     1. LOAD PORTFOLIO DATA
     ══════════════════════════════════════════════ */
  async function loadPortfolio() {
    showLoading(true);
    try {
      const data = await api.get('/api/portfolio');
      holdings = Array.isArray(data) ? data : data?.holdings || [];

      if (!holdings.length) {
        showEmptyState();
        return;
      }

      renderHoldingsTable();
      renderSummaryCards();
      renderAllocationChart();
      renderPerformanceChart();
    } catch (err) {
      console.error('Portfolio load error:', err);
      showToast('Failed to load portfolio', 'error');
    } finally {
      showLoading(false);
    }
  }

  /* ══════════════════════════════════════════════
     2. HOLDINGS TABLE
     ══════════════════════════════════════════════ */
  function renderHoldingsTable() {
    const tbody = document.getElementById('holdings-table-body');
    if (!tbody) return;

    tbody.innerHTML = holdings
      .map((h) => {
        const currentPrice = h.current_price ?? 0;
        const buyPrice = h.buy_price ?? h.purchase_price ?? 0;
        const amount = h.amount ?? h.quantity ?? 0;
        const currentValue = currentPrice * amount;
        const investedValue = buyPrice * amount;
        const pnl = currentValue - investedValue;
        const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
        const pnlClass = pnl >= 0 ? 'text-green' : 'text-red';
        const pnlSign = pnl >= 0 ? '+' : '';

        return `
          <tr data-holding-id="${h._id || h.id || ''}">
            <td>
              <div class="coin-name-cell">
                ${h.coin_image ? `<img src="${h.coin_image}" alt="${h.coin_name}" width="28" height="28">` : ''}
                <div>
                  <span class="coin-name">${h.coin_name || h.symbol || '—'}</span>
                  <span class="coin-symbol">${(h.symbol || h.coin_id || '').toUpperCase()}</span>
                </div>
              </div>
            </td>
            <td>${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
            <td>${formatCurrency(buyPrice)}</td>
            <td>${formatCurrency(currentPrice)}</td>
            <td>${formatCurrency(currentValue)}</td>
            <td class="${pnlClass}">
              ${pnlSign}${formatCurrency(Math.abs(pnl))}
              <br><small>${pnlSign}${pnlPct.toFixed(2)}%</small>
            </td>
            <td>
              <button class="btn btn-sm btn-danger delete-holding-btn" data-id="${h._id || h.id || ''}" title="Remove asset">
                🗑
              </button>
            </td>
          </tr>`;
      })
      .join('');
  }

  /* ══════════════════════════════════════════════
     3. SUMMARY CARDS
     ══════════════════════════════════════════════ */
  function renderSummaryCards() {
    let totalValue = 0;
    let totalInvested = 0;

    holdings.forEach((h) => {
      const currentPrice = h.current_price ?? 0;
      const buyPrice = h.buy_price ?? h.purchase_price ?? 0;
      const amount = h.amount ?? h.quantity ?? 0;
      totalValue += currentPrice * amount;
      totalInvested += buyPrice * amount;
    });

    const totalPnl = totalValue - totalInvested;
    const roi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    setTextContent('port-total-value', formatCurrency(totalValue));
    setTextContent('port-total-invested', formatCurrency(totalInvested));

    const pnlEl = document.getElementById('port-pnl');
    if (pnlEl) {
      const sign = totalPnl >= 0 ? '+' : '';
      pnlEl.textContent = `${sign}${formatCurrency(Math.abs(totalPnl))}`;
      pnlEl.className = totalPnl >= 0 ? 'text-green' : 'text-red';
    }

    const roiEl = document.getElementById('port-roi');
    if (roiEl) {
      roiEl.innerHTML = formatPercentage(roi);
    }
  }

  /* ══════════════════════════════════════════════
     4. ALLOCATION DONUT CHART
     ══════════════════════════════════════════════ */
  function renderAllocationChart() {
    const labels = [];
    const values = [];

    holdings.forEach((h) => {
      const currentPrice = h.current_price ?? 0;
      const amount = h.amount ?? h.quantity ?? 0;
      labels.push(h.coin_name || h.symbol || 'Unknown');
      values.push(currentPrice * amount);
    });

    donutChart = createDonutChart('allocation-chart', labels, values);
  }

  /* ══════════════════════════════════════════════
     5. PERFORMANCE LINE CHART
     ══════════════════════════════════════════════ */
  function renderPerformanceChart() {
    // Generate simple estimated performance from holdings dates
    // In production this would come from a historical endpoint
    const canvas = document.getElementById('performance-chart');
    if (!canvas) return;

    let totalValue = 0;
    holdings.forEach((h) => {
      totalValue += (h.current_price ?? 0) * (h.amount ?? h.quantity ?? 0);
    });

    // Generate 30 data points simulating portfolio growth
    const labels = [];
    const data = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      // Simple simulation: slight random variation leading to current value
      const factor = 0.85 + (0.15 * (30 - i)) / 30 + (Math.random() - 0.5) * 0.05;
      data.push(totalValue * factor);
    }
    // Last data point is the actual total value
    data[data.length - 1] = totalValue;

    perfChart = createLineChart('performance-chart', labels, data, 'Portfolio Value');
  }

  /* ══════════════════════════════════════════════
     6. ADD ASSET MODAL
     ══════════════════════════════════════════════ */
  const addAssetBtn = document.getElementById('add-asset-btn');
  const addAssetForm = document.getElementById('add-asset-form');

  if (addAssetBtn) {
    addAssetBtn.addEventListener('click', () => openModal('add-asset-modal'));
  }

  // Close modal buttons
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.closeModal || btn.closest('.modal, .modal-overlay')?.id;
      if (modalId) closeModal(modalId);
    });
  });

  if (addAssetForm) {
    addAssetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const coinSelect = document.getElementById('asset-coin');
      const coinId = coinSelect?.value?.trim();
      const coinName = coinSelect?.selectedOptions?.[0]?.text?.split(' (')[0] || coinId;
      const symbol = coinSelect?.selectedOptions?.[0]?.dataset?.symbol || '';
      const amount = parseFloat(document.getElementById('asset-amount')?.value);
      const buyPrice = parseFloat(document.getElementById('asset-buy-price')?.value);

      if (!coinId) {
        showToast('Please select a coin', 'warning');
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        showToast('Enter a valid amount', 'warning');
        return;
      }
      if (isNaN(buyPrice) || buyPrice <= 0) {
        showToast('Enter a valid buy price', 'warning');
        return;
      }

      const submitBtn = addAssetForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        await api.post('/api/portfolio', {
          coin_id: coinId,
          coin_name: coinName,
          symbol,
          amount,
          buy_price: buyPrice,
        });

        showToast('Asset added successfully!', 'success');
        closeModal('add-asset-modal');
        addAssetForm.reset();

        // Reload portfolio
        await loadPortfolio();
      } catch (err) {
        showToast(err.message || 'Failed to add asset', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ══════════════════════════════════════════════
     7. DELETE ASSET (Event Delegation)
     ══════════════════════════════════════════════ */
  document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-holding-btn');
    if (!deleteBtn) return;

    const holdingId = deleteBtn.dataset.id;
    if (!holdingId) return;

    if (!confirm('Are you sure you want to remove this asset?')) return;

    deleteBtn.disabled = true;

    try {
      await api.delete(`/api/portfolio/${holdingId}`);
      showToast('Asset removed', 'success');
      await loadPortfolio();
    } catch (err) {
      showToast(err.message || 'Failed to remove asset', 'error');
      deleteBtn.disabled = false;
    }
  });

  /* ══════════════════════════════════════════════
     8. EMPTY STATE
     ══════════════════════════════════════════════ */
  function showEmptyState() {
    const container = document.getElementById('portfolio-content') || document.querySelector('.portfolio-main');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>No Assets Yet</h3>
        <p class="text-muted">Add your first asset to start tracking your portfolio</p>
        <button class="btn btn-primary" onclick="openModal('add-asset-modal')">
          + Add Your First Asset
        </button>
      </div>`;
  }

  /* ══════════════════════════════════════════════
     9. REAL-TIME SOCKET UPDATES
     ══════════════════════════════════════════════ */
  function initSocket() {
    if (typeof io === 'undefined') return;

    socket = io({ auth: { token: getToken() } });

    socket.on('market-update', (data) => {
      if (!data) return;
      const updates = data.prices || (Array.isArray(data) ? data : [data]);

      let changed = false;

      updates.forEach((coin) => {
        holdings.forEach((h) => {
          if (h.coin_id === coin.id || (h.symbol || '').toLowerCase() === (coin.symbol || '').toLowerCase()) {
            h.current_price = coin.current_price;
            changed = true;
          }
        });
      });

      if (changed && holdings.length) {
        renderHoldingsTable();
        renderSummaryCards();
      }
    });
  }

  /* ══════════════════════════════════════════════
     10. HELPERS
     ══════════════════════════════════════════════ */
  function setTextContent(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showLoading(show) {
    const loader = document.getElementById('portfolio-loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  /* ══════════════════════════════════════════════
     11. INIT
     ══════════════════════════════════════════════ */
  loadPortfolio().then(() => initSocket());
});
