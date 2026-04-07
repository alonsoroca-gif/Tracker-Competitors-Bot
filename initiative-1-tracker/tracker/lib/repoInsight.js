/**
 * Lightweight keyword scan of Entrata app folders (from app inventory) to ground recommendations in real paths.
 * Read-only; caps files/bytes to stay safe on large monoliths.
 */

const fs = require('fs');
const path = require('path');
const { productKeywordTermsFromMap, getProductVoice, pickVariantByGapId, collectInsightTerms } = require('./productContext');
const { loadIntelFenceConfig } = require('./intelFence');

const SKIP_DIRS = new Set([
  'node_modules',
  'vendor',
  '.git',
  'cache',
  'tmp',
  'temp',
  'logs',
  'coverage',
  'dist',
  'build',
  '.next',
  'Library',
  'bower_components',
]);

const SOURCE_EXT = /\.(php|phtml|inc|js|cjs|mjs|tsx?|jsx|vue|twig)$/i;

const STOP = new Set([
  'that',
  'this',
  'with',
  'from',
  'your',
  'have',
  'been',
  'were',
  'will',
  'their',
  'there',
  'these',
  'those',
  'what',
  'when',
  'where',
  'which',
  'while',
  'about',
  'after',
  'before',
  'being',
  'between',
  'both',
  'each',
  'more',
  'most',
  'some',
  'such',
  'than',
  'then',
  'them',
  'very',
  'just',
  'also',
  'only',
  'into',
  'over',
  'again',
  'further',
  'once',
  'here',
  'competitor',
  'capabilities',
  'positioning',
  'packaging',
  'features',
  'page',
  'pricing',
  'source',
  'noted',
  'activity',
  'user',
  'voices',
  'search',
  'channel',
  'plans',
  'tiers',
]);

/**
 * @param {string} text
 * @param {{ max?: number }} [opts]
 * @returns {string[]}
 */
