# Manager brief — Tracker (one page, current model)

**Audience:** stakeholders who need the story in one place.

## Where the product story lives now

The org-facing story is no longer “log into a standalone Tracker server to see gaps.” It is:

1. **Collection** of public signals (same sources as before — see [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md)).  
2. **Artifacts committed to a dedicated Entrata Git branch** (drops under an agreed path).  
3. **Humans** pull, open in **Cursor**, and **interpret** the drop (Chat/Composer) — so strategic reasoning uses the **IDE subscription** without requiring an org **Anthropic API key** in the headless path.  
4. **(Optional) ChatOps** — e.g. Slack when a new drop lands, with a link to the commit.  

**Flow, diagrams, and architecture (one document):** [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md)

## Tracker vs “repo automation” (Cursor / GitHub)

- The **enthusiasm bot / agent loop** in this monorepo (`AGENT-NEXT-TASK`, scheduled workflows) is **not** the Tracker. It is **repo task automation** — see root [docs/AGENT-LOOP.md](../../docs/AGENT-LOOP.md).  
- The **Tracker** in this new model is **data drops + human interpretation in Cursor** + optional **Slack**, not a separate public product.

## Still useful references

- **Config / surfaces:** [SURFACE-INVENTORY.md](./SURFACE-INVENTORY.md)  
- **Data pull & keywords:** [COMPETITOR-DATA-PULL-REFERENCE.md](./COMPETITOR-DATA-PULL-REFERENCE.md), [COMPETITIVE-KEYWORDS-PLAN.md](./COMPETITIVE-KEYWORDS-PLAN.md)  
- **Opening Entrata code with this repo:** [ENTRATA-CODE-IN-CURSOR.md](./ENTRATA-CODE-IN-CURSOR.md)  
- **Full doc index:** [initiative-1-tracker/docs/README.md](./README.md)  

**Legacy local UI:** `initiative-1-tracker/tracker` (`npm run serve`) may remain for **dev**; it is not the primary manager path — see the architecture doc.
