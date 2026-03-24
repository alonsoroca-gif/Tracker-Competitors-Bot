/**
 * Collect signals from public sources using rss-parser + cheerio.
 * Richer snippets, event_type, confidence, entities — compatible with gapReport (type, headline, snippet, evidence_snippet, source_url).
 */

const Parser = require('rss-parser');
const cheerio = require('cheerio');
const { loadConfig } = require('./loadConfig');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'user-agent':
      'Mozilla/5.0 (compatible; CompetitorTracker/1.0; +https://example.internal)',
  },
});

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_HTML_CHARS = 200000;
const MAX_SNIPPET = 600;
const MAX_EVIDENCE = 1200;

const JOB_TITLE_PATTERNS = [
  /engineer/i,
  /developer/i,
  /product manager/i,
  /designer/i,
  /sales/i,
  /account executive/i,
  /solutions engineer/i,
  /customer success/i,
  /implementation/i,
  /partnership/i,
  /marketing/i,
  /growth/i,
  /data/i,
  /machine learning/i,
  /\bml\b/i,
  /\bai\b/i,
  /operations/i,
  /revenue/i,
];

const FEATURE_KEYWORDS = [
  'ai',
  'automation',
  'leasing',
  'tour scheduling',
  'lead nurturing',
  'self-guided tours',
  'crm',
  'resident communication',
  'voice ai',
  'sms',
  'email',
  'contact center',
  'lead scoring',
  'application',
  'screening',
  'pricing',
  'integrations',
  'analytics',
  'reporting',
  'chatbot',
  'conversion',
];

const POSITIONING_KEYWORDS = [
  'industry leading',
  'enterprise',
  'multifamily',
  'property management',
  'leasing funnel',
  'conversion',
  'centralized leasing',
  'ai-powered',
  'assistant',
  'platform',
  'end-to-end',
];

const ARTICLE_EVENT_RULES = [
  {
    event_type: 'integration_launch',
    patterns: [/integrat(es|ion|ed)/i, /connected to/i, /now supports/i],
    importance: 0.82,
  },
  {
    event_type: 'feature_launch',
    patterns: [/introducing/i, /launch(es|ed|ing)?/i, /new feature/i, /now available/i],
    importance: 0.85,
  },
  {
    event_type: 'pricing_change',
    patterns: [/pricing/i, /plans/i, /\$\d+/, /starting at/i, /enterprise plan/i],
    importance: 0.9,
  },
  {
    event_type: 'partnership',
    patterns: [/partner(ship|ed)?/i, /strategic alliance/i],
    importance: 0.78,
  },
  {
    event_type: 'positioning_shift',
    patterns: [/ai-powered/i, /reimagining/i, /transform/i, /industry leading/i],
    importance: 0.65,
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseDays(days) {
  return Math.min(90, Math.max(1, parseInt(days, 10) || 7));
}

function cutoffISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - parseDays(days));
  return d.toISOString().slice(0, 10);
}

function filterLastDays(signals, days) {
  const cutoff = cutoffISO(days);
  return (Array.isArray(signals) ? signals : []).filter(
    (s) => s && typeof s.date === 'string' && s.date >= cutoff
  );
}

function envSuffixForCompetitor(competitorId) {
  return String(competitorId || '')
    .trim()
    .replace(/-/g, '_')
    .toUpperCase();
}

