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
  const session = { youtubeDiscovery: new Map() };
  const products = config.products || [];

  for (const competitor of config.competitors || []) {
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
  return { newCount, pruned, batchSignals, intelMeta };
}

module.exports = { runFullCollect };
