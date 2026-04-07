/**
 * Full multi-product × competitor collect + merge + prune + weekly intel meta.
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

  for (const product of config.products || []) {
    for (const competitor of config.competitors || []) {
      const signals = await collect(competitor.id, product.id, d, session);
      batchSignals.push(...signals);
      if (verbose) {
        console.log(`Collected ${signals.length} signals for ${competitor.name} / ${product.id}`);
      }
      if (signals.length > 0) {
        const { added } = writeSignals(signals, false);
        newCount += added;
      }
    }
  }

  const pruned = pruneSignalsToRetentionDays(d);
  const intelMeta = buildLastRunIntelMeta(batchSignals, d);
  return { newCount, pruned, batchSignals, intelMeta };
}

module.exports = { runFullCollect };
