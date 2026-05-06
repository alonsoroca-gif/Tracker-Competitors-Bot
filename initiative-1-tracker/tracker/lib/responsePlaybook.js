/**
 * Rule-ordered playbook lines merged into response schema / UI copy.
 */

const fs = require('fs');
const path = require('path');

const PLAYBOOK_PATH = path.join(__dirname, '..', 'config', 'response-playbook.json');

let cache = null;

function loadPlaybook() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(PLAYBOOK_PATH, 'utf8');
    cache = JSON.parse(raw);
  } catch {
    cache = { rules: [], default_line: '' };
  }
  return cache;
}

function resetPlaybookCacheForTests() {
  cache = null;
}

/**
 * First matching rule wins (stable file order).
 * @param {object} gap — gap from buildGapReport
 * @returns {string|null}
 */
function pickPlaybookLine(gap) {
  if (!gap || typeof gap !== 'object') return null;
  const book = loadPlaybook();
  const rules = Array.isArray(book.rules) ? book.rules : [];
  for (const rule of rules) {
    const when = rule.when && typeof rule.when === 'object' ? rule.when : {};
    let ok = true;
    for (const [k, v] of Object.entries(when)) {
      const gv = gap[k];
      if (k === 'our_gap') {
        if (String(gv || '').trim() !== String(v).trim()) ok = false;
      } else if (String(gv || '') !== String(v)) {
        ok = false;
      }
    }
    if (!ok) continue;
    if (rule.move_matches) {
      try {
        const rx = new RegExp(rule.move_matches, 'i');
        const hay = `${gap.competitor_move || ''}\n${gap.competitor_signal || ''}`;
        if (!rx.test(hay)) continue;
      } catch {
        continue;
      }
    }
    if (rule.line && String(rule.line).trim()) return String(rule.line).trim();
  }
  const def = book.default_line && String(book.default_line).trim();
  return def || null;
}

module.exports = { loadPlaybook, pickPlaybookLine, resetPlaybookCacheForTests };
