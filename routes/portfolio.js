'use strict';

const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const marketService = require('../services/marketService');
const socketService = require('../services/socketService');

const router = express.Router();

// All portfolio routes are protected
router.use(authenticate);

// ──────────────────────────────────────────────
// GET /api/portfolio — user's portfolio with live values
// ──────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const holdings = db
      .prepare('SELECT * FROM portfolios WHERE user_id = ? ORDER BY added_at DESC')
      .all(req.user.id);

    if (holdings.length === 0) {
      return res.json({ holdings: [], totalValue: 0, totalCost: 0, totalChange: 0 });
    }

    // Fetch current prices for all held coins
    const coinIds = [...new Set(holdings.map((h) => h.coin_id))].join(',');
    let prices = {};
    try {
      prices = await marketService.getCoinPrice(coinIds);
    } catch (err) {
      console.error('[Portfolio] Price fetch error:', err.message);
      // Continue with empty prices — holdings still returned
    }

    const enriched = holdings.map((h) => {
      const priceData = prices[h.coin_id] || {};
      const currentPrice = priceData.usd || h.buy_price;
      const change24h = priceData.usd_24h_change || 0;
      const currentValue = h.amount * currentPrice;
      const costBasis = h.amount * h.buy_price;
      const profitLoss = currentValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      return {
        ...h,
        current_price: currentPrice,
        change_24h: change24h,
        current_value: currentValue,
        cost_basis: costBasis,
        profit_loss: profitLoss,
        profit_loss_percent: profitLossPercent,
      };
    });

    const totalValue = enriched.reduce((sum, h) => sum + h.current_value, 0);
    const totalCost = enriched.reduce((sum, h) => sum + h.cost_basis, 0);
    const totalChange = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    res.json({ holdings: enriched, totalValue, totalCost, totalChange });
  } catch (err) {
    console.error('[Portfolio] List error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/portfolio/summary — aggregated overview
// ──────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  try {
    const holdings = db
      .prepare('SELECT * FROM portfolios WHERE user_id = ?')
      .all(req.user.id);

    if (holdings.length === 0) {
      return res.json({
        totalValue: 0,
        totalCost: 0,
        totalChange: 0,
        allocation: [],
        assetCount: 0,
      });
    }

    const coinIds = [...new Set(holdings.map((h) => h.coin_id))].join(',');
    let prices = {};
    try {
      prices = await marketService.getCoinPrice(coinIds);
    } catch (_) { /* graceful degradation */ }

    let totalValue = 0;
    let totalCost = 0;

    const allocationMap = {};

    holdings.forEach((h) => {
      const priceData = prices[h.coin_id] || {};
      const currentPrice = priceData.usd || h.buy_price;
      const value = h.amount * currentPrice;
      const cost = h.amount * h.buy_price;

      totalValue += value;
      totalCost += cost;

      if (!allocationMap[h.coin_id]) {
        allocationMap[h.coin_id] = {
          coin_id: h.coin_id,
          coin_name: h.coin_name,
          symbol: h.symbol,
          value: 0,
        };
      }
      allocationMap[h.coin_id].value += value;
    });

    const allocation = Object.values(allocationMap).map((a) => ({
      ...a,
      percentage: totalValue > 0 ? (a.value / totalValue) * 100 : 0,
    }));

    // Sort allocation descending by percentage
    allocation.sort((a, b) => b.percentage - a.percentage);

    const totalChange = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    res.json({
      totalValue,
      totalCost,
      totalChange,
      allocation,
      assetCount: holdings.length,
    });
  } catch (err) {
    console.error('[Portfolio] Summary error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// POST /api/portfolio — add asset
// ──────────────────────────────────────────────

router.post('/', (req, res) => {
  try {
    const { coin_id, coin_name, symbol, amount, buy_price } = req.body;

    if (!coin_id || !coin_name || !symbol) {
      return res.status(400).json({ error: 'coin_id, coin_name, and symbol are required.' });
    }
    const amt = parseFloat(amount);
    const price = parseFloat(buy_price);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Buy price must be a non-negative number.' });
    }

    const result = db
      .prepare(
        `INSERT INTO portfolios (user_id, coin_id, coin_name, symbol, amount, buy_price)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, coin_id.trim(), coin_name.trim(), symbol.toUpperCase().trim(), amt, price);

    const holding = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(result.lastInsertRowid);

    // Notify via socket
    socketService.portfolioUpdate(req.user.id, { action: 'add', holding });

    res.status(201).json({ message: 'Asset added to portfolio.', holding });
  } catch (err) {
    console.error('[Portfolio] Add error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/portfolio/:id — remove asset
// ──────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  try {
    const holdingId = parseInt(req.params.id, 10);
    if (isNaN(holdingId)) {
      return res.status(400).json({ error: 'Invalid holding ID.' });
    }

    const holding = db
      .prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?')
      .get(holdingId, req.user.id);

    if (!holding) {
      return res.status(404).json({ error: 'Holding not found or not yours.' });
    }

    db.prepare('DELETE FROM portfolios WHERE id = ?').run(holdingId);

    // Notify via socket
    socketService.portfolioUpdate(req.user.id, { action: 'remove', holdingId });

    res.json({ message: 'Asset removed from portfolio.' });
  } catch (err) {
    console.error('[Portfolio] Delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
