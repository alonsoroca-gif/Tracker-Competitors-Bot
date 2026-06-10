/**
 * Layer 1 parity via GitHub: recursive tree listing + selective file fetch @ ref=main.
 */

const { ParityGitHubClient } = require('./parityGitHubClient.js');
const { buildFeatureAudit } = require('./parityCodeScan.js');
const {
  verdictFor,
  DEFAULT_THRESHOLDS,
  buildTermMatchers,
  scoreFile,
  termsForFeature,
  scopeAppsForProduct,
} = require('../scripts/core-parity-check.js');

const MAX_FILE_BYTES = 200000;

async function scanAppGitHub(client, app, matchers, thresholds) {
  const tree = await client.getRecursiveTree();
  const paths = client.selectAppFilePaths(tree, app.prefix, {
    maxDepth: 8,
    maxFiles: 600,
  });

  const hits = [];
  const pathList = paths.map((p) => p.path);
  const contents = await client.fetchFilesBatch(pathList, 8);
  const minDistinct = thresholds.min_distinct_terms_per_file ?? 2;
  const maxFileScore = thresholds.max_file_score ?? 15;

  for (const meta of paths) {
    let buf = contents.get(meta.path);
    if (buf == null) continue;
    if (buf.length > MAX_FILE_BYTES) buf = buf.slice(0, MAX_FILE_BYTES);
    const { score, matched_terms } = scoreFile(buf, matchers);
    if (score <= 0) continue;
    if ((matched_terms || []).length < minDistinct) continue;
    const capped = maxFileScore > 0 ? Math.min(score, maxFileScore) : score;
    hits.push({
      relativePath: meta.relativePath,
      app: app.name,
      score: capped,
      matched_terms,
      github_url: client.blobUrl(meta.path),
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits;
}

async function checkOneGitHub(feature, client, allApps, thresholds) {
  const t = termsForFeature(feature);
  if (!t.length) {
    const empty = {
      id: feature.id,
      parity: 'Unknown',
      verdict_reason: 'No search terms could be extracted from competitor_signal + proposed_feature',
      total_score: 0,
      files_with_hits: 0,
      apps_with_hits: 0,
      top_apps: [],
      top_files: [],
      grounding_terms: [],
      parity_source: 'github',
      github_ref: client.ref,
    };
    empty.feature_audit = buildFeatureAudit(feature, empty, {
      source: 'github',
      githubRepo: `${client.owner}/${client.repo}`,
      ref: client.ref,
      productAppNames: allApps.map((a) => a.name),
    });
    return empty;
  }

  const apps = scopeAppsForProduct(
    feature.product_id,
    null,
    allApps,
    thresholds._scopeByProduct,
  );
  const matchers = buildTermMatchers(t);
  const perAppMap = new Map();
  const rawHits = [];

  for (const app of apps) {
    const hits = await scanAppGitHub(client, app, matchers, thresholds);
    for (const h of hits) rawHits.push(h);
  }

  const filtered = rawHits;
  for (const h of filtered) {
    const entry = perAppMap.get(h.app) || { app: h.app, score: 0, files: 0 };
    entry.score += h.score;
    entry.files += 1;
    perAppMap.set(h.app, entry);
  }

  const perApp = Array.from(perAppMap.values()).sort((a, b) => b.score - a.score);
  filtered.sort((a, b) => b.score - a.score);
  const totalScore = perApp.reduce((acc, a) => acc + a.score, 0);
  const stats = {
    total_score: totalScore,
    files_with_hits: filtered.length,
    apps_with_hits: perApp.length,
  };
  const { parity, reason } = verdictFor(stats, thresholds);

  const row = {
    id: feature.id,
    parity,
    verdict_reason: reason,
    total_score: totalScore,
    files_with_hits: filtered.length,
    apps_with_hits: perApp.length,
    top_apps: perApp.slice(0, 5),
    top_files: filtered.slice(0, 6).map((h) => ({
      relativePath: h.relativePath,
      app: h.app,
      score: h.score,
      matched_terms: h.matched_terms,
      github_url: h.github_url,
    })),
    grounding_terms: t,
    parity_source: 'github',
    github_ref: client.ref,
    github_repo: `${client.owner}/${client.repo}`,
  };

  row.feature_audit = buildFeatureAudit(feature, row, {
    source: 'github',
    githubRepo: row.github_repo,
    ref: client.ref,
    productAppNames: allApps.map((a) => a.name),
  });

  return row;
}

async function runGitHubParityBatch(features, opts = {}) {
  const client = new ParityGitHubClient(opts);
  if (!client.configured()) {
    throw new Error(client.missingReason());
  }

  const tree = await client.getRecursiveTree();
  const allApps = client.listApplicationNames(tree);
  const thresholds = { ...DEFAULT_THRESHOLDS, ...opts.thresholds, _scopeByProduct: opts.scopeByProduct };

  const results = [];
  for (const f of features) {
    results.push(await checkOneGitHub(f, client, allApps, thresholds));
  }
  return { results, client, allApps };
}

module.exports = {
  checkOneGitHub,
  runGitHubParityBatch,
  scanAppGitHub,
};
