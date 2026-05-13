#!/usr/bin/env node
/**
 * Core parity check — for each proposed feature, scan Entrata Core
 * and return a parity verdict so the tracker bot can stop recommending
 * features that already exist in the monolith.
 *
 * Reuses the keyword-scoring engine in `../lib/repoInsight.js` and the
 * app-to-folder mapping in `../config/app-inventory.json`. Adds an
 * aggregation layer that walks every app under
 * `${ENTRATA_MONO_ROOT}/Applications/`, sums scores per feature, and
 * emits one of five verdicts:
 *
 *   Existing   — score ≥ 40 AND ≥ 4 files; PRD-blocked, downgrade to Won't chase
 *   Partial    — score ≥ 15 AND ≥ 2 files; PRD scope must be the delta vs Core
 *   Borderline — low-confidence band: single-file dominance, score 8–14, or
 *                Existing-grade score concentrated in too few files. The
 *                skill must promote Borderline rows via AskQuestion before
 *                assigning a Tier; the script does not auto-tier them.
 *   Gap        — score < 8; PRD describes the whole feature
 *   Unknown    — Entrata Core path could not be auto-resolved (extremely rare)
 *
 * The verdict is consumed by `.cursor/skills/tracker-drop-cycle/SKILL.md`
 * Phase 4.2b — the parity gate that runs before §4.3 emits feature rows.
 *
 * --------------------------------------------------------------------
 * Usage
 * --------------------------------------------------------------------
 *   node scripts/core-parity-check.js --in path/to/features.json
 *   echo '[{...}]' | node scripts/core-parity-check.js --stdin
 *   node scripts/core-parity-check.js --self-test
 *
 * Options:
 *   --in <file>          Read features array from a JSON file
 *   --stdin              Read features array from stdin
 *   --self-test          Run against three hard-coded signals from the
 *                        2026-05-12 manager review (SightMap, FTC pricing,
 *                        AEO/JSON-LD) — useful for verifying the script
 *                        resolves Entrata Core paths correctly.
 *   --format <fmt>       `json` (default — machine-readable) or `markdown`
 *                        (chat-pasteable table for the skill).
 *   --core <path>        One-off override of the Entrata Core path for
 *                        this run. Does not write to the cache.
 *   --save-core <path>   Permanently cache this path in
 *                        `initiative-1-tracker/tracker/.core-path`
 *                        (gitignored). Subsequent runs auto-resolve.
 *                        Useful for a one-time setup on a new machine.
 *   --scope-by-product   Narrow the scan to the app(s) mapped in
 *                        `config/app-inventory.json` for each feature's
 *                        `product_id`. Stricter semantics ("does THIS
 *                        product already ship this?") but misses cross-app
 *                        implementations. Default = scan all apps.
 *
 * --------------------------------------------------------------------
 * Core-path resolution (transparent — manager rarely thinks about this)
 * --------------------------------------------------------------------
 * The script tries each source below in order; first valid hit wins:
 *
 *   1. --core <path>             one-off override
 *   2. $ENTRATA_MONO_ROOT        legacy env-var path
 *   3. .core-path cache file     auto-written after any successful discovery
 *   4. Auto-scan of candidate    ~/Desktop/Core Repo/entrata-core
 *      paths (priority order)    ~/Documents/Core Repo/entrata-core
 *                                ~/Projects/Core Repo/entrata-core
 *                                ~/Code/Core Repo/entrata-core
 *                                ~/Core Repo/entrata-core
 *                                ~/entrata-core
 *
 * On the first successful run from sources 3 or 4 we write the
 * resolved path to `.core-path` (gitignored) so subsequent runs are
 * instant. Manager never has to remember to export ENTRATA_MONO_ROOT.
 *
 * Input shape (array of objects):
 *   {
 *     id: "1",                          // any stable id; passed through
 *     competitor_signal: "...",         // raw signal text from §4.2
 *     proposed_feature: "...",          // the feature the bot wants to PRD
 *     product_id: "leasing-ai" | null   // optional — narrows the scan
 *   }
 *
 * Output (json mode):
 *   [{
 *     id, parity, total_score, files_with_hits, apps_with_hits,
 *     top_apps: [{ app, score, files }],
 *     top_files: [{ relativePath, app, score, matched_terms }],
 *     grounding_terms, verdict_reason
 *   }]
 *
 * Verdict thresholds (tunable via --existing-score / --existing-files /
 * --partial-score / --confident-partial-min, defaults calibrated against
 * the Cohort A (manager screenshot) and Cohort B (novel features)
 * cohorts; see test/parity-fixtures.json for the regression suite):
 *
 *   score < 8                                              → Gap
 *   files == 1                                             → Borderline (single-file dominance)
 *   score >= 40 AND files < 4                              → Borderline (Existing-grade, thin breadth)
 *   score >= 40 AND files >= 4                             → Existing
 *   8 <= score < 15                                        → Borderline (just above Gap floor)
 *   otherwise (score >= 15)                                → Partial
 *   (Core path missing or unreadable                       → Unknown)
 */

