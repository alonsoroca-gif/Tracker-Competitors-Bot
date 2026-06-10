# Slack Incoming Webhook — IT / admin request (copy-paste)

Use this in **#ask-it-us** or your Slack app approval flow when requesting **Incoming Webhooks** for the Tracker Competitors Bot.

---

## Short version (ticket subject / first line)

> Request Incoming Webhook approval for **Tracker Competitors Bot** — automated competitive-intel status pings to operator + PM (no bot token, POST-only).

---

## Full message (paste into IT ticket or Slack admin thread)

**App name:** Tracker Brief Ops (or reuse existing internal notifications app)

**What we're requesting**

- Install / approve **Incoming Webhooks** for our GitHub repo **Tracker-Competitors-Bot**
- Two webhook URLs (can be same Slack app, two channels):
  1. **Operator channel** — Alonso / competitive-intel owner
  2. **PM channel** — Billy (morning brief consumer)

**What it is NOT**

- Not a Slack bot with OAuth scopes or channel read access
- Not posting on behalf of users or reading messages
- Not an "agent" — only **outbound POST** when GitHub Actions runs on a schedule

**Why this helps the team**

Our **Tracker Competitors Bot** runs overnight on GitHub Actions (5:45am) to collect competitor product signals (EliseAI, Funnel, Jonah, etc.). Each weekday morning (~8:00am MT), a publish step turns those signals into a **Tracker brief** — classification, Core parity, prototypes, and ROI — for product leadership.

Without Slack, failures and timing are invisible until someone manually checks GitHub. With Incoming Webhooks:

| Ping | Who | When | Benefit |
|------|-----|------|---------|
| **Preflight** | Operator | 5:35am | "Today's drop has N net-new URLs, est. ~20min publish" — know if it's a heavy Product day |
| **Not ready @ 7:45** | Operator | 7:45am | Expected before morningbrief; confirms pipeline healthy |
| **Late ready** | PM (Billy) | After 8:20 | "Brief is ready" when publish finishes after his tracker section — no polling Cursor |
| **Still not ready @ 8:15** | Operator | 8:15am | Escalation if publish stuck |

**Security / compliance**

- Webhook URLs stored only as **GitHub repository secrets** (not in code)
- Messages are short status text + run id (no customer PII, no credentials)
- Workflows skip Slack entirely if secrets are unset
- Revocable by deleting the webhook in Slack app settings

**Business impact**

- **Faster response** when competitor collect or publish fails (operator ping same morning)
- **Less manual checking** of GitHub Actions and `tracker-briefs/` for Billy
- **Supports daily competitive rhythm** already approved for the Tracker program — Slack is the notification layer only

**Technical reference**

- Repo: `alonsoroca-gif/Tracker-Competitors-Bot`
- Secrets: `SLACK_WEBHOOK_URL_OPERATOR`, `SLACK_WEBHOOK_URL_BILLY`
- Docs: `initiative-1-tracker/docs/SLACK-WEBHOOK-SETUP.md`

Please approve Incoming Webhooks for the workspace (or advise alternate approved notification pattern). Happy to demo the 10-line test ping once URLs are issued.

Thanks,  
Alonso

---

## After approval

Follow [ALONSO-SLACK-MANUAL-STEPS.md](./ALONSO-SLACK-MANUAL-STEPS.md) to paste URLs into GitHub secrets.