function isValidPublicUrl(value) {
  if (value == null || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  try {
    const url = new URL(v);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function getSourceUrls(competitorId) {
  const config = loadConfig();
  const base = (config.sources && config.sources[competitorId]) || {};
  const suffix = envSuffixForCompetitor(competitorId);

  const urls = {
    blog: process.env[`TRACKER_FEED_URL_${suffix}`] || base.blog || '',
    press: process.env[`TRACKER_PRESS_URL_${suffix}`] || base.press || base.news || '',
    changelog: process.env[`TRACKER_CHANGELOG_URL_${suffix}`] || base.changelog || '',
    youtube_rss: process.env[`TRACKER_YOUTUBE_RSS_${suffix}`] || base.youtube_rss || base.youtube || '',
    pricing_url: base.pricing_url || '',
    features_url: base.features_url || '',
    careers_url: base.careers_url || '',
    docs_url: base.docs_url || '',
  };

  return Object.fromEntries(
    Object.entries(urls).map(([k, v]) => [k, isValidPublicUrl(v) ? v : ''])
  );
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; CompetitorTracker/1.0; +https://example.internal)',
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    const text = await res.text();
    return text.slice(0, MAX_HTML_CHARS);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeWhitespace(str) {
  return String(str || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function truncate(str, max) {
  const s = normalizeWhitespace(str);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function loadHtml(html) {
  const $ = cheerio.load(html || '');
  $('script, style, noscript, svg, iframe').remove();
  return $;
}

function extractMeta($, pageUrl) {
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    $('h1').first().text() ||
    '';

  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';

  const headings = unique(
    $('h1, h2, h3')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter((t) => t.length >= 4 && t.length <= 140)
  ).slice(0, 20);

  const bullets = unique(
    $('li')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter((t) => t.length >= 8 && t.length <= 220)
  ).slice(0, 40);

  const bodyText = normalizeWhitespace($('body').text());

  return {
    pageUrl,
    title: normalizeWhitespace(title),
    description: normalizeWhitespace(description),
    headings,
    bullets,
    bodyText,
  };
}

function extractMoneyValues(text) {
  const matches =
    String(text || '').match(/\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s*\/\s*(?:mo|month|yr|year))?/gi) || [];
  return unique(matches).slice(0, 20);
}

function detectKeywords(text, keywords) {
  const haystack = String(text || '').toLowerCase();
  return keywords.filter((kw) => haystack.includes(kw.toLowerCase()));
}

function scoreConfidence({ evidenceCount = 0, hasAmounts = false, hasHeadings = false, directPage = false }) {
  let score = 0.45;
  if (directPage) score += 0.15;
  if (evidenceCount >= 2) score += 0.15;
  if (evidenceCount >= 5) score += 0.1;
  if (hasAmounts) score += 0.1;
  if (hasHeadings) score += 0.05;
  return Math.min(0.95, Number(score.toFixed(2)));
}

function buildSignalBase({
  competitorId,
  productId,
  source,
  type,
  event_type,
  headline,
  source_url,
  date,
  snippet,
  evidence_snippet,
  confidence,
  importance,
  entities,
  metadata,
}) {
  return {
    date: date || todayISO(),
    source,
    competitor_id: competitorId,
    product_id: productId,
    type,
    event_type,
    headline: truncate(headline || '', 180),
    snippet: truncate(snippet || '', MAX_SNIPPET),
    evidence_snippet: truncate(evidence_snippet || '', MAX_EVIDENCE),
    source_url,
    confidence: typeof confidence === 'number' ? confidence : 0.6,
    importance: typeof importance === 'number' ? importance : 0.6,
    entities: entities || {},
    metadata: metadata || {},
  };
}

function extractPricingSignals(meta, pageUrl, competitorId, productId) {
  const combined = [meta.title, meta.description, ...meta.headings, ...meta.bullets, meta.bodyText]
    .filter(Boolean)
    .join('\n');

  const prices = extractMoneyValues(combined);
  const tierCandidates = unique(
    [...meta.headings, ...meta.bullets]
      .filter((t) => /plan|tier|starter|pro|premium|enterprise|growth|basic/i.test(t))
      .map((t) => t.replace(/\s+/g, ' ').trim())
  ).slice(0, 10);

  const featureKeywords = detectKeywords(combined, FEATURE_KEYWORDS);
  const evidenceParts = [
    meta.description,
    ...tierCandidates.slice(0, 5),
    ...prices.slice(0, 5),
    ...meta.bullets.slice(0, 5),
  ].filter(Boolean);

  if (!prices.length && !tierCandidates.length && !featureKeywords.length) return [];

  const eventType = prices.length ? 'pricing_change' : 'pricing_positioning';
  const snippet = [
    prices.length ? `Detected pricing values: ${prices.slice(0, 5).join(', ')}` : '',
    tierCandidates.length ? `Tier language: ${tierCandidates.slice(0, 4).join(' | ')}` : '',
    featureKeywords.length ? `Packaging keywords: ${featureKeywords.slice(0, 8).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'pricing_page',
      type: 'pricing',
      event_type: eventType,
      headline: meta.title || 'Pricing page update',
      source_url: pageUrl,
      date: todayISO(),
      snippet,
      evidence_snippet: evidenceParts.join(' • '),
      confidence: scoreConfidence({
        evidenceCount: evidenceParts.length,
        hasAmounts: prices.length > 0,
        hasHeadings: meta.headings.length > 0,
        directPage: true,
      }),
      importance: prices.length ? 0.92 : 0.72,
      entities: {
        prices,
        tiers: tierCandidates,
        keywords: featureKeywords,
      },
      metadata: {
        page_kind: 'pricing',
      },
    }),
  ];
}

function extractFeatureSignals(meta, pageUrl, competitorId, productId) {
  const headings = meta.headings.filter((h) => h.length >= 6);
  const bullets = meta.bullets.filter((b) => b.length >= 10 && b.length <= 200);
  const featureKeywords = detectKeywords(
    [meta.title, meta.description, ...headings, ...bullets, meta.bodyText].join('\n'),
    FEATURE_KEYWORDS
  );
  const positioningKeywords = detectKeywords(
    [meta.title, meta.description, ...headings, ...bullets, meta.bodyText].join('\n'),
    POSITIONING_KEYWORDS
  );

  const featureCandidates = unique(
    [...headings, ...bullets].filter(
      (t) =>
        !/cookie|privacy|login|book a demo|request a demo|contact us|learn more/i.test(t) &&
        (FEATURE_KEYWORDS.some((kw) => t.toLowerCase().includes(kw)) ||
          /ai|automation|leasing|tour|crm|application|analytics|screening|assistant|messaging/i.test(t))
    )
  ).slice(0, 10);

  if (!featureCandidates.length && !positioningKeywords.length) return [];

  const eventType =
    featureCandidates.length >= 3
      ? 'feature_set_update'
      : positioningKeywords.length
        ? 'positioning_shift'
        : 'feature_launch';

  const snippet = [
    featureCandidates.length ? `Detected feature/solution themes: ${featureCandidates.slice(0, 4).join(' | ')}` : '',
    featureKeywords.length ? `Repeated product keywords: ${featureKeywords.slice(0, 8).join(', ')}` : '',
    positioningKeywords.length ? `Positioning cues: ${positioningKeywords.slice(0, 6).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'features_page',
      type: 'features',
      event_type: eventType,
      headline: meta.title || 'Feature page update',
      source_url: pageUrl,
      date: todayISO(),
      snippet,
      evidence_snippet: [...featureCandidates.slice(0, 5), ...meta.bullets.slice(0, 5)].join(' • '),
      confidence: scoreConfidence({
        evidenceCount: featureCandidates.length + positioningKeywords.length,
        hasHeadings: headings.length > 0,
        directPage: true,
      }),
      importance: featureCandidates.length >= 3 ? 0.84 : 0.68,
      entities: {
        features: featureCandidates,
        keywords: featureKeywords,
        positioning_keywords: positioningKeywords,
      },
      metadata: {
        page_kind: 'features',
      },
    }),
  ];
}

function extractCareerSignals(meta, pageUrl, competitorId, productId) {
  const roleCandidates = unique(
    [...meta.headings, ...meta.bullets, ...meta.bodyText.split(/\n|\./)]
      .map((t) => normalizeWhitespace(t))
      .filter((t) => t.length >= 8 && t.length <= 120)
      .filter((t) => JOB_TITLE_PATTERNS.some((rx) => rx.test(t)))
  ).slice(0, 20);

  if (!roleCandidates.length) return [];

  const grouped = {
    engineering: roleCandidates.filter((r) => /engineer|developer|ml|ai|data/i.test(r)),
    sales: roleCandidates.filter((r) => /sales|account executive|revenue/i.test(r)),
    customer: roleCandidates.filter((r) => /customer success|implementation|support/i.test(r)),
    product: roleCandidates.filter((r) => /product manager|designer/i.test(r)),
    partnerships: roleCandidates.filter((r) => /partnership/i.test(r)),
    marketing: roleCandidates.filter((r) => /marketing|growth/i.test(r)),
  };

  const activeGroups = Object.entries(grouped)
    .filter(([, roles]) => roles.length)
    .map(([group]) => group);

  const snippet = [
    `Detected hiring focus: ${activeGroups.join(', ') || 'general hiring'}`,
    `Roles seen: ${roleCandidates.slice(0, 6).join(' | ')}`,
  ].join('. ');

  return [
    buildSignalBase({
      competitorId,
      productId,
      source: 'careers',
      type: 'job',
      event_type: 'hiring_signal',
      headline: meta.title || 'Careers page update',
      source_url: pageUrl,
      date: todayISO(),
      snippet,
      evidence_snippet: roleCandidates.slice(0, 10).join(' • '),
      confidence: scoreConfidence({
        evidenceCount: roleCandidates.length,
        hasHeadings: meta.headings.length > 0,
        directPage: true,
      }),
      importance: grouped.engineering.length || grouped.sales.length ? 0.86 : 0.7,
      entities: {
        roles: roleCandidates,
        role_groups: activeGroups,
      },
      metadata: {
        page_kind: 'careers',
      },
    }),
  ];
}

function inferArticleEventType(title, content) {
  const haystack = `${title}\n${content}`;
  for (const rule of ARTICLE_EVENT_RULES) {
    if (rule.patterns.some((rx) => rx.test(haystack))) {
      return {
        event_type: rule.event_type,
        importance: rule.importance,
      };
    }
  }
  return {
    event_type: 'content_update',
    importance: 0.55,
  };
}

function extractNamedEntities(text) {
  const source = normalizeWhitespace(text);
  const integrations = unique(
    (source.match(/\b(Yardi|RealPage|Entrata|AppFolio|Salesforce|Zapier|HubSpot|MRI|Knock)\b/gi) || []).map((x) =>
      x.trim()
    )
  );
  const aiTerms = unique(
    (source.match(/\b(AI|voice AI|chatbot|assistant|automation|machine learning)\b/gi) || []).map((x) => x.trim())
  );
  return { integrations, ai_terms: aiTerms };
}

async function fetchArticleEvidence(url) {
  if (!isValidPublicUrl(url)) return { title: '', description: '', content: '' };

  try {
    const html = await fetchText(url, DEFAULT_TIMEOUT_MS);
    const $ = loadHtml(html);
    const meta = extractMeta($, url);

    const articleText = unique(
      $('article p, main p, .post p, .entry-content p, .content p, p')
        .map((_, el) => normalizeWhitespace($(el).text()))
        .get()
        .filter((t) => t.length >= 40)
    ).slice(0, 20);

    return {
      title: meta.title,
      description: meta.description,
      content: normalizeWhitespace(articleText.join('\n\n') || meta.bodyText).slice(0, 6000),
    };
  } catch (_) {
    return { title: '', description: '', content: '' };
  }
}

function coerceItemDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.updated || '';
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return todayISO();
  return d.toISOString().slice(0, 10);
}

async function extractFeedSignals(feedUrl, sourceType, competitorId, productId, days) {
  if (!isValidPublicUrl(feedUrl)) return [];

  let feed;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (_) {
    return [];
  }

  const cutoff = cutoffISO(days);
  const items = Array.isArray(feed.items) ? feed.items.slice(0, 20) : [];
  const signals = [];

  for (const item of items) {
    const date = coerceItemDate(item);
    if (date < cutoff) continue;

    const title = normalizeWhitespace(item.title || '');
    const link = item.link || item.guid || feedUrl;
    const rssSnippet = normalizeWhitespace(item.contentSnippet || item.content || item.summary || '');
    const article = await fetchArticleEvidence(link);

    const combined = [title, rssSnippet, article.title, article.description, article.content]
      .filter(Boolean)
      .join('\n\n');

    const { event_type, importance } = inferArticleEventType(title, combined);
    const entities = extractNamedEntities(combined);

    const evidence = [article.description, ...article.content.split('\n\n').slice(0, 3)]
      .filter(Boolean)
      .join(' • ');

    const typeMap = {
      blog: 'blog',
      press: 'press',
      changelog: 'changelog',
      youtube: 'youtube',
    };

    signals.push(
      buildSignalBase({
        competitorId,
        productId,
        source: sourceType,
        type: typeMap[sourceType] || 'blog',
        event_type,
        headline: title || article.title || `${sourceType} update`,
        source_url: link,
        date,
        snippet:
          rssSnippet ||
          article.description ||
          article.content.split('\n\n')[0] ||
          title,
        evidence_snippet: evidence,
        confidence: scoreConfidence({
          evidenceCount: evidence ? evidence.split('•').length : 1,
          hasHeadings: Boolean(title),
          directPage: Boolean(article.content),
        }),
        importance,
        entities,
        metadata: {
          page_kind: sourceType,
          feed_title: normalizeWhitespace(feed.title || ''),
        },
      })
    );
  }

  return signals;
}

async function extractPageSignals(pageUrl, pageKind, competitorId, productId) {
  if (!isValidPublicUrl(pageUrl)) return [];

  try {
    const html = await fetchText(pageUrl, DEFAULT_TIMEOUT_MS);
    const $ = loadHtml(html);
    const meta = extractMeta($, pageUrl);

    if (pageKind === 'pricing_url') {
      return extractPricingSignals(meta, pageUrl, competitorId, productId);
    }
    if (pageKind === 'features_url' || pageKind === 'docs_url') {
      return extractFeatureSignals(meta, pageUrl, competitorId, productId);
    }
    if (pageKind === 'careers_url') {
      return extractCareerSignals(meta, pageUrl, competitorId, productId);
    }

    return [];
  } catch (_) {
    return [];
  }
}

function dedupeSignals(signals) {
  const seen = new Set();
  const out = [];

  for (const s of signals) {
    const key = [
      s.date,
      s.competitor_id,
      s.product_id,
      s.type,
      s.event_type,
      s.source_url,
      (s.snippet || '').slice(0, 120),
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }

  return out;
}

async function collect(competitorId, productId, days = 7) {
  let sourceUrls;
  try {
    sourceUrls = getSourceUrls(competitorId);
  } catch (_) {
    return [];
  }

  const safeDays = parseDays(days);
  const collected = [];

  const feedTasks = [
    ['blog', sourceUrls.blog],
    ['press', sourceUrls.press],
    ['changelog', sourceUrls.changelog],
    ['youtube', sourceUrls.youtube_rss],
  ];

  for (const [sourceType, url] of feedTasks) {
    if (!url) continue;
    const signals = await extractFeedSignals(url, sourceType, competitorId, productId, safeDays);
    collected.push(...signals);
  }

  const pageTasks = [
    ['pricing_url', sourceUrls.pricing_url],
    ['features_url', sourceUrls.features_url],
    ['careers_url', sourceUrls.careers_url],
    ['docs_url', sourceUrls.docs_url],
  ];

  for (const [pageKind, url] of pageTasks) {
    if (!url) continue;
    const signals = await extractPageSignals(url, pageKind, competitorId, productId);
    collected.push(...signals);
  }

  return dedupeSignals(filterLastDays(collected, safeDays));
}

module.exports = {
  collect,
  filterLastDays,
  getSourceUrls,
  isValidPublicUrl,
};
