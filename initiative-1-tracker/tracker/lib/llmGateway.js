/**
 * LLM gateway config — approved path + mode. This MVP does not POST to any model;
 * it only exposes status + supports building a minimal bundle for a future call.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'llm-gateway.json');

const DEFAULT = {
  version: 1,
  mode: 'off',
  max_bundle_json_chars: 12000,
  max_touchpoints_in_bundle: 5,
  max_excerpt_lines_per_touchpoint: 2,
  max_grounding_terms_in_bundle: 14,
};

let cache = null;

function loadLlmGatewayFile() {
  if (cache !== null) return cache;
  let file = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {
    file = {};
  }
  cache = { ...DEFAULT, ...file, version: typeof file.version === 'number' ? file.version : DEFAULT.version };
  return cache;
}

function resetLlmGatewayCacheForTests() {
  cache = null;
}

/** Normalize mode string */
function effectiveMode() {
  const file = loadLlmGatewayFile();
  const env = String(process.env.TRACKER_LLM_MODE || '').trim().toLowerCase();
  if (env === 'off' || env === 'internal_http' || env === 'http') return env;
  const m = String(file.mode || 'off').toLowerCase();
  if (m === 'internal_http' || m === 'http') return m;
  return 'off';
}

function approvedEndpointUrl() {
  return String(process.env.TRACKER_LLM_ENDPOINT || '').trim() || String(loadLlmGatewayFile().endpoint_url || '').trim();
}

/**
 * Status for API/UI — no secrets.
 * @returns {{ mode: string, endpoint_configured: boolean, outbound_implemented: boolean, note: string }}
 */
function getLlmGatewayStatus() {
  const url = approvedEndpointUrl();
  const mode = effectiveMode();
  const endpointConfigured =
    !!url && (url.startsWith('https://') || url.startsWith('http://')) && mode !== 'off';

  return {
    mode,
    endpoint_configured: endpointConfigured,
    outbound_implemented: false,
    note:
      mode === 'off'
        ? 'Gateway off — set mode + TRACKER_LLM_ENDPOINT after approval; bundle still built for review.'
 : 'Endpoint configured — outbound LLM call not wired in this build (policy + implementation next).',
  };
}

module.exports = {
  loadLlmGatewayFile,
  getLlmGatewayStatus,
  effectiveMode,
  approvedEndpointUrl,
  resetLlmGatewayCacheForTests,
};
