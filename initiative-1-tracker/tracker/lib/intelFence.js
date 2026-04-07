/**
 * Intel “fence” MVP: caps + light redaction on repo-derived content surfaced in the tracker API.
 * LLM / outbound enrichment stays off by default — see config/intel-fence.json and TRACKER_LLM_ENRICHMENT.
 */

const fs = require('fs');
const path = require('path');
const { isSignalsEncryptionEnabled } = require('./signalsAtRest');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'intel-fence.json');

const DEFAULT = {
  version: 1,
  llm_enrichment_enabled: false,
  max_chars_per_repo_snippet: 160,
  max_repo_snippets_per_hit: 4,
  max_touchpoints_in_response: 10,
  max_repo_scan_files: 120,
  max_repo_scan_file_bytes: 120000,
  max_gap_text_blob_chars: 900,
  redact_secrets: true,
};

/** High-signal patterns only — conservative; avoids heavy false positives. */
const REDACT_PATTERNS = [
  { re: /\bAKIA[0-9A-Z]{16}\b/gi, rep: '[redacted]' },
  { re: /\b(sk_live_[a-zA-Z0-9]{20,})\b/g, rep: '[redacted]' },
  { re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, rep: 'Bearer [redacted]' },
  {
    re: /\b(api[_-]?key|apikey|client_secret|password|secret|token)\s*[:=]\s*['"]?[^\s'",)]{8,}/gi,
    rep: '[redacted]',
  },
];

let cache = null;

function loadIntelFenceConfig() {
  if (cache !== null) return cache;
  let file = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {
    file = {};
  }
  const envLlm = String(process.env.TRACKER_LLM_ENRICHMENT || '').toLowerCase();
  const llmFromEnv = envLlm === '1' || envLlm === 'true' || envLlm === 'yes';

  cache = {
    ...DEFAULT,
    ...file,
    version: typeof file.version === 'number' ? file.version : DEFAULT.version,
    llm_enrichment_enabled: file.llm_enrichment_enabled === true || llmFromEnv,
  };
  return cache;
}

/** @internal tests */
function resetIntelFenceCacheForTests() {
  cache = null;
}

function clip(s, n) {
  if (s.length <= n) return s;
  return `${s.slice(0, Math.max(0, n - 1))}…`;
}

/**
 * @param {string} text
 * @param {Partial<typeof DEFAULT>} [cfgOverride] merged on top of loaded fence config
 */
function sanitizeRepoSnippetText(text, cfgOverride) {
  const c = { ...loadIntelFenceConfig(), ...cfgOverride };
  const max = c.max_chars_per_repo_snippet ?? DEFAULT.max_chars_per_repo_snippet;
  let s = String(text || '').trim();
  if (c.redact_secrets) {
    for (const { re, rep } of REDACT_PATTERNS) {
      s = s.replace(re, rep);
    }
  }
  return clip(s, max);
}

/**
 * Cap touchpoint count and sanitize every repo snippet line before JSON hits the browser.
 * @param {object[]} touchpoints
 * @returns {object[]}
 */
function applyFenceToTouchpoints(touchpoints) {
  const cfg = loadIntelFenceConfig();
  const list = Array.isArray(touchpoints) ? touchpoints : [];
  const n = Math.min(list.length, cfg.max_touchpoints_in_response ?? DEFAULT.max_touchpoints_in_response);
  const slice = list.slice(0, n);
  const maxSnip = cfg.max_repo_snippets_per_hit ?? DEFAULT.max_repo_snippets_per_hit;

  return slice.map((h) => ({
    ...h,
    snippets: Array.isArray(h.snippets)
      ? h.snippets.slice(0, maxSnip).map((sn) => ({
          ...sn,
          text: sanitizeRepoSnippetText(sn.text, cfg),
        }))
      : [],
  }));
}

/**
 * Small object for API consumers (no secrets).
 */
function fenceMetaForApi() {
  const cfg = loadIntelFenceConfig();
  return {
    version: cfg.version,
    llm_enrichment_enabled: !!cfg.llm_enrichment_enabled,
    repo_snippets_redacted: !!cfg.redact_secrets,
    max_chars_per_repo_snippet: cfg.max_chars_per_repo_snippet,
    signals_encrypted_at_rest: isSignalsEncryptionEnabled(),
  };
}

module.exports = {
  loadIntelFenceConfig,
  sanitizeRepoSnippetText,
  applyFenceToTouchpoints,
  fenceMetaForApi,
  resetIntelFenceCacheForTests,
};
