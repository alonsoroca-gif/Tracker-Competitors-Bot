/**
 * Split a page with multiple titled sections into sub-rows.
 *
 * Used first for changelog / product-release pages (Anyone Home style:
 * H2 = area, H3 = capability). Designed to generalize to features / blogs later.
 *
 * Identity: capability_key = sha1(competitor|url|normalized heading)[:16]
 * so re-crawls dedupe cleanly across drops.
 */

const crypto = require('crypto');
const cheerio = require('cheerio');

const DEFAULT_MAX_SUBROWS = 10;
const MIN_BLURB_CHARS = 40;

const SKIP_HEADING_RE =
  /^(share\b|related|comments?|leave a|next release|future releases?|questions\?|need additional|support|subscribe|categories?|tags?|navigation|menu|search|footer|header)/i;

/** H3-only noise under release footers (dates, roadmap stubs). */
const SKIP_CAPABILITY_RE =
  /^(next release date:?|future releases?|crm|integrations|\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s*\d{4})$/i;

/**
 * @param {string} html
 * @param {{
 *   pageTitle?: string,
 *   sourceUrl?: string,
 *   competitorId?: string,
 *   maxSubrows?: number,
 *   minBlurbChars?: number,
 * }} [opts]
 * @returns {{
 *   subrows: Array<{
 *     area: string,
 *     heading: string,
 *     blurb: string,
 *     capability_key: string,
 *     headline: string,
 *   }>,
 *   strategy: string,
 * }}
 */
function splitPageSubrows(html, opts = {}) {
  const maxSubrows = Math.min(50, Math.max(1, opts.maxSubrows || DEFAULT_MAX_SUBROWS));
  const minBlurb = Math.max(20, opts.minBlurbChars || MIN_BLURB_CHARS);
  const pageTitle = normalize(opts.pageTitle || '');
  const sourceUrl = String(opts.sourceUrl || '');
  const competitorId = String(opts.competitorId || '');

  if (!html || typeof html !== 'string') {
    return { subrows: [], strategy: 'empty' };
  }

  const $ = cheerio.load(html);
  // Prefer semantic article roots. Elementor sites often have multiple
  // `.elementor` wrappers (nav first) — pick the one with the most H3s.
  const scope = pickContentRoot($);

  /** @type {Array<{ area: string, heading: string, blurb: string }>} */
  const candidates = [];
  let currentArea = '';

  scope.find('h2, h3').each((_, el) => {
    const tag = String(el.tagName || el.name || '').toLowerCase();
    const text = normalize($(el).text());
    if (!text || text.length < 3 || SKIP_HEADING_RE.test(text)) return;
    // Skip the page title repeated as H2
    if (pageTitle && text.toLowerCase() === pageTitle.toLowerCase()) return;

    if (tag === 'h2') {
      currentArea = text;
      return;
    }

    // h3 = capability under current area
    if (SKIP_CAPABILITY_RE.test(text)) return;
    if (/^future releases?/i.test(currentArea)) return;
    const blurb = collectBlurbAfter($, el, minBlurb);
    if (blurb.length < minBlurb) return;

    candidates.push({
      area: currentArea,
      heading: text,
      blurb: blurb.slice(0, 600),
    });
  });

  // Fallback: lone H2 sections with following paragraphs (no H3s)
  if (candidates.length === 0) {
    scope.find('h2').each((_, el) => {
      const text = normalize($(el).text());
      if (!text || SKIP_HEADING_RE.test(text)) return;
      if (pageTitle && text.toLowerCase() === pageTitle.toLowerCase()) return;
      const blurb = collectBlurbAfter($, el, minBlurb);
      if (blurb.length < minBlurb) return;
      candidates.push({ area: '', heading: text, blurb: blurb.slice(0, 600) });
    });
  }

  if (candidates.length < 2) {
    return { subrows: [], strategy: candidates.length === 1 ? 'single_section' : 'no_sections' };
  }

  const subrows = candidates.slice(0, maxSubrows).map((c) => {
    const capability_key = capabilityKey(competitorId, sourceUrl, c.heading);
    const headline = pageTitle
      ? truncate(`${pageTitle} — ${c.heading}`, 180)
      : truncate(c.heading, 180);
    return {
      area: c.area,
      heading: c.heading,
      blurb: c.blurb,
      capability_key,
      headline,
    };
  });

  return { subrows, strategy: 'h2_area_h3_capability' };
}

/**
 * Whether this source type should attempt multi-subrow split.
 * Product-release / changelog is v1; features/blog can opt in later.
 */
function shouldSplitSource(sourceType) {
  return sourceType === 'changelog';
}

function pickContentRoot($) {
  const semantic = $('article, main, .entry-content, .post-content').first();
  if (semantic.length && semantic.find('h3').length >= 2) return semantic;

  let best = null;
  let bestScore = 0;
  $('.elementor').each((_, el) => {
    const node = $(el);
    const score = node.find('h3').length * 10 + node.find('h2').length;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  });
  if (best && bestScore >= 2) return best;

  if (semantic.length) return semantic;
  return $.root();
}

function capabilityKey(competitorId, sourceUrl, heading) {
  const raw = [competitorId, sourceUrl, normalize(heading).toLowerCase()].join('|');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function collectBlurbAfter($, headingEl, minBlurb) {
  const $heading = $(headingEl);
  // Plain HTML: siblings after the heading. Elementor: text lives in the next
  // `.elementor-element` widget after the heading's widget.
  const chains = [
    $heading.nextAll(),
    $heading.parent().nextAll(),
    $heading.closest('.elementor-element, .elementor-widget').nextAll(),
  ];

  for (const $nodes of chains) {
    const parts = [];
    $nodes.each((_, sib) => {
      const tag = String(sib.tagName || sib.name || '').toLowerCase();
      if (/^h[1-6]$/.test(tag)) return false;
      // Stop when the next Elementor block is itself a heading widget.
      const $sib = $(sib);
      if ($sib.is('.elementor-element, .elementor-widget') && $sib.find('h1,h2,h3,h4,h5,h6').length) {
        return false;
      }
      if (tag === 'script' || tag === 'style' || tag === 'nav') return;
      const t = normalize($sib.text());
      if (t.length >= 20) parts.push(t);
      if (parts.join(' ').length >= 400) return false;
    });
    const joined = normalize(parts.join(' '));
    if (joined.length >= minBlurb) return joined;
  }
  return '';
}

function normalize(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

module.exports = {
  splitPageSubrows,
  shouldSplitSource,
  capabilityKey,
  DEFAULT_MAX_SUBROWS,
  // Safety net only — primary brief aim stays 7 days (see preferRecentSignals).
  CHANGELOG_LOOKBACK_DAYS: 45,
  CHANGELOG_FEED_PIN_COUNT: 5,
  CHANGELOG_ABSOLUTE_MAX_DAYS: 90,
};
