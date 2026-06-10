/**
 * Layer 2 — structured Core search prompts (GitHub or local anchors).
 */

const { getAppInventory } = require('./appInventory.js');

const EXISTS_MAP = {
  Existing: 'Yes',
  Partial: 'Partial',
  Borderline: 'Partial',
  Gap: 'No',
  Unknown: 'Unknown',
};

function scopeAppsForPrompt(productId, defaultApps) {
  if (!productId) return defaultApps;
  const inventory = getAppInventory(productId);
  if (!inventory || !inventory.configured) return defaultApps;
  const names = inventory.artifacts
    .map((a) => a.repo_root)
    .filter(Boolean)
    .map((p) => {
      const parts = String(p).split(/[/\\]/);
      return parts[parts.length - 1] || parts[parts.length - 2];
    });
  return names.length ? names : defaultApps;
}

function buildCodeScanPrompt(feature, result, ctx) {
  const scoped = (ctx.scopedApps || []).join(', ');
  const source = ctx.source === 'github' ? 'GitHub' : 'local workspace';
  const rootLabel = ctx.coreRoot || ctx.githubRepo || '(Core)';
  const fileList =
    (result.top_files || [])
      .slice(0, 5)
      .map((h) => {
        const loc = h.github_url || `${h.app}/${h.relativePath}`;
        return `- \`${loc}\` (terms: ${(h.matched_terms || []).join(', ')})`;
      })
      .join('\n') || '- _(none from Layer 1)_';

  return [
    '## Core parity — Layer 2 (agent Core search)',
    '',
    `Search **Entrata Core** via **${source}** at \`${rootLabel}\` (ref \`${ctx.ref || 'main'}\`).`,
    `Prefer: \`Applications/{${scoped}}\``,
    '',
    '### Feature',
    `- **Proposed:** ${feature.proposed_feature || '(none)'}`,
    `- **Competitor signal:** ${feature.competitor_signal || '(none)'}`,
    `- **Layer 1 verdict:** ${result.parity} (score ${result.total_score} / ${result.files_with_hits} files / ${result.apps_with_hits} apps)`,
    '',
    '### Layer 1 anchors (verify or overturn)',
    fileList,
    '',
    '### Answer (required)',
    '1. **Exists in Core?** Yes | Partial | No',
    '2. **Files/modules** — paths + one-line role each',
    '3. **If Partial** — what is missing vs competitor signal?',
    '4. **Effort to close gap** — S | M | L',
    '',
    'Layer 2 wins on conflict with Layer 1 for tiering.',
  ].join('\n');
}

function buildFeatureAudit(feature, result, ctx) {
  const scopedApps = scopeAppsForPrompt(feature.product_id, ctx.productAppNames || []);
  return {
    exists_in_core: EXISTS_MAP[result.parity] || 'Unknown',
    keyword_verdict: result.parity,
    code_scan_required: true,
    code_scan_scoped_apps: scopedApps,
    code_scan_prompt: buildCodeScanPrompt(feature, result, { ...ctx, scopedApps }),
  };
}

module.exports = {
  buildFeatureAudit,
  buildCodeScanPrompt,
  scopeAppsForPrompt,
};