const fs = require('fs');
const path = require('path');

const trackerRoot = path.resolve(__dirname, '..');
const { extractSearchTerms } = require(path.join(trackerRoot, 'lib', 'repoInsight.js'));
const { getAppInventory } = require(path.join(trackerRoot, 'lib', 'appInventory.js'));

const SKIP_DIRS = new Set([
  'node_modules', 'vendor', '.git', 'cache', 'tmp', 'temp', 'logs',
  'coverage', 'dist', 'build', '.next', 'Library', 'bower_components',
]);
const SOURCE_EXT = /\.(php|phtml|inc|js|cjs|mjs|tsx?|jsx|vue|twig)$/i;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word matcher. The shared scanner in repoInsight.js uses
 *  substring match (`line.includes(term)`) which conflates `eli` with
 *  `eligibility` / `elite` and inflates parity scores. For the parity
 *  gate we need word-boundary precision. */
function buildTermMatchers(terms) {
  return terms.map((t) => ({
    term: t,
    re: new RegExp(`\\b${escapeRegex(t)}\\b`, 'i'),
  }));
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

function scoreFile(content, matchers) {
  const lines = String(content).split('\n');
  let score = 0;
  const matched = new Set();
  const snippets = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of matchers) {
      if (m.re.test(line)) {
        score += 1;
        matched.add(m.term);
        if (snippets.length < 3) {
          snippets.push({ line: i + 1, term: m.term, text: line.trim().slice(0, 160) });
        }
      }
    }
  }
  return { score, matched_terms: [...matched], snippets };
}

