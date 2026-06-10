# Slack webhook — IT request (copy-paste)

**Subject:** Approve Incoming Webhooks for Tracker Competitors Bot

---

Hi IT,

Please approve **Incoming Webhooks** (outbound POST only — no bot token, no channel read) for our **Tracker Competitors Bot** repo.

**What it does:** GitHub Actions collects competitor signals overnight and publishes a weekday product brief (~8am MT). Webhooks send short status pings so we don't have to check GitHub manually.

| Ping | Who | When |
|------|-----|------|
| Preflight | Operator (Alonso) | 5:35am — today's workload estimate |
| Not ready | Operator | 7:45am — normal before morningbrief |
| Brief ready | PM (Billy) | After 8:20 if publish finishes late |
| Stuck | Operator | 8:15am if still not ready |

**Why it matters:** Faster notice when collect/publish fails; Billy gets a DM when the brief lands without polling Cursor.

**Security:** URLs stored as GitHub secrets only. Messages are run id + counts — no PII. Revocable in Slack app settings.

**Need:** 2 webhook URLs (operator channel + PM channel). Repo: `alonsoroca-gif/Tracker-Competitors-Bot`.

Thanks,  
Alonso

---

After approval: [ALONSO-SLACK-MANUAL-STEPS.md](./ALONSO-SLACK-MANUAL-STEPS.md)
