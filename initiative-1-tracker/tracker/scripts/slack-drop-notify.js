#!/usr/bin/env node
/**
 * Build Slack Incoming Webhook payload from the latest tracker-drops run + POST it.
 * Env: SLACK_WEBHOOK_URL (required). Optional: DROP_COMMIT_URL (link to GitHub commit).
 *
 * Run from repo root after a drop commit:
 *   DROP_COMMIT_URL=https://github.com/org/repo/commit/abc node initiative-1-tracker/tracker/scripts/slack-drop-notify.js
 */

const fs = require('fs');
const path = require('path');

const trackerRoot = path.join(__dirname, '..');
const initiativeRoot = path.join(trackerRoot, '..');
const repoRoot = path.join(initiativeRoot, '..');
const dropsRoot = path.join(repoRoot, 'tracker-drops');

function loadLatestDropDir() {
  const idFile = path.join(dropsRoot, '.latest-drop-id');
  if (fs.existsSync(idFile)) {
    const runId = fs.readFileSync(idFile, 'utf8').trim().split(/\r?\n/)[0];
    if (runId) {
      const dir = path.join(dropsRoot, runId);
      if (fs.existsSync(dir)) return dir;
    }
  }
  const dirs = fs
    .readdirSync(dropsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => path.join(dropsRoot, d.name))
    .filter((p) => fs.existsSync(path.join(p, 'manifest.json')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

async function main() {
  const webhook = process.env.SLACK_WEBHOOK_URL || '';
  if (!webhook.trim()) {
    console.error('slack-drop-notify: SLACK_WEBHOOK_URL is not set.');
    process.exit(1);
  }

  const dropDir = loadLatestDropDir();
  if (!dropDir) {
    console.error('slack-drop-notify: no tracker-drops/* folder found.');
    process.exit(1);
  }

  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dropDir, 'manifest.json'), 'utf8'));
  } catch (_) {}

  let signals = [];
  try {
    const raw = fs.readFileSync(path.join(dropDir, 'signals.json'), 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) signals = arr;
  } catch (_) {}

  const repo = process.env.GITHUB_REPOSITORY || 'repository';
  const commitUrl = process.env.DROP_COMMIT_URL || '';
  const top = signals.slice(-15).reverse();

  const lines = top.map((s) => {
    const who = s.competitor_id || '?';
    const src = s.source || s.type || 'signal';
    const sn = truncate(s.snippet || s.headline || '', 140);
    return `• *${who}* (${src}) — ${sn}`;
  });

  const fallback =
    `Tracker drop: ${manifest.run_id || path.basename(dropDir)} · +${manifest.new_signals_added ?? '?'} new signals · ${repo}` +
    (commitUrl ? ` · ${commitUrl}` : '');

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📌 New competitor tracker drop', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Repo*\n${repo}` },
        {
          type: 'mrkdwn',
          text: `*New signals this run*\n${manifest.new_signals_added ?? '—'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Run id*\n\`${manifest.run_id || path.basename(dropDir)}\``,
        },
        {
          type: 'mrkdwn',
          text: `*When*\n${manifest.created_at || '—'}`,
        },
      ],
    },
  ];

  if (commitUrl) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Commit / pull in Cursor:*\n<${commitUrl}|Open on GitHub>`,
      },
    });
  }

  if (lines.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Latest signals (sample)*\n${lines.join('\n')}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text:
          'Managers: `git pull` this branch → open `tracker-drops/` → read `SUMMARY.md` + Cursor per TRACKER-FLOW-END-TO-END.md.',
      },
    ],
  });

  const payload = { text: fallback, blocks };

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  if (!res.ok) {
    console.error('Slack webhook error:', res.status, txt);
    process.exit(1);
  }
  console.log('slack-drop-notify: ok', res.status, txt || '(empty body)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
