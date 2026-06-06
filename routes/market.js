'use strict';

const express = require('express');
const marketService = require('../services/marketService');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /api/market/prices — top coins by market cap
// ──────────────────────────────────────────────

router.get('/prices', async (req, res) => {
  try {
    const prices = await marketService.getMarketPrices();
    res.json({ prices, timestamp: Date.now() });
  } catch (err) {
    console.error('[Market] Prices error:', err.message);
    res.status(502).json({ error: 'Unable to fetch market data. Please try again later.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/market/trending — trending coins
// ──────────────────────────────────────────────

router.get('/trending', async (req, res) => {
  try {
    const trending = await marketService.getTrendingCoins();
    res.json({ trending, timestamp: Date.now() });
  } catch (err) {
    console.error('[Market] Trending error:', err.message);
    res.status(502).json({ error: 'Unable to fetch trending data. Please try again later.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/market/chart/:coinId — historical chart
// ──────────────────────────────────────────────

router.get('/chart/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const days = parseInt(req.query.days, 10) || 7;

    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365.' });
    }

    const chart = await marketService.getCoinChart(coinId, days);
    res.json({ chart, coinId, days, timestamp: Date.now() });
  } catch (err) {
    console.error('[Market] Chart error:', err.message);
    res.status(502).json({ error: 'Unable to fetch chart data. Please try again later.' });
  }
});

module.exports = router;
