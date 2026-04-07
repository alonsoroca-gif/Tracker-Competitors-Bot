/**
 * Weekly intel flow: which pillars are configured per competitor, and console/API summaries.
 */

const { loadConfig } = require('./loadConfig');
const { getSourceUrls } = require('./collect');
const { summarizePillarsFromSignals } = require('./intelPillar');

/**
 * @param {object} urls — getSourceUrls(competitorId)
 * @returns {{ p1: boolean, p2: boolean, p3: boolean, p4_configured: boolean, missing_hints: string[] }}
 */
function pillarCoverageFromUrls(urls) {
  const ytKey = String(process.env.YOUTUBE_DATA_API_KEY || '').trim();
  const p1 = !!(
    urls.blog ||
    urls.press ||
    urls.changelog ||
    urls.youtube_rss ||
    urls.features_url ||
    urls.docs_url
  );
  const p2 = !!(urls.pricing_url || urls.careers_url);
  const hasYtComments = Array.isArray(urls.youtube_comment_video_ids) && urls.youtube_comment_video_ids.length > 0;
  const hasYtDiscovery =
    Array.isArray(urls.youtube_discovery_queries) &&
    urls.youtube_discovery_queries.length > 0 &&
    !!ytKey;
  const p3 = !!(urls.g2_reviews_url || hasYtComments || hasYtDiscovery);
  const p4_configured = false;

  const missing_hints = [];
  if (!p1) {
    missing_hints.push('Pillar 1 (owned): set blog, press, changelog, youtube_rss, features_url, or docs_url');
  }
  if (!p2) {
    missing_hints.push('Pillar 2 (behavioral): set pricing_url and/or careers_url');
  }
  if (!p3) {
    missing_hints.push(
      'Pillar 3 (third party): set g2_reviews_url and/or youtube_comment_video_ids and/or youtube_discovery_queries (+ YOUTUBE_DATA_API_KEY)'
    );
  }
  missing_hints.push(
    'Pillar 4 (structural): not collected by this app yet — add LinkedIn/Crunchbase/etc. manually or future integration'
  );

  return { p1, p2, p3, p4_configured, missing_hints };
}

/**
 * @returns {{ competitors: Array<{ id: string, name: string, coverage: object }>, summary: { competitors_weak_p3: string[] } } }
 */
function buildWeeklyCoverageReport() {
  const config = loadConfig();
  const competitors = config.competitors || [];
  const weakP3 = [];
  const rows = competitors.map((c) => {
    let urls = {};
    try {
      urls = getSourceUrls(c.id);
    } catch (_) {
      urls = {};
    }
    const coverage = pillarCoverageFromUrls(urls);
    if (!coverage.p3) weakP3.push(c.id);
    return {
      id: c.id,
      name: c.name || c.id,
      coverage: {
        pillar_1_configured: coverage.p1,
        pillar_2_configured: coverage.p2,
        pillar_3_configured: coverage.p3,
        pillar_4_in_app: false,
        missing_hints: coverage.missing_hints,
      },
    };
  });
  return {
    competitors: rows,
    summary: {
      competitors_weak_p3: weakP3,
      note:
        'Strong weekly insights need signals from multiple pillars. Configure P1+P2+P3 per competitor where possible.',
    },
  };
}

/**
 * @param {object[]} batchSignals — all signals returned in one collect run (before dedupe against file)
 * @param {number} retentionDays
 */
function buildLastRunIntelMeta(batchSignals, retentionDays) {
  const pillar_batch = summarizePillarsFromSignals(batchSignals);
  const coverage = buildWeeklyCoverageReport();
  return {
    retention_days: retentionDays,
    pillar_signal_counts_this_run: pillar_batch.counts,
    pillars_touched_this_run: pillar_batch.pillars_touched,
    distinct_pillars_this_run: pillar_batch.distinct_pillars,
    coverage_report: coverage,
  };
}

/** One block for terminal after `node index.js weekly`. */
function formatWeeklyFlowConsole(intelMeta, newCount, pruned) {
  const lines = [];
  lines.push('');
  lines.push('--- Weekly intel flow ---');
  lines.push(
    `This run: ${newCount} new signals stored · retention ${intelMeta.retention_days}d · kept ${pruned.kept} · dropped ${pruned.removed} (outside window)`
  );
  lines.push(
    `Pillars touched (this run): ${intelMeta.pillars_touched_this_run.length ? intelMeta.pillars_touched_this_run.join(', ') : 'none'} · counts ${JSON.stringify(intelMeta.pillar_signal_counts_this_run)}`
  );
  lines.push('Source coverage (configured URLs):');
  for (const row of intelMeta.coverage_report.competitors) {
    const c = row.coverage;
    lines.push(
      `  ${row.name}: P1=${c.pillar_1_configured ? 'yes' : 'no'} P2=${c.pillar_2_configured ? 'yes' : 'no'} P3=${c.pillar_3_configured ? 'yes' : 'no'}`
    );
  }
  lines.push(intelMeta.coverage_report.summary.note);
  lines.push('Open the report UI and use the same period (e.g. 7d) as collect for an accurate weekly view.');
  lines.push('-------------------------');
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  pillarCoverageFromUrls,
  buildWeeklyCoverageReport,
  buildLastRunIntelMeta,
  formatWeeklyFlowConsole,
};
