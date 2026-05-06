# Tracker bot — demo (Git + Cursor, no local report UI)

**Target story:** the tracker **collects** public signals → when there is **something new**, it **records evidence in Git** under **`tracker-drops/`** → a **manager pulls** the branch → **reads and interprets in Cursor** → builds a **prototype response** (e.g. in your **Product OS** workspace with `prototype-sandbox` / `/create-prototype`).

We **do not** use **`http://localhost:3000`** for this demo. The old Express report UI remains in the repo **only for optional engineering debug** — see [tracker README](../tracker/README.md) if you need it.

Full architecture: [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md).

**Copy-paste commands (runner + manager):** [TRACKER-MANAGER-COMMANDS.md](./TRACKER-MANAGER-COMMANDS.md).

**In Cursor Chat:** open this repo in Cursor, start a chat, and **attach these docs** (e.g. `@initiative-1-tracker/docs/TRACKER-DEMO.md` or `@TRACKER-MANAGER-COMMANDS.md`) so the assistant follows the same steps. Chat does not load them automatically.

**Sending steps to someone:** **[TRACKER-EXTERNAL-ONBOARDING.md](../../TRACKER-EXTERNAL-ONBOARDING.md)** — one combined guide (architecture, clone, manager/runner, CI, Entrata, troubleshooting + index to other docs). Recommended flow: **open file first**, then **clone** (Part 0–3).

---

## 0. Prereqs

- Node **18+** (`npm install` in `initiative-1-tracker/tracker`).
- This repo cloned; you can **commit** and **push** to your GitHub remote (or rely on **GitHub Actions**).

---

## 1. Quick CLI sanity (optional, no network)

Seeds demo rows aligned with **`prospect-portal`** and prints a gap-style report to the terminal:

```bash
cd initiative-1-tracker/tracker
npm run demo
```

This does **not** replace the Git path; it only checks that Node + config work.

---

## 2. Real collect (ingestion)

**Locally (laptop or CI runner):**

```bash
cd initiative-1-tracker/tracker
npm run collect -- --days 7
```

**In production:** the **Tracker drop** workflow runs collect on a schedule — see [TRACKER-DROP-CI.md](./TRACKER-DROP-CI.md).

---

## 3. Write a Git drop (evidence on the branch)

**Local (before you have CI):**

```bash
cd initiative-1-tracker/tracker
npm run drop -- --days 7
```

- If **no new signals** this run, nothing is written (relevance gate). For a **dry run** of the folder layout:  
  `TRACKER_DROP_FORCE=1 npm run drop -- --days 7`

**Then commit from repo root:**

```bash
cd /path/to/Tracker-Competitors-Bot
git add tracker-drops
git status
git commit -m "tracker drop: manual demo"
git push
```

**With CI:** merge the workflow; **Actions → Tracker drop** will collect, write `tracker-drops/`, and push when there is new signal content.

---

## 4. Manager path — pull and interpret in Cursor

1. **`git pull`** on the branch that receives drops (same as your policy).  
2. Open the repo in **Cursor** (optionally multi-root with Entrata code — [ENTRATA-CODE-IN-CURSOR.md](./ENTRATA-CODE-IN-CURSOR.md)).  
3. Open the **latest** folder under **`tracker-drops/`** (or follow **`tracker-drops/.latest-drop-id`**).  
4. Read **`SUMMARY.md`**, then **`signals.json`** as needed.  
5. Use **Chat / Composer** with your project rules: interpret **only** from committed files (see **TRACKER-FLOW-END-TO-END.md** §4).

---

## 5. Prototype “our response” (Product OS)

After interpretation, build the **counter-positioning / UX** artifact where your org expects it:

- **Entrata Product OS:** open **`entrata-product.code-workspace`**, use skills such as **`/create-prototype`** with context from the drop + your product area.  
- **Outcome:** a **prototype** (or memo) that answers *what the competitor is doing* and *what we should show or ship next* — **not** a dependency on localhost.

---

## 6. Slack (skipped for now)

When Entrata approves Incoming Webhooks, add **`SLACK_WEBHOOK_URL`** and use [TRACKER-DROP-CI.md](./TRACKER-DROP-CI.md). Until then, **Git is the notification** (managers watch the branch or PRs).

---

## 7. Future signals (aware but not yet wired)

Some competitor activity surfaces that we **know matter** but deliberately don't track in real time. The bot relies on downstream / proxied signals instead. Documented here so the team knows the design decision (rather than mistaking it for a blind spot).

| Signal | Why we don't track in real time | What we capture instead |
|---|---|---|
| **Events / webinars / conferences** (e.g. Anyone Home's May 21 Hybrid-Intelligence webinar) | Live event pages and registration modals are dynamic + low-frequency; building a dedicated `events_url` lane is parser work for marginal proactive value | The **post-event recap** lands in `blog`, `press`, or `insights_url` feeds within 1–2 weeks and is captured automatically. We notice the event after the fact via the recap article — same lag as a customer would experience. |
| **Real-time conference live-posts** (e.g. NMHC OPTECH, Apartmentalize) | Same as events — too dynamic, too low-volume per competitor to justify a lane | Captured via the **media coverage** (`media_url`) and **insights** (`insights_url`) lanes once vendors / press write about the conference. |
| **X / LinkedIn launches in real time** | ToS-restricted (X API paid, LinkedIn API forbidden for competitor monitoring) | See [SURFACE-INVENTORY.md](./SURFACE-INVENTORY.md) "Proposed surfaces" section for the full enumeration of access options. |
| **Pricing changes mid-sales-cycle** | Pricing is demo-gated for most multifamily competitors (no public `/pricing`) | Detected when the competitor publishes a press release or blog about a pricing/packaging change — lands in `press` or `blog` lanes. |

> **Design principle:** the tracker is a **weekly cadence intel loop**, not a real-time alerting system. If the event is large enough to matter, a recap will land in one of our owned/third-party feeds within days. If it doesn't, it wasn't material.

If you discover a competitor whose events / live-posts genuinely warrant proactive tracking, the path is: build an `events_url` lane modeled on `case_studies_url` (HTML page scrape, weekly run cadence). The architecture for both lanes lives in [PHASE-B2-HTML-LANES.md](./PHASE-B2-HTML-LANES.md).

---

## Related

- [TRACKER-MANAGER-COMMANDS.md](./TRACKER-MANAGER-COMMANDS.md) — commands only.  
- [TRACKER-DROP-CI.md](./TRACKER-DROP-CI.md) — Actions, secrets.  
- [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md) — sources.
