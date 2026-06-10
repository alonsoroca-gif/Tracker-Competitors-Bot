# Slack webhooks — 10-minute setup (Alonso)

**No API key.** Incoming Webhooks only — a URL GitHub Actions POSTs to.

---

## Secrets to add (GitHub repo)

| Secret name | Audience | When it fires |
|-------------|----------|---------------|
| `SLACK_WEBHOOK_URL_OPERATOR` | You (Alonso) | 5:35am preflight · 7:45am not-ready · 8:15am still-not-ready |
| `SLACK_WEBHOOK_URL_BILLY` | Billy | 8:15am brief ready **after** his 8:20 section |
| `SLACK_WEBHOOK_URL` | Drop channel (existing) | After nightly collect push |

Workflows **skip silently** if a secret is missing.

---

## Step 1 — Create webhooks in Slack (~5 min)

1. [Slack API — Incoming Webhooks](https://api.slack.com/messaging/webhooks) → **Create New App** → **From scratch** (or use existing app).
2. Enable **Incoming Webhooks** → **Add New Webhook to Workspace**.
3. Pick channel:
   - **Operator:** `#tracker-ops` or your DM channel → copy URL → `SLACK_WEBHOOK_URL_OPERATOR`
   - **Billy:** Billy's DM or `#tracker-brief` → copy URL → `SLACK_WEBHOOK_URL_BILLY`
4. Repeat for drop channel if not already set → `SLACK_WEBHOOK_URL`

If workspace requires admin approval, post in **#ask-it-us**: _Incoming webhook for competitive-intel brief status pings._

---

## Step 2 — Add GitHub secrets (~2 min)

**GitHub** → `Tracker-Competitors-Bot` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each name + webhook URL exactly as above.

**CLI (if you use `gh`):**

```bash
gh secret set SLACK_WEBHOOK_URL_OPERATOR --body "https://hooks.slack.com/services/..."
gh secret set SLACK_WEBHOOK_URL_BILLY --body "https://hooks.slack.com/services/..."
```

---

## Step 3 — Smoke test locally (~1 min)

```bash
cd initiative-1-tracker/tracker

SLACK_WEBHOOK_URL_OPERATOR="https://hooks.slack.com/services/..." \
  npm run slack:test-operator

SLACK_WEBHOOK_URL_BILLY="https://hooks.slack.com/services/..." \
  npm run slack:test-billy
```

You should see a **Tracker webhook test** message in each channel.

---

## Step 4 — Verify in CI

**Actions** → **Tracker brief readiness** → **Run workflow** (workflow_dispatch).

With secrets set, operator channel gets a not-ready or ready message depending on `latest.json`.

**Actions** → **Tracker publish preflight** → runs 5:35am weekdays automatically after secrets exist.

---

## What Billy does

**Nothing.** Slack is wired by Alonso/IT. Billy only receives late-ready DMs if `SLACK_WEBHOOK_URL_BILLY` is set.

---

## Related

- `.github/workflows/tracker-brief-readiness.yml`
- `.github/workflows/tracker-publish-preflight.yml`
- `initiative-1-tracker/tracker/scripts/slack-brief-notify.js`