function extractSearchTerms(text, { max = 12 } = {}) {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[·|,:;'"`()[\]{}]/g, ' ');
  const words = raw.match(/\b[a-z][a-z0-9_-]{3,}\b/g) || [];
  const seen = new Set();
  const out = [];
  for (const w of words) {
    if (STOP.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

function* walkFiles(dir, depth, maxDepth) {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const name = e.name;
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      yield* walkFiles(full, depth + 1, maxDepth);
    } else if (SOURCE_EXT.test(name)) {
      yield full;
    }
  }
}

function scoreFileContent(content, terms, snippetOpts = {}) {
  const maxChars = snippetOpts.maxSnippetChars ?? 160;
  const maxSnipCount = snippetOpts.maxSnippetsPerHit ?? 4;
  const lines = String(content).split('\n');
  let score = 0;
  const matchedTerms = new Set();
  const snippets = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ll = line.toLowerCase();
    for (const t of terms) {
      if (ll.includes(t)) {
        score += 1;
        matchedTerms.add(t);
        if (snippets.length < maxSnipCount) {
          snippets.push({
            line: i + 1,
            term: t,
            text: line.trim().slice(0, maxChars),
          });
        }
      }
    }
  }
  return { score, matched_terms: [...matchedTerms], snippets };
}

/**
 * @param {string} repoRootAbs
 * @param {string[]} terms
 * @param {{ maxDepth?: number, maxFiles?: number, maxFileBytes?: number, maxHits?: number }} [opts]
 */
function scanRepo(repoRootAbs, terms, opts = {}) {
  const fence = loadIntelFenceConfig();
  const maxDepth = opts.maxDepth ?? 10;
  const maxFiles = opts.maxFiles ?? fence.max_repo_scan_files;
  const maxFileBytes = opts.maxFileBytes ?? fence.max_repo_scan_file_bytes;
  const maxHits = opts.maxHits ?? 8;
  const snipOpts = {
    maxSnippetChars: opts.maxSnippetChars ?? fence.max_chars_per_repo_snippet,
    maxSnippetsPerHit: opts.maxSnippetsPerHit ?? fence.max_repo_snippets_per_hit,
  };

  if (!terms.length || !repoRootAbs || !fs.existsSync(repoRootAbs)) return [];

  const hits = [];
  let filesSeen = 0;
  try {
    for (const file of walkFiles(repoRootAbs, 0, maxDepth)) {
      if (filesSeen >= maxFiles) break;
      filesSeen += 1;
      let buf;
      try {
        buf = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      if (buf.length > maxFileBytes) buf = buf.slice(0, maxFileBytes);
      const { score, matched_terms, snippets } = scoreFileContent(buf, terms, snipOpts);
      if (score <= 0) continue;
      hits.push({
        relativePath: path.relative(repoRootAbs, file),
        score,
        matched_terms,
        snippets,
      });
    }
  } catch {
    return [];
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, maxHits);
}

function gapTextBlob(gap) {
  if (!gap || typeof gap !== 'object') return '';
  const fence = loadIntelFenceConfig();
  const maxSig = fence.max_gap_text_blob_chars ?? 900;
  return [
    gap.competitor_move,
    gap.headline,
    gap.description,
    (gap.competitor_signal || '').slice(0, maxSig),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Gap-derived tokens first, then per-product map terms (`config/product-keywords.json`).
 * @param {object} gap
 * @param {string} productId
 * @param {{ gapMax?: number, maxTotal?: number }} [opts]
 * @returns {string[]}
 */
function mergeGapAndProductTerms(gap, productId, opts = {}) {
  const gapMax = opts.gapMax ?? 14;
  const maxTotal = opts.maxTotal ?? 28;
  const blob = gapTextBlob(gap);
  const fromGap = extractSearchTerms(blob, { max: gapMax });
  const fromProduct = productKeywordTermsFromMap(productId);
  const seen = new Set();
  const merged = [];
  for (const t of fromGap) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(t);
  }
  for (const t of fromProduct) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(t);
    if (merged.length >= maxTotal) break;
  }
  return merged;
}

/**
 * @param {object} gap — gap row from buildGapReport
 * @param {object} inventory — getAppInventory(...)
 * @param {string} [productId] — tracker product id (same as gap report)
 * @returns {{ touchpoints: object[], grounding_terms: string[] }}
 */
function getRepoInsightsForGap(gap, inventory, productId = '') {
  const fence = loadIntelFenceConfig();
  const terms = mergeGapAndProductTerms(gap, productId, { gapMax: 14, maxTotal: 28 });
  if (!terms.length) return { touchpoints: [], grounding_terms: [] };

  const artifacts = (inventory && inventory.artifacts) || [];
  const combined = [];

  for (const a of artifacts) {
    const root = a.repo_root;
    if (!root || typeof root !== 'string') continue;
    if (!fs.existsSync(root)) continue;

    const hits = scanRepo(root, terms, {
      maxDepth: 10,
      maxFiles: Math.min(100, fence.max_repo_scan_files),
      maxHits: 6,
    });
    for (const h of hits) {
      combined.push({
        ...h,
        app_label: a.label,
        repo_root: root,
      });
    }
  }

  combined.sort((a, b) => b.score - a.score);
  const cap = fence.max_touchpoints_in_response ?? 10;
  return { touchpoints: combined.slice(0, cap), grounding_terms: terms };
}

/**
 * @param {object} r — response schema row
 * @param {object} gap
 * @param {object[]} insights
 * @param {string} [productId]
 */
function buildRepoAwareRecommendation(r, gap, insights, productId = '') {
  const voice = getProductVoice(productId);
  const dim = gap.dimension || 'features';
  const type = r.response_type || 'match';
  const pool = type === 'match' ? voice.match_focus : voice.differentiate_focus;
  const angle = pickVariantByGapId(gap.gap_id || '', pool);
  const overlap = collectInsightTerms(insights, 5);
  const overlapPhrase = overlap.length ? ` Code overlap: **${overlap.join(', ')}**.` : '';
  const pathList = insights
    .slice(0, 4)
    .map((h) => h.relativePath)
    .join(', ');

  if (!insights.length) {
    const lead =
      angle ||
      (type === 'match'
        ? `Reconcile this move with **${voice.display_name}** in **${dim}** (shipped scope vs story).`
        : `Position **${voice.display_name}** in **${dim}** without copying their narrative wholesale.`);
    const tail =
      ' No repo keyword hits yet—confirm **ENTRATA_MONO_ROOT**, **app-inventory.json**, and **repo_terms** in **product-keywords.json**.';
    const hint = voice.fallback_no_hits ? ` _${voice.fallback_no_hits}_` : '';
    return `${lead}${tail}${hint}`;
  }

  const open = angle ? `${angle} ` : '';
  if (type === 'match') {
    return `${open}**${voice.display_name}** · ${dim}: start in \`${pathList}\`.${overlapPhrase} Use snippets below to decide parity vs defer.`;
  }
  return `${open}**${voice.display_name}** · ${dim}: lead on differentiation; still align facts under \`${pathList}\`.${overlapPhrase}`;
}

module.exports = {
  extractSearchTerms,
  scanRepo,
  mergeGapAndProductTerms,
  getRepoInsightsForGap,
  buildRepoAwareRecommendation,
};
