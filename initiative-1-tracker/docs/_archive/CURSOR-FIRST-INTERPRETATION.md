# Cursor-first interpretation (target UX + what we can build)

**Goal:** After signals are gathered, **interpretation** (not only quotations) appears in **Competitive Move** and **Our Response Week**—with **Cursor** as the primary interpreter—**without** requiring the end user to manually “export JSON and paste.”

**Related:** [SURFACE-INVENTORY.md](./SURFACE-INVENTORY.md) (evidence quality), [TRACKER-COMPETITIVE-MOVE-AND-RESPONSE-REFERENCE.md](./TRACKER-COMPETITIVE-MOVE-AND-RESPONSE-REFERENCE.md).

---

## What you want (ideal flow)

```text
Collect + gap build (always-on, in Tracker)
        ↓
For each gap (or top N): build structured payload internally
        ↓
Cursor interprets (tools + repo context) → paragraphs grounded in payload
        ↓
Store or display those paragraphs in the report UI
```

That **makes sense** as a product direction. The constraint is **technical**, not strategic:

- **Cursor** today is primarily a **developer environment** (Chat / Agent / optional **Background Agents**). The Tracker **Node server** (`npm run serve`) **cannot** silently “call Cursor” the same way it calls `fetch()` to a REST API—there is **no** standard “invoke my workspace model from Express” hook unless **Cursor** exposes a **documented automation** you adopt (e.g. scheduled Background Agent, or a future official API you trust under AppSec).
- So **“fully automatic with zero human and no API key”** for in-app paragraphs is **not** something we can promise by only editing Tracker `server.js`—unless we add **another** runtime that can run a model (**LLM API**, **self-hosted**, etc.).

---

## Phased path (no repo API key; Cursor as interpreter)

### Phase A — **Internal payload, zero manual copy** (Tracker owns this)

- Add **`GET /api/gap/:gapId/interpreter-payload`** (or embed `interpreter_payload` on each gap in **`/api/report`**) so the **browser** always has one JSON object per gap—**no** user copy/paste from DevTools.
- UI: **“Open in Cursor”** or **“Interpret”** copies payload + prompt **in one click** (clipboard) or opens a **Composer** session with prefilled instructions (whatever Cursor supports in your version).

**User experience:** One click from the report; **interpretation still runs in Cursor** (human can hit Run once), not inside Node.

### Phase B — **Scheduled Cursor work** (no Tracker API key)

- Use **Cursor Background Agents** (or your team’s agreed **weekly Agent run** on this repo) with a prompt: “For each gap in `AGENT_BATCH.json` produced by CI, write `interpretation.cursor.md` / JSON lines under `data/interpretations/` and open a PR.”
- A small **GitHub Action** can generate **`data/gap-batch-for-cursor.json`** after collect—still **no** OpenAI secret in the repo; the **Agent** does the model work under **Cursor’s** billing.

**User experience:** Stakeholders open the **normal report**; paragraphs appear after the **Cursor agent PR** merges (e.g. overnight).

### Phase C — **In-app instant paragraphs** (optional later)

- Requires either **LLM gateway** in Node (API key / Azure / Ollama) **or** an official **Cursor automation API** if your org adopts it under security review.

---

## “Collect after each config pass” (plain English)

Whenever someone edits **`config/products.json`** (new blog URL, changelog, etc.), the **running app does not automatically re-fetch the internet** for old dates.

- **`collect`** is the step that **downloads** sources and **writes** `data/signals.json` (and related meta).
- So after you **change URLs or add surfaces**, run **collect again** (from the UI **Refresh data** / **Collect**, or `npm run collect`) so the **new** pages/feeds are actually in storage. Otherwise the report still shows **old** snippets—interpretation will look “wrong” even if Cursor is perfect.

**Rule of thumb:** **Config change → collect → reload report → then interpret.**

---

## Playbook lines — what they look like

Today, **`product-keywords.json`** supplies **short rotating angles** (“match / differentiate” style). A **playbook** is the same idea but **human-written**, **conditional**, and **readable in the UI**.

**Example shape (conceptual):**

| When (signals / gap pattern) | Our state bucket | One-line “Our response this week” |
|------------------------------|------------------|-------------------------------------|
| Competitor changelog mentions **guided tours** + we are **Not started** on parity tours | Not started | “Treat as **parity**: assign one PM+eng spike this week to scope tour UX vs our Prospect flow; no public promise until scope lands.” |
| Same signal, we are **Delivered** on tours | Delivered | “**Differentiate**: publish a short comparison on reliability + integrations we already ship; avoid feature-chasing.” |
| Only **marketing homepage** scrape (tier D) | Any | “**Watch only**—no UI ship claim; widen sources (changelog/docs) before we commit roadmap.” |

In the product, this could be:

- **`config/response-playbook.json`** — array of rules `{ match: { sources_tier_max: "C", keywords: ["tour"], our_state_key: "guided_tours" }, response_line: "…" }`, or  
- A **markdown table** maintained by PM (like surface inventory) and imported later.

**How it looks in the UI:** same **“Our Response Week”** block, but the sentence reads like **a PM wrote it** for that situation instead of a generic “align roadmap” line.

---

## Summary

| Ask | Answer |
|-----|--------|
| Internal payload only | ✅ Phase A — Tracker exposes JSON; no manual export. |
| Cursor interprets (paragraphs, not only quotes) | ✅ Use Cursor Agent / Composer on that payload; **no** repo API key. |
| Same flow **fully** inside the browser with **no** human and **no** key | ❌ Not without **Cursor automation product** or **server-side model**. |
| Playbook lines | ✅ Conditional **human strings** in config; **visible** as clearer one-liners in the response block. |

Next implementation ticket (when you’re ready): **Phase A API + UI one-click** + doc link from report README.
