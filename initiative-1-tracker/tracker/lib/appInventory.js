/**
 * Resolve local Entrata app versions from package.json and/or composer.json (prototype).
 * @see ../docs/APP-INVENTORY-AND-STRUCTURED-WHAT-TO-CHANGE.md
 */

const path = require('path');
const fs = require('fs');
const { getProductVoice } = require('./productContext');

const INVENTORY_PATH = path.join(__dirname, '..', 'config', 'app-inventory.json');

function expandEnvInPath(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => process.env[name] || '');
}

function readPackageMeta(absPath) {
  try {
    if (!absPath || !fs.existsSync(absPath)) {
      return { version: null, name: null, error: 'path_missing' };
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    const pkg = JSON.parse(raw);
    return {
      version: typeof pkg.version === 'string' ? pkg.version : null,
      name: typeof pkg.name === 'string' ? pkg.name : null,
      error: null,
    };
  } catch (e) {
    return { version: null, name: null, error: e.message };
  }
}

function readComposerMeta(absPath) {
  try {
    if (!absPath || !fs.existsSync(absPath)) {
      return { version: null, name: null, error: 'path_missing' };
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    const c = JSON.parse(raw);
    return {
      version: typeof c.version === 'string' ? c.version : null,
      name: typeof c.name === 'string' ? c.name : null,
      error: null,
    };
  } catch (e) {
    return { version: null, name: null, error: e.message };
  }
}

function readManifestMeta(absPath) {
  if (!absPath) return { version: null, name: null, error: 'path_missing', kind: null };
  const lower = absPath.toLowerCase();
  if (lower.endsWith('composer.json')) {
    const m = readComposerMeta(absPath);
    return { ...m, kind: 'composer' };
  }
  const m = readPackageMeta(absPath);
  return { ...m, kind: 'npm' };
}

/**
 * Resolve absolute path to a manifest file (package.json or composer.json).
 * @returns {{ abs: string, kind: 'npm'|'composer' }|null}
 */
function resolveManifestFile(row) {
  const compRel = expandEnvInPath(String(row.composer_json || '').trim());
  const pkgRel = expandEnvInPath(String(row.package_json || '').trim());
  const rootRel = expandEnvInPath(String(row.repo_root || '').trim());

  const toAbs = (rel) => (path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel));

  if (compRel) {
    return { abs: toAbs(compRel), kind: 'composer' };
  }
  if (pkgRel) {
    return { abs: toAbs(pkgRel), kind: 'npm' };
  }
  if (rootRel) {
    const rootAbs = toAbs(rootRel);
    const pj = path.join(rootAbs, 'package.json');
    const cj = path.join(rootAbs, 'composer.json');
    if (fs.existsSync(pj)) return { abs: pj, kind: 'npm' };
    if (fs.existsSync(cj)) return { abs: cj, kind: 'composer' };
    return null;
  }
  return null;
}

/**
 * @returns {{ product_id: string, artifacts: Array<object>, configured: boolean }}
 */
function getAppInventory(productId) {
  const pid = String(productId || '').trim();
  let data = {};
  try {
    if (fs.existsSync(INVENTORY_PATH)) {
      data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    }
  } catch (_) {
    return { product_id: pid, artifacts: [], configured: false };
  }

  const entry = data[pid];
  const rawList = entry && Array.isArray(entry.artifacts) ? entry.artifacts : [];
  const artifacts = [];

  for (const row of rawList) {
    if (!row || typeof row !== 'object') continue;
    const label = String(row.label || 'App').trim() || 'App';
    const rootRel = expandEnvInPath(String(row.repo_root || '').trim());
    const resolved = resolveManifestFile(row);
    if (!resolved) continue;

    const meta = readManifestMeta(resolved.abs);
    const repoRootExpanded = rootRel
      ? path.isAbsolute(rootRel)
        ? rootRel
        : path.resolve(process.cwd(), rootRel)
      : null;

    artifacts.push({
      label,
      manifest_path: resolved.abs,
      manifest_kind: meta.kind || resolved.kind,
      /** @deprecated use manifest_path — kept for older readers */
      package_json: resolved.abs,
      repo_root: repoRootExpanded,
      version: meta.version,
      package_name: meta.name,
      error: meta.error,
    });
  }

  return {
    product_id: pid,
    artifacts,
    configured: artifacts.length > 0,
  };
}

function formatInventoryOneLine(inventory) {
  if (!inventory || !inventory.artifacts || !inventory.artifacts.length) {
    return '';
  }
  return inventory.artifacts
    .map((a) => {
      if (a.version) return `${a.label}@${a.version}`;
      if (a.package_name) return `${a.label} (${a.package_name})`;
      if (a.error === 'path_missing') return `${a.label}:(path missing)`;
      return `${a.label}:(no version in manifest)`;
    })
    .join(' · ');
}

/**
 * Prototype structured work items for PM/eng handoff (not legal advice; not auto-PRs).
 * @param {string} [productId] — tracker product id for personalized titles
 */
function buildStructuredWorkItems(gap, inventory, productId) {
  const invLine = formatInventoryOneLine(inventory);
  const dim = gap.dimension || 'features';
  const move = (gap.competitor_move || gap.title || '').slice(0, 200);
  const { display_name: productLabel } = getProductVoice(productId || '');

  return [
    {
      id: 'align',
      kind: 'product_alignment',
      title: `Triage this move vs ${productLabel} (${dim}) roadmap`,
      competitor_move_hint: move,
      use_inventory: invLine || 'Add repo_root / composer.json paths in config/app-inventory.json (see ENTRATA_MONO_ROOT).',
    },
    {
      id: 'verify',
      kind: 'engineering_verify',
      title: `Verify ${productLabel} shipped behavior vs versions in app inventory`,
      inventory_snapshot: invLine || 'Inventory empty — wire local repo paths first.',
    },
    {
      id: 'respond',
      kind: 'go_to_market',
      title: `Draft ${productLabel} GTM response (messaging, pricing story, or scope)`,
      gap_dimension: dim,
      our_state: gap.our_gap || '',
    },
  ];
}

module.exports = {
  getAppInventory,
  formatInventoryOneLine,
  buildStructuredWorkItems,
};
