/**
 * Per-product repo tokens + copy variants for recommendations (`config/product-keywords.json`).
 * Legacy: a product entry may be a bare string[] (treated as repo_terms only).
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'product-keywords.json');
let cache = null;

function loadRaw() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function normalizeMapTerms(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    if (typeof x !== 'string') continue;
    const t = x.trim().toLowerCase().replace(/\s+/g, ' ');
    if (t.length < 2) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * @param {string} productId
 * @returns {object|null}
 */
function getProductConfigRow(productId) {
  const pid = String(productId || '').trim();
  if (!pid || pid.startsWith('_')) return null;
  const map = loadRaw();
  const row = map[pid];
  if (!row) return null;
  if (Array.isArray(row)) return { repo_terms: row };
  if (row && typeof row === 'object') return row;
  return null;
}

/**
 * @param {string} productId
 * @returns {string[]}
 */
function productKeywordTermsFromMap(productId) {
  const row = getProductConfigRow(productId);
  if (!row) return [];
  const terms = row.repo_terms || row.terms;
  if (Array.isArray(terms)) return normalizeMapTerms(terms);
  return [];
}

function titleCaseId(id) {
  const s = String(id || '').trim();
  if (!s) return '';
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Stable pick so the same gap always gets the same angle (until config changes).
 * @param {string} gapId
 * @param {string[]} variants
 * @returns {string}
 */
function pickVariantByGapId(gapId, variants) {
  const list = Array.isArray(variants) ? variants.filter((v) => typeof v === 'string' && v.trim()) : [];
  if (!list.length) return '';
  let h = 0;
  const g = String(gapId || 'gap');
  for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length].trim();
}

/**
 * @param {string} productId
 * @returns {{ display_name: string, match_focus: string[], differentiate_focus: string[], fallback_no_hits: string|null }}
 */
function getProductVoice(productId) {
  const row = getProductConfigRow(productId);
  const id = String(productId || '').trim();
  const display = (row && row.display_name) || titleCaseId(id) || 'This product';
  const match_focus = Array.isArray(row?.match_focus) ? row.match_focus.filter((x) => typeof x === 'string') : [];
  const differentiate_focus = Array.isArray(row?.differentiate_focus)
    ? row.differentiate_focus.filter((x) => typeof x === 'string')
    : [];
  const fallback_no_hits =
    typeof row?.fallback_no_hits === 'string' && row.fallback_no_hits.trim() ? row.fallback_no_hits.trim() : null;
  return {
    display_name: display,
    match_focus,
    differentiate_focus,
    fallback_no_hits,
  };
}

function collectInsightTerms(insights, max = 5) {
  const seen = new Set();
  const out = [];
  for (const h of insights || []) {
    for (const t of h.matched_terms || []) {
      const k = String(t).toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= max) return out;
    }
  }
  return out;
}

module.exports = {
  productKeywordTermsFromMap,
  getProductVoice,
  getProductConfigRow,
  pickVariantByGapId,
  collectInsightTerms,
};
