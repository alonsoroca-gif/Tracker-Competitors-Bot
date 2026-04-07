# G2 user reviews — brainstorm + prototype

## Why G2

Manager direction: **G2** (and similar) carries **buyer/user voice** — different from competitor marketing sites and from your own positioning. Good fit for the **information** side of the tracker (voice-of-customer, objections, comparisons).

## Constraints

- **Terms of use / robots:** review with your legal/compliance team before production scraping at scale.
- **Rendering:** many G2 pages **hydrate reviews in the browser**; a simple **cheerio** fetch of static HTML often returns **empty** review bodies. The prototype still runs and emits a **placeholder signal** explaining that, so the pipeline/UI stay testable.
- **Production options:** (1) **headless browser** (Playwright) after policy sign-off, (2) **G2 data/partner APIs** if licensed, (3) **manual export** into a file the collector reads (not built here).

## Prototype in this repo

1. **Config:** `sources.<competitor_id>.g2_reviews_url` — e.g. product reviews tab URL on G2.
2. **Collect:** `lib/g2Scrape.js` tries several DOM selectors; merges excerpts into one `g2_reviews` signal (`type: review_g2`).
3. **CLI smoke:**

   ```bash
   node index.js prototype-g2 "https://www.g2.com/products/.../reviews"
   ```

4. **Gap UI:** new source labels `g2_reviews`; dimension mapped toward **features** (product feedback).

## Tuning

If you get **0 excerpts**, open the URL in DevTools → Network → find XHR that returns review JSON; a future iteration can call that endpoint **only** if your org approves (may require cookies/session).
