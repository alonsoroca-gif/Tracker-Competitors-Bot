#!/usr/bin/env node
/**
 * Slack notifications for tracker-brief readiness (operator + optional Billy late DM).
 *
 * Modes:
 *   --mode preflight     Operator — publish workload estimate
 *   --mode not-ready     Operator — brief not ready @ 7:45am (expected before morningbrief)
 *   --mode ready-late    Billy — brief became ready after 7:45am MT (during/after morningbrief)
 *   --mode ready-ok      Operator — brief ready on time (log only if no webhook)
 *
 * Env:
 *   SLACK_WEBHOOK_URL_OPERATOR — preflight / not-ready (required for those modes)
 *   SLACK_WEBHOOK_URL_BILLY    — late-ready DM channel/webhook (optional)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const trackerRoot = path.join(__dirname, '..');
const repoRoot = path.join(trackerRoot, '..', '..');
const { loadLatest, latestPath } = require('../lib/briefPaths.js');

function parseArgs(argv) {
  const args = { mode: 'not-ready', json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--mode' && argv[i + 1]) {
      args.mode = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

async function postWebhook(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Slack ${res.status}: ${txt}`);
  return txt;
}

function runPreflightJson() {
  const r = spawnSync(
    'node',
    [path.join(trackerRoot, 'scripts', 'publish-preflight.js'), '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function mtDeadlineUtcHour() {
  // 7:45am America/Denver — approximate: 13:45 UTC (MDT). Documented in workflow.
  return { hour: 13, minute: 45 };
}

function isLateReady(readyAtIso) {
  if (!readyAtIso) return false;
  const ready = new Date(readyAtIso);
  const d = new Date();
  const dl = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 45, 0));
  return ready > dl;
}

async function main() {
  const args = parseArgs(process.argv);
  const latest = loadLatest();
  const repo = process.env.GITHUB_REPOSITORY || 'Tracker Competitors Bot';

  let webhook = '';
  let text = '';
  let blocks = [];

  if (args.mode === 'preflight') {
    webhook = process.env.SLACK_WEBHOOK_URL_OPERATOR || '';
    const pf = runPreflightJson();
    if (!pf) {
      process.stderr.write('slack-brief-notify: preflight failed\n');
      process.exit(2);
    }
    text = `Tracker preflight — ${pf.run_id}: ${pf.net_new_urls} URLs to classify (~${pf.predicted_product_rows} look Product) — most often become unchanged/hidden after content-dedup + parity; est ${pf.estimated_publish_minutes}min`;
    blocks = [
      { type: 'header', text: { type: 'plain_text', text: 'Tracker publish preflight', emoji: true } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Drop*\n\`${pf.run_id}\`` },
          { type: 'mrkdwn', text: `*URLs to classify*\n${pf.net_new_urls}` },
          { type: 'mrkdwn', text: `*Vs prior drop*\n${pf.net_new_vs_prior_drop ?? '—'}` },
          { type: 'mrkdwn', text: `*Heuristic Product*\n~${pf.predicted_product_rows}` },
          { type: 'mrkdwn', text: `*Est. minutes*\n~${pf.estimated_publish_minutes}` },
          { type: 'mrkdwn', text: `*Start*\n${pf.recommended_start_mt} MT` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `${pf.note || ''}\n\n` +
            `_These counts are **intake volume before filters**. Content-hash dedup + Core parity usually hide most rows (unchanged pages / Existing in Core). A dry brief after a big preflight number is expected, not a scrape failure._`,
        },
      },
    ];
  } else if (args.mode === 'not-ready') {
    webhook = process.env.SLACK_WEBHOOK_URL_OPERATOR || '';
    text = `Tracker brief not ready @ 7:45am MT (expected) — publish starts with morningbrief ~8:00. status: ${latest?.status || 'missing'}`;
    blocks = [
      { type: 'header', text: { type: 'plain_text', text: 'Tracker — pre-morningbrief status', emoji: true } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Repo:* ${repo}\n*Run:* \`${latest?.run_id || '—'}\`\n*Status:* ${latest?.status || 'missing'}\n\n*Expected* before Billy's ~8:00 morningbrief kickoff. Publish + Core parity run in background during morningbrief.`,
        },
      },
    ];
  } else if (args.mode === 'ready-late') {
    webhook = process.env.SLACK_WEBHOOK_URL_BILLY || '';
    if (!latest || latest.status !== 'ready') {
      process.stdout.write('slack-brief-notify: skip ready-late — not ready\n');
      process.exit(0);
    }
    if (!isLateReady(latest.ready_at)) {
      process.stdout.write('slack-brief-notify: skip ready-late — was ready on time\n');
      process.exit(0);
    }
    text = `Tracker brief is ready (late) — ${latest.run_id}. Open morningbrief → tracker-feed.`;
    blocks = [
      { type: 'header', text: { type: 'plain_text', text: 'Tracker brief ready', emoji: true } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Today's competitive brief is ready.\n*Run:* \`${latest.run_id}\`\n*Prototypes:* ${latest.prototype_count ?? 0}\n\nRun **morningbrief** → tracker-feed in Cursor.`,
        },
      },
    ];
  } else if (args.mode === 'ready-ok') {
    webhook = process.env.SLACK_WEBHOOK_URL_OPERATOR || '';
    text = `Tracker brief READY on time — ${latest?.run_id}`;
    if (!latest || latest.status !== 'ready') {
      process.stdout.write('slack-brief-notify: not ready\n');
      process.exit(2);
    }
    blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `✅ *Tracker brief ready* — \`${latest.run_id}\` (${latest.net_new_count ?? '?'} net-new, ${latest.prototype_count ?? 0} prototypes)` } },
    ];
  }

  if (!webhook.trim()) {
    process.stdout.write(`slack-brief-notify: ${args.mode} — ${text} (no webhook; skip post)\n`);
    process.exit(0);
  }

  await postWebhook(webhook, { text, blocks });
  process.stdout.write(`slack-brief-notify: ${args.mode} posted\n`);
}

main().catch((err) => {
  process.stderr.write(`slack-brief-notify: ${err.message}\n`);
  process.exit(1);
});
