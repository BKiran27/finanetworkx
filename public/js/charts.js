/**
 * FinaNetwork — Chart Utilities (charts.js)
 * Reusable helpers for sparklines, TradingView main chart,
 * Chart.js donut & line charts.
 * Depends on: window.LightweightCharts, window.Chart (CDN)
 */

/* ──────────────────────────────────────────────
   Brand colour palette for charts
   ────────────────────────────────────────────── */
const CHART_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

/* ──────────────────────────────────────────────
   1. Sparkline (mini canvas chart)
   ────────────────────────────────────────────── */
/**
 * Draw a tiny sparkline on a <canvas> element.
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} data — array of values
 * @param {string} [color] — line colour (auto green/red if omitted)
 */
function createSparkline(canvas, data, color) {
  if (!canvas || !data || data.length < 2) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width || canvas.offsetWidth || 120;
  const h = canvas.height || canvas.offsetHeight || 40;
  canvas.width = w;
  canvas.height = h;

  // Determine colour from trend if not provided
  if (!color) {
    color = data[data.length - 1] >= data[0] ? '#22c55e' : '#ef4444';
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);

  ctx.clearRect(0, 0, w, h);

  // Gradient fill beneath line
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, color + '40'); // 25% opacity
  gradient.addColorStop(1, color + '00'); // transparent

  // Draw filled area
  ctx.beginPath();
  ctx.moveTo(0, h - ((data[0] - min) / range) * h * 0.85 - h * 0.05);
  for (let i = 1; i < data.length; i++) {
    const x = i * step;
    const y = h - ((data[i] - min) / range) * h * 0.85 - h * 0.05;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  ctx.moveTo(0, h - ((data[0] - min) / range) * h * 0.85 - h * 0.05);
  for (let i = 1; i < data.length; i++) {
    const x = i * step;
    const y = h - ((data[i] - min) / range) * h * 0.85 - h * 0.05;
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/* ──────────────────────────────────────────────
   2. TradingView Lightweight Charts — Main Chart
   ────────────────────────────────────────────── */
/**
 * Create a TradingView Lightweight area chart.
 * @param {string} containerId — DOM id of the chart container
 * @param {Array<{time:string|number, value:number}>} data
 * @param {object} [options]
 * @returns {{ chart, series }} — references for later updates
 */
function createMainChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || typeof LightweightCharts === 'undefined') {
    console.warn('LightweightCharts not available or container missing');
    return null;
  }

  // Clear previous chart
  container.innerHTML = '';

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: options.height || 400,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#9ca3af',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)' },
      horzLines: { color: 'rgba(255,255,255,0.04)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode?.Normal || 0,
      vertLine: {
        color: 'rgba(99,102,241,0.4)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#6366f1',
      },
      horzLine: {
        color: 'rgba(99,102,241,0.4)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#6366f1',
      },
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.08)',
    },
    handleScroll: { vertTouchDrag: false },
    ...options,
  });

  const series = chart.addAreaSeries({
    topColor: 'rgba(99,102,241,0.4)',
    bottomColor: 'rgba(99,102,241,0.02)',
    lineColor: '#6366f1',
    lineWidth: 2,
    crosshairMarkerBackgroundColor: '#6366f1',
    crosshairMarkerBorderColor: '#fff',
    crosshairMarkerRadius: 5,
  });

  if (data && data.length) {
    series.setData(data);
    chart.timeScale().fitContent();
  }

  // Responsive resize
  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({ width: container.clientWidth });
  });
  resizeObserver.observe(container);

  return { chart, series, resizeObserver };
}

/* ──────────────────────────────────────────────
   3. Chart.js Donut Chart
   ────────────────────────────────────────────── */
/**
 * Create a Chart.js doughnut chart.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} data
 * @param {string[]} [colors]
 * @returns {Chart}
 */
function createDonutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas missing');
    return null;
  }

  // Destroy existing chart on the same canvas
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  colors = colors || CHART_COLORS.slice(0, labels.length);

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: 'rgba(15,15,25,0.8)',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#9ca3af',
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,15,25,0.95)',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: $${ctx.parsed.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
    plugins: [
      {
        // Center text plugin
        id: 'centerText',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.font = 'bold 18px Inter, system-ui, sans-serif';
          ctx.fillStyle = '#f9fafb';
          ctx.fillText('$' + formatNumber(total), cx, cy - 8);

          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.fillStyle = '#9ca3af';
          ctx.fillText('Total Value', cx, cy + 14);

          ctx.restore();
        },
      },
    ],
  });

  return chart;
}

/* ──────────────────────────────────────────────
   4. Chart.js Line Chart
   ────────────────────────────────────────────── */
/**
 * Create a Chart.js line chart with gradient fill.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} data
 * @param {string} [label]
 * @param {string} [color]
 * @returns {Chart}
 */
function createLineChart(canvasId, labels, data, label = 'Value', color = '#6366f1') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, color + '00');

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: '#6b7280', maxTicksLimit: 8, font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#6b7280',
            font: { size: 11 },
            callback: (v) => '$' + formatNumber(v),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,15,25,0.95)',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          padding: 12,
        },
      },
    },
  });

  return chart;
}

/* ──────────────────────────────────────────────
   5. Helper — Update chart data with animation
   ────────────────────────────────────────────── */
/**
 * Update a Chart.js chart's first dataset.
 * @param {Chart} chart
 * @param {{ labels?: string[], data: number[] }} newData
 */
function updateChartData(chart, newData) {
  if (!chart) return;
  if (newData.labels) chart.data.labels = newData.labels;
  chart.data.datasets[0].data = newData.data;
  chart.update('default');
}
