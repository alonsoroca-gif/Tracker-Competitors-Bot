/**
 * Format tracker-briefs for Billy (chat table + summary). Max 6 columns in chat.
 */

const { formatRoiLine } = require('./briefRoi.js');

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

/** A "changed" row whose delta scored trivial (count drift, formatting). */
function isTrivialChange(r) {
  return r.change_status === 'changed' && r.change_significance === 'trivial';
}

/**
 * Split annotated signal rows into shown vs hidden. Shown = new + material/minor
 * changes. Hidden = unchanged + trivial changes (verification gate suppresses
 * churn that does not clear the significance threshold).
 */
function splitSignalRows(rows) {
  const list = rows || [];
  const annotated = list.some((r) => r.change_status);
  if (!annotated) return { shown: list, hidden: [] };
  return {
    shown: list.filter(
      (r) => r.change_status === 'new' || (r.change_status === 'changed' && !isTrivialChange(r)),
    ),
    hidden: list.filter((r) => r.change_status === 'unchanged' || isTrivialChange(r)),
  };
}

/** Split annotated prototypes into shown (new or updated) vs hidden (unchanged carry). */
function splitPrototypes(prototypes) {
  const list = prototypes || [];
  const shown = list.filter((p) => !p.carried_over || p.changed);
  const hidden = list.filter((p) => p.carried_over && !p.changed);
  return { shown, hidden };
}

function formatSummary(manifest, latest, prototypes = null, signalsTable = null) {
  const runId = manifest.run_id || latest?.run_id || '—';
  const productRows = manifest.product_row_count ?? 0;
  const readyAt = latest?.ready_at || manifest.published_at || '—';

  // Signals: count new + changed; unchanged are suppressed from the brief.
  let signalSegment;
  let newCount = manifest.net_new_count ?? 0;
  if (Array.isArray(signalsTable) && signalsTable.some((r) => r.change_status)) {
    const { shown, hidden: hiddenRows } = splitSignalRows(signalsTable);
    newCount = shown.filter((r) => r.change_status === 'new').length;
    const changed = shown.filter((r) => r.change_status === 'changed').length;
    const hidden = hiddenRows.length;
    signalSegment = `**${newCount}** new signal(s)`;
    if (changed) signalSegment += ` · ${changed} changed`;
    if (hidden) signalSegment += ` · ${hidden} hidden`;
  } else {
    signalSegment = `**${newCount}** net-new signal(s)`;
  }

  let protoSegment;
  if (Array.isArray(prototypes)) {
    const { shown, hidden } = splitPrototypes(prototypes);
    const updated = shown.filter((p) => p.carried_over).length;
    const fresh = shown.length - updated;
    protoSegment = `**${fresh}** new prototype(s)`;
    if (updated) protoSegment += ` · ${updated} updated`;
    if (hidden.length) protoSegment += ` · ${hidden.length} unchanged hidden`;
  } else {
    protoSegment = `**${manifest.prototype_count ?? 0}** prototype(s)`;
  }

  let line =
    `**Tracker brief** — run \`${runId}\` · ${signalSegment} · ${protoSegment} · ready ${readyAt}`;

  if (productRows === 0 && newCount > 0) {
    line += ' · _0 Product rows — review classification, parity, and routing in the table below._';
  }
  return line;
}

