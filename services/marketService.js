'use strict';

const fetch = require('node-fetch');

const BASE_URL = 'https://api.coingecko.com/api/v3';

// ──────────────────────────────────────────────
// In-memory cache with TTL
// ──────────────────────────────────────────────

const cache = new Map();

/**
 * Get a value from cache if it exists and hasn't expired.
 * @param {string} key
 * @returns {*|null}
 */
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a value in cache with a TTL in milliseconds.
 * @param {string} key
 * @param {*} data
 * @param {number} ttlMs
 */
function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ──────────────────────────────────────────────
// Helper — fetch with timeout & error handling
// ──────────────────────────────────────────────

async function safeFetch(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CoinGecko API error ${res.status}: ${text}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

const CACHE_TTL_PRICES   = 30 * 1000;   // 30 seconds
const CACHE_TTL_TRENDING  = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL_CHART     = 2 * 60 * 1000; // 2 minutes
const CACHE_TTL_SIMPLE    = 30 * 1000;   // 30 seconds

/**
 * Fetch top-20 coins by market cap with sparkline & change percentages.
 */
async function getMarketPrices() {
  const CACHE_KEY = 'market_prices';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const url =
    `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc` +
    `&per_page=20&page=1&sparkline=true&price_change_percentage=1h,24h,7d`;

  const data = await safeFetch(url);
  cacheSet(CACHE_KEY, data, CACHE_TTL_PRICES);
  return data;
}

/**
 * Fetch trending coins (top-7 from CoinGecko search/trending).
 */
async function getTrendingCoins() {
  const CACHE_KEY = 'trending_coins';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const url = `${BASE_URL}/search/trending`;
  const data = await safeFetch(url);
  cacheSet(CACHE_KEY, data, CACHE_TTL_TRENDING);
  return data;
}

/**
 * Fetch historical chart data for a specific coin.
 * @param {string} coinId  e.g. "bitcoin"
 * @param {number} days    e.g. 1, 7, 30, 365
 */
async function getCoinChart(coinId, days = 7) {
  const CACHE_KEY = `chart_${coinId}_${days}`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const url = `${BASE_URL}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`;
  const data = await safeFetch(url);
  cacheSet(CACHE_KEY, data, CACHE_TTL_CHART);
  return data;
}

/**
 * Fetch simple price for one or more coin IDs.
 * @param {string} ids  Comma-separated coin IDs, e.g. "bitcoin,ethereum"
 */
async function getCoinPrice(ids) {
  const CACHE_KEY = `simple_price_${ids}`;
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  const url =
    `${BASE_URL}/simple/price?ids=${encodeURIComponent(ids)}` +
    `&vs_currencies=usd&include_24hr_change=true`;

  const data = await safeFetch(url);
  cacheSet(CACHE_KEY, data, CACHE_TTL_SIMPLE);
  return data;
}

/**
 * Clear the entire cache (useful for testing or forced refresh).
 */
function clearCache() {
  cache.clear();
}

module.exports = {
  getMarketPrices,
  getTrendingCoins,
  getCoinChart,
  getCoinPrice,
  clearCache,
};
