# Tracker Competitors Bot — Flow graphs

Graphs from the [PRD](PRD.md) for the bot process. You can view these in any Markdown viewer that supports Mermaid (e.g. GitHub, Notion, Cursor preview), or paste the code into [Mermaid Live](https://mermaid.live) to export as PNG/SVG.

---

## 1. High-level flow (sources → bot → output)

```mermaid
flowchart LR
  subgraph sources [Data sources]
    Blogs[Blogs]
    Jobs[Job boards]
    Pricing[Pricing pages]
    Social[Social]
  end

  subgraph bot [Bot]
    Aggregate[Aggregate]
    Classify[Classify]
    Aggregate --> Classify
  end

  subgraph out [Output]
    Newsletter[Weekly newsletter]
    Alerts[Drastic alerts]
  end

  sources --> Aggregate
  Classify --> Newsletter
  Classify --> Alerts
  Newsletter --> PMs[Product managers]
  Alerts --> Managers[Managers]
```

---

## 2. Detailed process flow (schedule → collect → process → Slack)

```mermaid
flowchart TB
  subgraph schedule [Schedule]
    Cron["Job runs first thing in the morning\n(e.g. Monday 8:00 AM)"]
  end

  subgraph collect [Collect]
    Sources[Pull from open sources\nblogs, jobs, pricing, app stores]
    Store[Normalize and store\nby product and competitor]
  end

  subgraph process [Process]
    Aggregate[Aggregate into KPIs\nand summaries]
    Classify[Classify each effort:\nnormal vs drastic]
    Forecast[Forecast likely\nnext moves]
    Build[Build weekly report\nKPIs + highlights + forecast]
  end

  subgraph deliver [Deliver via Slack]
    Newsletter[Send weekly newsletter\nto managers]
    Alerts[Send big-move alerts\nto dedicated channel]
  end

  Cron --> Sources
  Sources --> Store
  Store --> Aggregate
  Aggregate --> Classify
  Classify --> Forecast
  Classify --> Build
  Forecast --> Build
  Classify --> Alerts
  Build --> Newsletter
  Newsletter --> Managers[Managers see report\nin Slack]
  Alerts --> Managers
```

---

**Export as image (PNG/SVG):**  
- Copy the contents of a code block above into [Mermaid Live Editor](https://mermaid.live), then use **Actions → Export** to download PNG or SVG.  
- Or use the standalone Mermaid source file **`flow-process.mmd`** in this folder: open it, copy all, paste into Mermaid Live, and export the detailed process flow.
