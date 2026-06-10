# Alonso — Slack webhooks (manual steps only)

Everything else is automated in repo scripts + GitHub Actions. **You only do Slack UI + paste URLs once.**

---

## What you do (≈10 min)

### Step 1 — Operator webhook (you get pinged)

1. Open Slack → [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name: `Tracker Brief Ops` · Workspace: Entrata
3. **Incoming Webhooks** → toggle **On** → **Add New Webhook to Workspace**
4. Pick channel: your ops channel or **DM to yourself** (e.g. `#tracker-ops`)
5. **Copy** the URL (`https://hooks.slack.com/services/T…/B…/…`)

**Save as:** `OPERATOR_URL` (clipboard)

---

### Step 2 — Billy webhook (late-ready ping)

1. Same app → **Add New Webhook to Workspace** again
2. Pick: Billy's DM or `#tracker-brief` (whatever he will watch)
3. **Copy** the second URL

**Save as:** `BILLY_URL` (clipboard)

---

### Step 3 — Paste URLs to terminal (or tell Cursor agent)

From Tracker repo root, run **once** (agent can run this for you after you paste URLs):

```bash
cd initiative-1-tracker/tracker

gh secret set SLACK_WEBHOOK_URL_OPERATOR -R alonsoroca-gif/Tracker-Competitors-Bot -b "PASTE_OPERATOR_URL"

gh secret set SLACK_WEBHOOK_URL_BILLY -R alonsoroca-gif/Tracker-Competitors-Bot -b "PASTE_BILLY_URL"
```

Optional — drop channel (if not already set):

```bash
gh secret set SLACK_WEBHOOK_URL -R alonsoroca-gif/Tracker-Competitors-Bot -b "PASTE_DROP_URL"
```

---

### Step 3b — Brief opener (one-time, for tracker-feed `--open`)

```bash
cd initiative-1-tracker/tracker
npm run brief:install-opener
```

Reload Cursor. Required so morningbrief opens the viewer in Simple Browser, not external Chrome.

---

### Step 4 — Smoke test (automated — agent runs)

```bash
SLACK_WEBHOOK_URL_OPERATOR="…" npm run slack:test-operator
SLACK_WEBHOOK_URL_BILLY="…" npm run slack:test-billy
```

You should see **Tracker webhook test** in each channel.

---

### Step 5 — Verify CI (automated)

GitHub → **Actions** → **Tracker brief readiness** → **Run workflow**

Operator channel gets a status message (not-ready is normal before 8am publish).

---

## What you do NOT need

- Slack API key / bot token / OAuth
- Billy to configure anything
- Code changes — workflows already wired

---

## If IT blocks Incoming Webhooks

Post in **#ask-it-us**: _Incoming webhook for competitive-intel brief status (read-only POST to channel). No bot scopes._

Until approved, workflows skip Slack silently — brief factory still works.
