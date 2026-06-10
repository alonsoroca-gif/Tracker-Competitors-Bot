# Tier 1 vignette + ROI standard (tracker-publish)

Every **Tier — Now Product** row that gets a prototype in `tracker-publish` must produce **one `prototypes.json` entry** with this shape. The Tracker Brief Viewer renders it automatically — no viewer edits per run.

Reference fixture: `tracker-briefs/runs/_sample-product-day/`.

---

## `prototypes.json` row (required)

| Field | Required | Producer | Notes |
|-------|----------|----------|-------|
| `id`, `title`, `competitor_id`, `signal_id` | yes | publish | Slug + linkage |
| `html_path`, `preview_path`, `prd_path` | yes* | publish | *paths when PRD/vignette exist |
| `brief.what` | yes | publish (agent) | One sentence — what the vignette shows |
| `brief.benefits` | yes | publish | Entrata products (e.g. `Prospect Portal · Leasing CRM`) |
| `brief.why_build` | yes | publish | Structural gap vs competitor |
| `roi` | yes | **roi-analyst** TL;DR | verdict, lever, summary, scale fields |
| `roi.numbers` | yes | **roi-analyst** | Formula + inputs + scaling + disclaimer (see below) |
| `roi.brief.advantage` | yes | publish + roi-analyst | Our edge (1 sentence) |
| `roi.brief.why_pursue` | yes | publish + roi-analyst | Why pursue (1 sentence) |

---

## ROI numbers block (`roi.numbers`)

**Purpose:** Billy sees the headline dollars *and* knows what kind of number it is (approximation vs benchmark chunk vs measured).

| Field | Values | Rule |
|-------|--------|------|
| `type` | `modeled_approximation` · `benchmark_chunk` · `measured` | Default morningbrief = `modeled_approximation` |
| `formula` | string | Raw math in one line, e.g. `(Δ apply-start × rent × vacancy days) ÷ units` |
| `inputs` | string[] | 2–4 assumption bullets (midpoints, benchmark sources) |
| `scaling` | string | How per-unit → 250u → 10k portfolio; call out "chunk" language |
| `disclaimer` | string | Must say it's **not** a client ROI guarantee unless `type: measured` |

**Do not** hide that portfolio figures are directional scale-ups. **Do** keep `per_unit_annual`, `property_250`, `portfolio_10k` as the skim line.

---

## HTML vignette (Tier 1 bar)

Not `/trackerstart` / `create-prototype` quality — but **must** show a credible product surface and the **interaction being sold**.

### Must have

1. **Chrome** — app header, live/status badge, or tour context (not a blank canvas)
2. **Primary interaction** — the one thing the PRD delta delivers (e.g. pin → live rent → apply)
3. **Service rail or footer** — 1-line "what this delivers" or 2–3 numbered flow steps
4. **Entrata signal** — "Live PMS", "synced from pricing engine", product names in copy
5. **Fixed height** — design for ~340px iframe; no `100vh` empty void

### Must not

- Marketing-only hero with no UI
- Static PDF screenshot
- Three orphan buttons with no context
- Duplicate ROI/title inside vignette (lives in viewer shell)

### Subskills

| Step | Skill / agent | Output |
|------|---------------|--------|
| PRD | tracker-drop-cycle §4.4 | `prds/<slug>.md` |
| ROI TL;DR + numbers | **roi-analyst** (short mode) | `roi` + `roi.numbers` + scale fields |
| Prototype brief | publish agent | `brief` object |
| Vignette HTML | publish agent | `prototypes/<slug>.html` per this doc |
| Register | publish agent | one row in `prototypes.json` |

---

## Chat feed (`tracker-feed`)

`briefFeed.js` echoes verdict + scale + `numbers.type` + one-line `brief.what` per prototype so Billy sees structure in chat before opening the viewer.

---

## Related

- [TRACKER-BRIEFS-SCHEMA.md](./TRACKER-BRIEFS-SCHEMA.md)
- [TRACKER-PROTOTYPE-TIERS.md](./TRACKER-PROTOTYPE-TIERS.md)
- `.cursor/skills/tracker-publish/SKILL.md` Phase 4
