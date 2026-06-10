/**
 * Format tracker-briefs for Billy (chat table + summary). Max 6 columns in chat.
 */

const COMPETITOR_NAMES = {
  eliseai: 'EliseAI',
  'funnel-leasing': 'Funnel Leasing',
  leasehawk: 'LeaseHawk (ACE)',
  'anyone-home': 'Anyone Home',
  jonah: 'Jonah',
  rentvision: 'RentVision',
};

function competitorLabel(row) {
  return row.competitor || COMPETITOR_NAMES[row.competitor_id] || row.competitor_id || '—';
}

function truncate(text, max = 72) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function escapeCell(text) {
  return String(text || '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatSummary(manifest, latest) {
  const runId = manifest.run_id || latest?.run_id || '—';
  const netNew = manifest.net_new_count ?? 0;
  const prototypes = manifest.prototype_count ?? 0;
  const productRows = manifest.product_row_count ?? 0;
  const readyAt = latest?.ready_at || manifest.published_at || '—';

  let line =
    `**Tracker brief** — run \`${runId}\` · **${netNew}** net-new signal(s) · **${prototypes}** prototype(s) · ready ${readyAt}`;

  if (productRows === 0 && netNew > 0) {
    line += ' · _0 Product rows — review classification, parity, and routing in the table below._';
  }
  return line;
}

function formatChatTable(rows) {
  if (!rows.length) {
    return '_No net-new signals in this brief._';
  }

  const header =
    '| # | Competitor | Headline | Classification | Parity | Why / routing |';
  const sep = '|---:|---|---|---|---|---|';

  const body = rows.map((r) => {
    const parity = r.parity_l2 || r.parity || '—';
    const classification = r.classification_detail
      ? `${r.classification} / ${r.classification_detail}`
      : r.classification || '—';
    return `| ${r.id} | ${escapeCell(competitorLabel(r))} | ${escapeCell(truncate(r.headline, 55))} | ${escapeCell(classification)} | ${escapeCell(parity)} | ${escapeCell(truncate(r.why_routing || r.routing, 60))} |`;
  });

  return [header, sep, ...body].join('\n');
}

function formatPrototypeCards(prototypes) {
  if (!prototypes.length) return '';
  const lines = ['### Prototypes', ''];
  for (const p of prototypes) {
    lines.push(`- **${p.title}** (${p.competitor || p.competitor_id}) — \`${p.preview_path || p.html_path}\``);
    if (p.prd_path) lines.push(`  - PRD: \`${p.prd_path}\``);
  }
  lines.push('');
  lines.push('_Open **Simple Browser** → `tracker-briefs/viewer/index.html` to scroll all prototypes._');
  return lines.join('\n');
}

function formatFeedMarkdown({ manifest, latest, signalsTable, prototypes }) {
  const blocks = [
    formatSummary(manifest, latest),
    '',
    '### Competitor signals (net-new)',
    '',
    formatChatTable(signalsTable),
  ];

  const cards = formatPrototypeCards(prototypes);
  if (cards) {
    blocks.push('', cards);
  }

  blocks.push(
    '',
    '### Detail',
    '',
    'Full parity audit and wide table: open `tracker-briefs/viewer/index.html` in Cursor Simple Browser.',
  );

  return blocks.join('\n');
}

function formatNotReady(latest) {
  const status = latest?.status || 'not_ready';
  const runId = latest?.run_id || '(unknown)';
  if (status === 'publishing') {
    return `**Tracker brief not ready** — publish in progress for \`${runId}\`. Check again shortly; late runs DM via Slack when ready.`;
  }
  if (status === 'failed') {
    return `**Tracker brief failed** for \`${runId}\`. ${latest?.error || 'See publish log.'}`;
  }
  return `**Tracker brief not ready** — \`${runId}\` is not published yet (status: ${status}).`;
}

module.exports = {
  competitorLabel,
  formatSummary,
  formatChatTable,
  formatPrototypeCards,
  formatFeedMarkdown,
  formatNotReady,
};
