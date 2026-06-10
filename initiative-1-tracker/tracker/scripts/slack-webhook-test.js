#!/usr/bin/env node
/**
 * Smoke-test Slack Incoming Webhooks (no API key — URL only).
 *
 * Usage:
 *   SLACK_WEBHOOK_URL_OPERATOR=https://hooks.slack.com/... node scripts/slack-webhook-test.js --target operator
 *   SLACK_WEBHOOK_URL_BILLY=https://hooks.slack.com/... node scripts/slack-webhook-test.js --target billy
 */

const TARGETS = {
  operator: 'SLACK_WEBHOOK_URL_OPERATOR',
  billy: 'SLACK_WEBHOOK_URL_BILLY',
  drop: 'SLACK_WEBHOOK_URL',
};

function parseArgs(argv) {
  const args = { target: 'operator' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--target' && argv[i + 1]) {
      args.target = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const envKey = TARGETS[args.target];
  if (!envKey) {
    process.stderr.write(`slack-webhook-test: unknown target ${args.target}\n`);
    process.exit(2);
  }

  const webhook = process.env[envKey] || '';
  if (!webhook.trim()) {
    process.stderr.write(`slack-webhook-test: set ${envKey} in env\n`);
    process.exit(2);
  }

  const text =
    args.target === 'billy'
      ? 'Tracker brief test ping (Billy) — if you see this, late-ready Slack is wired.'
      : 'Tracker brief test ping (operator) — if you see this, operator Slack is wired.';

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Tracker webhook test', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*Target:* \`${args.target}\`\n${text}` } },
      ],
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    process.stderr.write(`slack-webhook-test: ${res.status} ${body}\n`);
    process.exit(1);
  }

  process.stdout.write(`slack-webhook-test: posted to ${args.target} (${envKey})\n`);
}

main().catch((err) => {
  process.stderr.write(`slack-webhook-test: ${err.message}\n`);
  process.exit(1);
});
