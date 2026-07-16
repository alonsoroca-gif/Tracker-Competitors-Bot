/**
 * Full multi-product × competitor collect + merge + prune + weekly intel meta.
 *
 * Design note: `collect()` only uses `productId` to tag the output signals — the
 * URLs fetched depend on `competitorId` only. So we call `collect()` ONCE per
 * competitor and then fan the resulting signals out across every product. This
 * avoids hammering each public URL N×products times per run, which previously
 * triggered Cloudflare/WAF rate-limits and silently zeroed RSS feeds, G2
 * reviews, and other lanes.
 */

const { loadConfig } = require('./loadConfig');
const { collect } = require('./collect');
const { writeSignals, pruneSignalsToRetentionDays } = require('./storage');
const { buildLastRunIntelMeta } = require('./weeklyIntelFlow');

/**
 * @param {number} retentionDays
 * @param {{ verbose?: boolean }} [opts]
 * @returns {Promise<{ newCount: number, pruned: { kept: number, removed: number }, batchSignals: object[], intelMeta: object }>}
 */
async function runFullCollect(retentionDays, opts = {}) {
  const d = Math.min(90, Math.max(1, parseInt(retentionDays, 10) || 7));
  const verbose = Boolean(opts.verbose);
  const config = loadConfig();
  let newCount = 0;
  const batchSignals = [];
  const session = { youtubeDiscovery: new Map(), laneResults: [] };
  const products = config.products || [];

  for (const competitor of config.competitors || []) {
    if (competitor.collect === false || competitor.alias_of) {
      if (verbose) {
        console.log(
          `Skip collect for ${competitor.id} (alias_of=${competitor.alias_of || 'n/a'})`
        );
      }
      continue;
    }

    const placeholderProductId = (products[0] && products[0].id) || '';
    const baseSignals = await collect(competitor.id, placeholderProductId, d, session);

    if (verbose) {
      console.log(
        `Collected ${baseSignals.length} base signals for ${competitor.name} (will fan out to ${products.length} products)`
      );
    }

    if (!baseSignals.length || !products.length) continue;

    for (const product of products) {
      const tagged = baseSignals.map((s) => ({ ...s, product_id: product.id }));
      batchSignals.push(...tagged);
      const { added } = writeSignals(tagged, false);
      newCount += added;
    }
  }

  const pruned = pruneSignalsToRetentionDays(d);
  const intelMeta = buildLastRunIntelMeta(batchSignals, d);
  const laneResults = session.laneResults || [];
  if (verbose) {
    const failed = laneResults.filter((r) => r.status === 'error');
    if (failed.length) {
      console.warn(`Collect lane failures (${failed.length}):`);
      for (const f of failed) {
        console.warn(`  ${f.competitor_id}/${f.lane}: ${f.error} (${f.url})`);
      }
    }
  }
  return { newCount, pruned, batchSignals, intelMeta, laneResults };
}

module.exports = { runFullCollect };