function formatChatTable(rows) {
  const header =
    '| # | Competitor | Headline | Classification | Parity | Why / routing |';
  const sep = '|---:|---|---|---|---|---|';
  const { shown, hidden } = splitSignalRows(rows);

  if (!shown.length) {
    const quiet = hidden.length
      ? `_No new or significant changes today — ${hidden.length} page(s) hidden (unchanged or low-signal)._`
      : '_No classified rows in this brief — competitors quiet or carryover empty._';
    return [header, sep, '', quiet].join('\n');
  }

  const body = shown.map((r) => {
    const parity = r.parity_l2 || r.parity || '—';
    const classification = r.classification_detail
      ? `${r.classification} / ${r.classification_detail}`
      : r.classification || '—';
    // Flag content refreshes so the manager sees it's a re-surface, not net-new.
    const headline = r.change_status === 'changed'
      ? `(updated) ${truncate(r.headline, 45)}`
      : truncate(r.headline, 55);
    return `| ${r.id} | ${escapeCell(competitorLabel(r))} | ${escapeCell(headline)} | ${escapeCell(classification)} | ${escapeCell(parity)} | ${escapeCell(truncate(r.why_routing || r.signal_summary || r.routing, 320))} |`;
  });

  const out = [header, sep, ...body];

  // Spell out what moved on each changed signal so the manager sees the actual
  // delta, not just that something changed.
  const changedRows = shown.filter((r) => r.change_status === 'changed' && r.change_detail);
  if (changedRows.length) {
    out.push('', '**What changed**');
    for (const r of changedRows) {
      const tier = r.change_significance ? ` (${r.change_significance})` : '';
      out.push(`- ${competitorLabel(r)}${tier}: ${truncate(r.change_detail, 160)}`);
    }
  }

  if (hidden.length) {
    out.push('', `_${hidden.length} page(s) hidden — unchanged or low-signal (e.g. count drift)._`);
  }
  return out.join('\n');
}

function shippedDayLabel(p) {
  const iso = p.first_shipped_at;
  if (!iso) return p.first_shipped_run || 'a prior run';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return p.first_shipped_run || 'a prior run';
  }
}

function formatPrototypeCards(prototypes) {
  if (!prototypes.length) return '';
  const { shown, hidden } = splitPrototypes(prototypes);

  // Nothing worth surfacing: only unchanged carry-forwards. Keep it to one
  // muted line so the brief isn't cluttered with the same prototype every day.
  if (!shown.length) {
    if (!hidden.length) return '';
    return [
      '### Prototypes',
      '',
      `_No new prototypes today. ${hidden.length} unchanged prototype(s) hidden (e.g. ${hidden[0].title}, first shipped ${shippedDayLabel(hidden[0])})._`,
    ].join('\n');
  }

  const lines = ['### Prototypes', ''];
  for (const p of shown) {
    const tag = p.carried_over && p.changed ? ' (updated)' : '';
    lines.push(`- **${p.title}**${tag} (${p.competitor || p.competitor_id}) — \`${p.preview_path || p.html_path}\``);
    if (p.brief?.what) lines.push(`  - What: ${truncate(p.brief.what, 120)}`);
    if (p.roi) lines.push(`  - ROI: ${formatRoiLine(p.roi)}`);
    if (p.roi?.numbers?.formula) lines.push(`  - Math: ${truncate(p.roi.numbers.formula, 90)}`);
    if (p.prd_path) lines.push(`  - PRD: \`${p.prd_path}\``);
  }

  if (hidden.length) {
    lines.push('');
    lines.push(`_${hidden.length} unchanged prototype(s) hidden — already shipped, no change._`);
  }

  lines.push('');
  lines.push('_Viewer: opens in **Cursor Simple Browser** via `npm run brief:open-viewer`_');
  return lines.join('\n');
}

function formatFeedMarkdown({ manifest, latest, signalsTable, prototypes }) {
  const blocks = [
    formatSummary(manifest, latest, prototypes, signalsTable),
    '',
    '### Competitor signals (new + changed)',
    '',
    formatChatTable(signalsTable),
  ];

  const cards = formatPrototypeCards(prototypes || []);
  if (cards) {
    blocks.push('', cards);
  }

  blocks.push(
    '',
    '### Detail',
    '',
    'Full parity audit and wide table: `npm run brief:open-viewer --prefix initiative-1-tracker/tracker` (or Simple Browser → `tracker-briefs/viewer/index.html`).',
  );

  return blocks.join('\n');
}

function formatNotReady(latest, { stale = false, todayMt = null, readyDayMt = null } = {}) {
  const status = latest?.status || 'not_ready';
  const runId = latest?.run_id || '(unknown)';
  if (stale) {
    return `**Tracker brief not ready for today** — latest brief (\`${runId}\`, ready ${latest?.ready_at || '—'}) is from **${readyDayMt || 'yesterday'}** MT. Today's publish (${todayMt || 'today'} MT) has not run yet. Do not show yesterday's brief.`;
  }
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
  splitSignalRows,
  formatSummary,
  formatChatTable,
  formatPrototypeCards,
  formatFeedMarkdown,
  formatNotReady,
};