function scanApp(appRoot, matchers, opts = {}) {
  const maxDepth = opts.maxDepth ?? 8;
  const maxFiles = opts.maxFiles ?? 600;
  const maxFileBytes = opts.maxFileBytes ?? 200000;
  if (!fs.existsSync(appRoot)) return [];
  const hits = [];
  let filesSeen = 0;
  for (const file of walkFiles(appRoot, 0, maxDepth)) {
    if (filesSeen >= maxFiles) break;
    filesSeen += 1;
    let buf;
    try {
      buf = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (buf.length > maxFileBytes) buf = buf.slice(0, maxFileBytes);
    const { score, matched_terms, snippets } = scoreFile(buf, matchers);
    if (score <= 0) continue;
    hits.push({
      relativePath: path.relative(appRoot, file),
      score,
      matched_terms,
      snippets,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

const DEFAULT_THRESHOLDS = {
  existing_score: 40,
  existing_files: 4,
  partial_score: 8,
  partial_files: 2,
  // Score below this lands in the Borderline zone even if it clears
  // the partial_score floor — it's "above Gap but not confidently
  // Partial." Calibrated against the SightMap (14/3/3) and IndexedDB
  // (12/3/3) cases that sit right at the boundary.
  confident_partial_min: 15,
  min_distinct_terms_per_file: 2,
  min_specific_terms_required: 1,
};

const HOME = process.env.HOME || process.env.USERPROFILE || '';
const CACHE_FILE = path.resolve(__dirname, '..', '.core-path');

/**
 * Auto-discovery candidates, in priority order. The script tries each
 * path until it finds a directory that contains an `Applications/`
 * subdirectory (the diagnostic that proves we're pointing at the
 * entrata-core monolith and not a sibling folder).
 *
 * The first machine-local hit wins. After a successful discovery, the
 * path is written to `.core-path` (gitignored) so subsequent runs are
 * instant — no env var, no prompt, no re-discovery.
 */
const CANDIDATE_PATHS = [
  path.join(HOME, 'Desktop', 'Core Repo', 'entrata-core'),
  path.join(HOME, 'Documents', 'Core Repo', 'entrata-core'),
  path.join(HOME, 'Projects', 'Core Repo', 'entrata-core'),
  path.join(HOME, 'Code', 'Core Repo', 'entrata-core'),
  path.join(HOME, 'Core Repo', 'entrata-core'),
  path.join(HOME, 'entrata-core'),
];

/**
 * Property-management domain vocabulary that appears in basically every
 * PMS codebase by definition. These words match thousands of lines across
 * the monolith and produce false-positive `Existing` verdicts. We strip
 * them from the search-term set so the parity check measures whether
 * Core implements the *specific* concept the competitor signal points at,
 * not whether Core mentions generic real-estate words.
 *
 * Keep this list conservative — words here will never trigger a match.
 * If a future signal genuinely turns on one of these terms, override
 * with --keep-term=<term> (see parseArgs).
 */
const PMS_DOMAIN_STOP = new Set([
  'agent', 'agents', 'lease', 'leases', 'leasing', 'tenant', 'tenants',
  'resident', 'residents', 'prospect', 'prospects', 'unit', 'units',
  'property', 'properties', 'apartment', 'apartments', 'rent', 'rental',
  'rentals', 'application', 'applications', 'applicant', 'applicants',
  'portal', 'portals', 'customer', 'customers', 'account', 'accounts',
  'payment', 'payments', 'building', 'buildings', 'schedule', 'scheduled',
  'scheduling', 'calendar', 'signal', 'signals', 'data', 'datas',
  'page', 'pages', 'system', 'systems', 'service', 'services',
  'module', 'modules', 'controller', 'controllers', 'model', 'models',
  'view', 'views', 'panel', 'panels', 'default', 'defaults',
  'header', 'headers', 'footer', 'footers', 'label', 'labels',
  'button', 'buttons', 'link', 'links', 'image', 'images',
  'file', 'files', 'list', 'lists', 'table', 'tables',
  'record', 'records', 'manager', 'managers', 'admin', 'administrator',
  'user', 'users', 'profile', 'profiles', 'setting', 'settings',
  'config', 'configuration', 'company', 'companies', 'website',
  'websites', 'site', 'sites', 'message', 'messages', 'chat',
  'name', 'names', 'type', 'types', 'status', 'statuses',
  'date', 'dates', 'time', 'times', 'number', 'numbers',
  'phone', 'email', 'emails', 'address', 'addresses',
  'mode', 'modes', 'feature', 'features', 'product', 'products',
  'tour', 'tours', 'lead', 'leads', 'render', 'renders',
  'home', 'homes', 'discovery', 'response', 'responses',
  'request', 'requests', 'show', 'shows', 'load', 'loaded',
  'queue', 'queues', 'retry', 'retries',
  'sync', 'live',
  // Added 2026-05-13 after the Funnel/featuredcustomers cycle surfaced
  // a false-positive `Existing` verdict driven entirely by these
  // generic dev/business words matching unrelated PHP files
  // (case=switch/case statement, reference=PHP &$ref, flow=paymentFlow,
  //  capture=errorCapture, proof=proofOfDelivery, etc.).
  // See test/parity-fixtures.json `known-fp-customer-stories` for the
  // regression fixture that defends this expansion.
  'case', 'cases', 'reference', 'references', 'proof', 'proofs',
  'capture', 'captures', 'flow', 'flows', 'submit', 'submits',
  'submission', 'submissions', 'widget', 'widgets', 'studies', 'study',
]);

function parseArgs(argv) {
  const args = { format: 'json', thresholds: { ...DEFAULT_THRESHOLDS }, scopeByProduct: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--stdin') args.stdin = true;
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--format') args.format = argv[++i];
    else if (a === '--core') args.core = argv[++i];
    else if (a === '--save-core') args.saveCore = argv[++i];
    else if (a === '--scope-by-product') args.scopeByProduct = true;
    else if (a === '--existing-score') args.thresholds.existing_score = Number(argv[++i]);
    else if (a === '--existing-files') args.thresholds.existing_files = Number(argv[++i]);
    else if (a === '--partial-score') args.thresholds.partial_score = Number(argv[++i]);
    else if (a === '--partial-files') args.thresholds.partial_files = Number(argv[++i]);
    else if (a === '--confident-partial-min') args.thresholds.confident_partial_min = Number(argv[++i]);
    else if (a === '--help' || a === '-h') {
      printHelpAndExit();
    }
  }
  return args;
}

function printHelpAndExit() {
  const banner = String(fs.readFileSync(__filename, 'utf8')).split('\n');
  const help = [];
  let inBlock = false;
  for (const line of banner) {
    if (line.startsWith('/**')) { inBlock = true; continue; }
    if (line.startsWith(' */')) break;
    if (inBlock) help.push(line.replace(/^\s*\*\s?/, ''));
  }
  process.stdout.write(help.join('\n') + '\n');
  process.exit(0);
}

function validCoreRoot(absPath) {
  if (!absPath) return null;
  if (!fs.existsSync(absPath)) return null;
  const apps = path.join(absPath, 'Applications');
  if (!fs.existsSync(apps)) return null;
  return apps;
}

function readCachedCorePath() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8').trim();
      if (raw) return raw;
    }
  } catch {
    /* silent fallthrough — cache is best-effort */
  }
  return null;
}

function writeCachedCorePath(absPath) {
  try {
    fs.writeFileSync(CACHE_FILE, absPath + '\n', 'utf8');
  } catch (e) {
    process.stderr.write(`core-parity-check: WARN failed to cache core path (${e.message})\n`);
  }
}

/**
 * Resolution order (first valid hit wins):
 *   1. --core <path>          (one-off override on the command line)
 *   2. ENTRATA_MONO_ROOT       (legacy env-var path; still honoured)
 *   3. .core-path cache file   (auto-written after any successful discovery)
 *   4. Auto-scan CANDIDATE_PATHS in priority order
 *
 * On a successful auto-discovery (steps 3 or 4), the resolved path is
 * written to `.core-path` so the next run is instant. The manager
 * never has to think about ENTRATA_MONO_ROOT again.
 *
 * @returns {{ root: string|null, applicationsDir?: string, source: string, reason?: string, tried: string[] }}
 */
function resolveCoreRoot(cliCore) {
  const tried = [];

  if (cliCore) {
    const apps = validCoreRoot(cliCore);
    tried.push(`--core ${cliCore}`);
    if (apps) return { root: cliCore, applicationsDir: apps, source: 'cli', tried };
  }

  const env = (process.env.ENTRATA_MONO_ROOT || '').trim();
  if (env) {
    const apps = validCoreRoot(env);
    tried.push(`ENTRATA_MONO_ROOT=${env}`);
    if (apps) return { root: env, applicationsDir: apps, source: 'env', tried };
  }

  const cached = readCachedCorePath();
  if (cached) {
    const apps = validCoreRoot(cached);
    tried.push(`.core-path=${cached}`);
    if (apps) return { root: cached, applicationsDir: apps, source: 'cache', tried };
  }

  for (const candidate of CANDIDATE_PATHS) {
    tried.push(candidate);
    const apps = validCoreRoot(candidate);
    if (apps) {
      writeCachedCorePath(candidate);
      return { root: candidate, applicationsDir: apps, source: 'auto-discovered', tried };
    }
  }

  return {
    root: null,
    source: 'none',
    reason: 'No Entrata Core found via --core, ENTRATA_MONO_ROOT, .core-path cache, or auto-discovery',
    tried,
  };
}

function readInput(args) {
  if (args.selfTest) {
    return [
      {
        id: 'sightmap',
        competitor_signal: 'Jonah+Engrain SightMap on prospect sites — interactive siteplan / map embed',
        proposed_feature: 'Live-PMS Siteplan: prospect-facing interactive map of available units tied to PMS pricing',
        product_id: 'prospect-portal',
      },
      {
        id: 'ftc-pricing',
        competitor_signal: 'Jonah positioning as FTC pricing-transparency-ready — all-in pricing disclosure',
        proposed_feature: '"All-In Pricing" mode in Entrata pricing engine — every prospect-facing price includes fees by default',
        product_id: 'leasing-ai',
      },
      {
        id: 'aeo-jsonld',
        competitor_signal: 'Jonah\'s AEO/FAQ push for answer-engine discovery — structured data for ChatGPT / Perplexity / Google AI Overview',
        proposed_feature: 'PMS-driven structured-data feed (JSON-LD) for Entrata leasing pages — FAQ + Apartment + Offer schemas',
        product_id: 'leasing-ai',
      },
    ];
  }
  let raw;
  if (args.in) {
    raw = fs.readFileSync(args.in, 'utf8');
  } else if (args.stdin) {
    raw = fs.readFileSync(0, 'utf8');
  } else {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Input is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array of feature rows.');
  return parsed;
}

function listAppDirs(applicationsDir) {
  return fs
    .readdirSync(applicationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, abs: path.join(applicationsDir, e.name) }));
}

/**
 * Parity scans default to ALL apps under ${ENTRATA_MONO_ROOT}/Applications/.
 * The manager's question is "does Core ship this concept *anywhere*?" — not
 * "does the specific tracker-product corresponding to this signal ship it?"
 * Narrowing to one app via product_id misses cross-app implementations
 * (e.g. JSON-LD lives in 9 different apps; All-In Pricing spans Accounting
 * + EntrataLeasingWebsite + Entrata).
 *
 * Opt in to narrow scoping with `--scope-by-product` when you want the
 * stricter "does THIS product already ship this?" semantics.
 */
function scopeAppsForProduct(productId, applicationsDir, allApps, scopeByProduct) {
  if (!scopeByProduct || !productId) return allApps;
  const inventory = getAppInventory(productId);
  if (!inventory || !inventory.configured) return allApps;
  const scoped = inventory.artifacts
    .map((a) => a.repo_root)
    .filter(Boolean)
    .map((p) => ({ name: path.basename(p), abs: p }))
    .filter((a) => fs.existsSync(a.abs));
  if (!scoped.length) return allApps;
  return scoped;
}

function filterDomainNoise(termList) {
  return termList.filter((t) => {
    const lo = String(t).toLowerCase();
    if (PMS_DOMAIN_STOP.has(lo)) return false;
    if (lo.length < 4) return false;
    return true;
  });
}

/**
 * Parity-specific term extraction. Deliberately does NOT consult
 * `product-keywords.json` (via `mergeGapAndProductTerms`) — that config
 * exists for the live UI's prose recommendations and injects vocabulary
 * that's *guaranteed* to appear in Core (e.g. "chatbot", "conversation").
 * For parity we want pure-signal terms: what does the competitor say,
 * stripped of common PMS noise.
 */
function terms(feature) {
  const blob = [feature.competitor_signal, feature.proposed_feature].filter(Boolean).join('\n');
  const fromText = extractSearchTerms(blob, { max: 24 });
  return filterDomainNoise(fromText);
}

/**
 * Verdict logic with a `Borderline` band for low-confidence cases. The
 * goal is to be honest about uncertainty: when the score sits right at
 * a tier boundary, when only one file matched (no cross-file diversity),
 * or when the score is Existing-grade but spread thin, we surface
 * `Borderline` so the manager promotes it to Partial or Gap manually
 * instead of the script silently guessing.
 *
 * Verdict precedence (first matching rule wins):
 *
 *   1. score < partial_score                          → Gap
 *   2. files_with_hits === 1                          → Borderline
 *      (single-file dominance is always suspicious — likely a vocabulary
 *      collision in one unrelated file, not a real implementation)
 *   3. score >= existing_score AND files < existing_files
 *                                                     → Borderline
 *      (Existing-grade score but file diversity is below threshold — the
 *      concept might be heavily present in a couple files but lacks the
 *      breadth we'd expect from a real shipped feature)
 *   4. score >= existing_score AND files >= existing_files
 *                                                     → Existing
 *   5. score < confident_partial_min                  → Borderline
 *      (just above the Gap floor — could be incidental keyword overlap)
 *   6. otherwise                                      → Partial
 */
function verdictFor(stats, thresholds) {
  const { total_score, files_with_hits, apps_with_hits } = stats;
  const partial_min = thresholds.partial_score;
  const confident_partial_min = thresholds.confident_partial_min ?? 15;
  const existing_score = thresholds.existing_score;
  const existing_files = thresholds.existing_files;

  if (total_score < partial_min) {
    return {
      parity: 'Gap',
      reason: `${total_score} matches across ${files_with_hits} files — no meaningful Core presence`,
    };
  }

  // Single-file noise: when only ONE file matches and the score is below
  // the confident-Partial floor, this is almost certainly a vocabulary
  // collision in an unrelated file (e.g. one generic word like "engagement"
  // appearing 9 times in CWebsiteCustomPagesModule.class.php). Treat as
  // Gap, not Borderline — there's nothing to "verify before tiering"
  // because there's no real signal.
  if (files_with_hits === 1 && total_score < confident_partial_min) {
    return {
      parity: 'Gap',
      reason: `${total_score} matches but all from 1 file with score below confident-Partial floor — single-file noise, not real implementation`,
    };
  }

  // Single-file but high score: still suspicious (a real feature would
  // be spread across multiple files), but high enough to warrant a look.
  if (files_with_hits === 1) {
    return {
      parity: 'Borderline',
      reason: `${total_score} matches but all from 1 file — likely single-file vocabulary collision rather than real implementation. Verify the file is actually relevant before tiering.`,
    };
  }

  if (total_score >= existing_score && files_with_hits < existing_files) {
    return {
      parity: 'Borderline',
      reason: `${total_score} matches but only across ${files_with_hits} files — Existing-grade score concentrated in too few files. Verify the breadth before treating as shipped.`,
    };
  }

  if (total_score >= existing_score && files_with_hits >= existing_files) {
    return {
      parity: 'Existing',
      reason: `${total_score} matches across ${files_with_hits} files in ${apps_with_hits} apps — likely already shipped`,
    };
  }

  if (total_score < confident_partial_min) {
    return {
      parity: 'Borderline',
      reason: `${total_score} matches across ${files_with_hits} files — just above the Gap floor; could be incidental keyword overlap. Verify before assigning Tier.`,
    };
  }

  return {
    parity: 'Partial',
    reason: `${total_score} matches across ${files_with_hits} files — foundation exists, scope likely incomplete`,
  };
}

function checkOne(feature, applicationsDir, allApps, thresholds) {
  const t = terms(feature);
  if (!t.length) {
    return {
      id: feature.id,
      parity: 'Unknown',
      verdict_reason: 'No search terms could be extracted from competitor_signal + proposed_feature',
      total_score: 0,
      files_with_hits: 0,
      apps_with_hits: 0,
      top_apps: [],
      top_files: [],
      grounding_terms: [],
    };
  }

  const apps = scopeAppsForProduct(feature.product_id, applicationsDir, allApps, thresholds._scopeByProduct);
  const perAppMap = new Map();
  const rawHits = [];
  const minDistinct = thresholds.min_distinct_terms_per_file ?? 2;
  const matchers = buildTermMatchers(t);

  for (const app of apps) {
    const hits = scanApp(app.abs, matchers, { maxDepth: 8, maxFiles: 600 });
    for (const h of hits) rawHits.push({ ...h, app: app.name });
  }

  // Discrimination filter — a file only counts if it matches >= N distinct
  // terms. A single common-but-not-stop word matching a thousand lines
  // (e.g. "url") would otherwise dominate the verdict.
  const filtered = rawHits.filter((h) => (h.matched_terms || []).length >= minDistinct);

  for (const h of filtered) {
    const entry = perAppMap.get(h.app) || { app: h.app, score: 0, files: 0 };
    entry.score += h.score;
    entry.files += 1;
    perAppMap.set(h.app, entry);
  }

  const perApp = Array.from(perAppMap.values()).sort((a, b) => b.score - a.score);
  filtered.sort((a, b) => b.score - a.score);
  const totalScore = perApp.reduce((acc, a) => acc + a.score, 0);
  const filesWithHits = filtered.length;
  const appsWithHits = perApp.length;
  const allHits = filtered;

  const stats = { total_score: totalScore, files_with_hits: filesWithHits, apps_with_hits: appsWithHits };
  const { parity, reason } = verdictFor(stats, thresholds);

  return {
    id: feature.id,
    parity,
    verdict_reason: reason,
    total_score: totalScore,
    files_with_hits: filesWithHits,
    apps_with_hits: appsWithHits,
    top_apps: perApp.slice(0, 5),
    top_files: allHits.slice(0, 6).map((h) => ({
      relativePath: h.relativePath,
      app: h.app,
      score: h.score,
      matched_terms: h.matched_terms,
    })),
    grounding_terms: t,
  };
}

function toMarkdownTable(results, features) {
  const byId = new Map(features.map((f) => [f.id, f]));
  const rows = [
    '| # | Proposed feature | Parity | Score / files / apps | Top Core anchor |',
    '|---|---|---|---|---|',
  ];
  for (const r of results) {
    const f = byId.get(r.id) || {};
    const top = r.top_files[0];
    const anchor = top ? `\`${top.app}/${top.relativePath}\`` : '_(no Core match)_';
    const counts = `${r.total_score} / ${r.files_with_hits} / ${r.apps_with_hits}`;
    rows.push(`| ${r.id} | ${(f.proposed_feature || '').replace(/\|/g, '\\|').slice(0, 70)} | **${r.parity}** | ${counts} | ${anchor} |`);
  }
  rows.push('');
  rows.push(
    '_Verdict legend: ' +
      '**Existing** = score ≥ 40 AND ≥ 4 files (likely already shipped) · ' +
      '**Partial** = score ≥ 15 AND ≥ 2 files (foundation exists, scope likely incomplete) · ' +
      '**Borderline** = single-file dominance OR score 8–14 OR Existing-grade score with thin file breadth (manager review before tiering) · ' +
      '**Gap** = score < 8 (no meaningful Core presence)._',
  );
  return rows.join('\n');
}

function main() {
  const args = parseArgs(process.argv);

  if (args.saveCore) {
    const apps = validCoreRoot(args.saveCore);
    if (!apps) {
      process.stderr.write(
        `core-parity-check: --save-core path is not a valid Entrata Core checkout (no Applications/ subdir): ${args.saveCore}\n`,
      );
      process.exit(1);
    }
    writeCachedCorePath(args.saveCore);
    process.stderr.write(`core-parity-check: cached core path → ${args.saveCore}\n`);
    if (!args.in && !args.stdin && !args.selfTest) {
      process.exit(0);
    }
  }

  const { root, applicationsDir, reason, source, tried } = resolveCoreRoot(args.core);

  if (!root) {
    const features = readInput(args) || [];
    const results = features.map((f) => ({
      id: f.id,
      parity: 'Unknown',
      verdict_reason: reason,
      tried_paths: tried,
      total_score: 0,
      files_with_hits: 0,
      apps_with_hits: 0,
      top_apps: [],
      top_files: [],
      grounding_terms: [],
    }));
    process.stderr.write(
      `core-parity-check: WARN ${reason}.\n` +
        `Tried (in order):\n${tried.map((p) => `  - ${p}`).join('\n')}\n` +
        `Fix: re-run with --core <absolute path>, or set the cache once via ` +
        `\`node scripts/core-parity-check.js --save-core <path>\`.\n`,
    );
    if (args.format === 'markdown') {
      process.stdout.write(toMarkdownTable(results, features) + '\n');
    } else {
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    }
    process.exit(2);
  }

  if (source === 'auto-discovered') {
    process.stderr.write(`core-parity-check: auto-discovered Entrata Core at ${root} (cached for future runs)\n`);
  }

  const features = readInput(args);
  if (!features) {
    process.stderr.write('core-parity-check: no input. Pass --in <file>, --stdin, or --self-test.\n');
    process.exit(1);
  }

  const allApps = listAppDirs(applicationsDir);
  const effectiveThresholds = { ...args.thresholds, _scopeByProduct: args.scopeByProduct };
  const results = features.map((f) => checkOne(f, applicationsDir, allApps, effectiveThresholds));

  if (args.format === 'markdown') {
    process.stdout.write(toMarkdownTable(results, features) + '\n');
  } else {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`core-parity-check: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { checkOne, verdictFor, resolveCoreRoot, DEFAULT_THRESHOLDS };
