# ProspectPortal — Task list (Initiative 2)

Small, testable tasks. Check off when done. **Suggested Mon–Thu:** Phase 1 Mon–Tue; Phase 2 Tue PM–Wed AM; Phase 3–4 Wed PM–Thu; Phase 5 Thu. Refs: [product-one-pager](product-one-pager.md), [discovery-questions](discovery-questions.md), [bot-flow-wireframe](bot-flow-wireframe.md), [tech-ux-concept](tech-ux-concept.md).

---

## Suggested week (code through Thursday)

| Day | Focus | Tasks |
|-----|--------|--------|
| **Mon** | Project + URL fetch + parse structure | P1.1a–c, P1.2a–c, P1.3a–c |
| **Tue** | Style hints + reference schema + Q1–Q3 + flow | P1.4a–b, P1.5a–b, P2.1a–b, P2.2a–b, P2.3a–b, P2.4a–b |
| **Wed** | Generate: section map + copy + HTML | P3.1a–b, P3.2a–b, P3.3a–b, P3.4a–b |
| **Thu** | CSS + preview + export + docs | P4.1a–c, P4.2a–b, P5.1a–b, P5.2a–b, P6.3 |

Adjust as needed; each sub-task is sized for one sitting.

---

## Phase 1: Project and ingest

### P1.1 — Set up ProspectPortal project
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P1.1a | Create project folder (e.g. `prospectportal/` or under `initiative-2-prospectportal/`) and init (npm/pip) | `package.json` or `requirements.txt`; `npm install` / `pip install` runs | [ ] |
| P1.1b | Add entry point: simple HTTP server (Express/Fastify/Flask) or CLI that listens or runs once | `npm start` or `python app.py` runs; returns 200 or prints “ProspectPortal” | [ ] |
| P1.1c | Add `.env.example` and README with “how to run” | Another dev could run in 2 steps | [ ] |

### P1.2 — URL validation and fetch
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P1.2a | Validate URL (format + optional reachable check). Return clear error if invalid | Invalid URL → 400 or error message; valid URL proceeds | [ ] |
| P1.2b | Fetch HTML with timeout (e.g. 10s). Use axios/node-fetch or requests/httpx | Raw HTML string returned; timeout throws or returns error | [ ] |
| P1.2c | Handle 4xx/5xx and network errors; return or throw with message | No uncaught exception on failure | [ ] |

### P1.3 — Parse HTML: structure (sections, headings, nav)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P1.3a | Use a parser (cheerio, jsdom, or BeautifulSoup). Load HTML into DOM | Can query selectors (e.g. `h1`, `h2`, `section`, `nav a`) | [ ] |
| P1.3b | Extract sections: each has tag (h1/h2/section) and text content. Order preserved | Array of `{ tag, text }` for main content | [ ] |
| P1.3c | Extract nav items (e.g. `nav a` href + text). Optional: footer links | Array of `{ href, text }` or empty | [ ] |

### P1.4 — Style hints (optional but good for Thu)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P1.4a | From HTML/CSS, try to read primary color (e.g. first `color` or `background` in inline/style or linked CSS) | One “primary” color hex or “unknown” | [ ] |
| P1.4b | Try to read font-family from body or main container | One font name or “unknown” | [ ] |

### P1.5 — Reference schema object
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P1.5a | Build object: `{ structure: sections[], nav[], styleHints: { primaryColor?, font? } }` | One function `ingestReference(url)` returns this object | [ ] |
| P1.5b | Persist in memory or simple file/DB keyed by session or request id so generate step can use it | Generate step can read reference by id or from same request | [ ] |

---

## Phase 2: Discovery (3 questions)

### P2.1 — Q1 (goal)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P2.1a | Add input for “What’s the main goal of the site?” (form field or CLI prompt) | User can submit a string | [ ] |
| P2.1b | Store in session, in-memory store, or request body; pass to next step | Value available to generate step | [ ] |

### P2.2 — Q2 (audience)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P2.2a | Add input for “Who is the primary audience?” | User can submit a string | [ ] |
| P2.2b | Store and pass to generate step | Same as P2.1b | [ ] |

### P2.3 — Q3 (must-haves)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P2.3a | Add input for “Up to 3 must-haves” (e.g. 3 text fields or tags) | User can submit 1–3 strings | [ ] |
| P2.3b | Store as array and pass to generate step | Array length 1–3 | [ ] |

### P2.4 — Full flow: link → Q1 → Q2 → Q3 → Generate
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P2.4a | Wire flow: after link, show Q1; after Q1, Q2; after Q2, Q3; after Q3, show “Generate” button or call generate | No errors; all 4 inputs (url, goal, audience, must_haves) available at generate | [ ] |
| P2.4b | On “Generate,” call ingest (if not already done) then generate step with reference + goal + audience + must_haves | Single function or pipeline receives all inputs | [ ] |

---

## Phase 3: Generate (structure and copy)

### P3.1 — Map goal + must_haves to section list
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P3.1a | Define section types (e.g. hero, features, pricing, testimonials, cta, contact). Rules: e.g. if “pricing” in must_haves → add pricing section | Function `getSectionList(goal, must_haves)` returns ordered array of section types | [ ] |
| P3.1b | Include hero and cta in every list; add 1–3 more from must_haves | At least 3 section types per run | [ ] |

### P3.2 — Copy per section
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P3.2a | For each section type, have a template or 1–2 sentence placeholder (e.g. hero: “Welcome to [goal]”) | Function `getCopyForSection(sectionType, goal, audience)` returns headline and/or body | [ ] |
| P3.2b | Optional: use LLM to generate copy from goal + audience; fallback to template | Copy is not empty | [ ] |

### P3.3 — Full page structure
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P3.3a | Build array of sections: each has type, headline, body (optional) | One function returns `sections[]` with copy for each | [ ] |
| P3.3b | Optional: inject reference structure (e.g. reuse reference headings as inspiration) | Structure is consistent and non-empty | [ ] |

### P3.4 — Render to HTML
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P3.4a | Turn sections into HTML: one wrapper (e.g. `<main>`), one block per section (e.g. `<section><h2>…</h2><p>…</p></section>`) | Valid HTML string; no unclosed tags | [ ] |
| P3.4b | Add basic structure: `<!DOCTYPE html>`, `<html>`, `<head>` (charset, title), `<body>` with content | Page loads in browser without errors | [ ] |

---

## Phase 4: CSS and layout

### P4.1 — Design tokens
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P4.1a | Create CSS variables or a small token file: --color-primary, --font-body, --spacing-unit | HTML or separate CSS file references them | [ ] |
| P4.1b | Use a default theme (e.g. blue primary, system font) if reference had no style hints | Page has consistent color and font | [ ] |
| P4.1c | Optional: use reference style hints (P1.4) to set --color-primary and font | When reference had color/font, they appear in output | [ ] |

### P4.2 — Base layout
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P4.2a | Container max-width, padding, margin; basic responsive (e.g. padding scales down on small screen) | Content is readable on 320px and 1200px width | [ ] |
| P4.2b | Typography: font-size, line-height for body and headings | Text is legible | [ ] |

### P4.3 — Component styles (hero, CTA, section)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P4.3a | Hero: large heading, optional subtext, background or border | First section looks like a “hero” | [ ] |
| P4.3b | CTA: button or link style (padding, color, border-radius) | At least one CTA looks clickable | [ ] |
| P4.3c | Section: spacing between sections; optional card or border for feature blocks | Page looks like a coherent site, not raw HTML | [ ] |

---

## Phase 5: Preview and export

### P5.1 — Serve preview
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P5.1a | After generate, serve the HTML+CSS (inline or linked) at a route (e.g. GET /preview?id=…) or return HTML in response | User can open URL or response in browser and see generated site | [ ] |
| P5.1b | Optional: store last generated output in memory/file so “preview” works without re-running generate | Preview is stable until next generate | [ ] |

### P5.2 — Export ZIP
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P5.2a | Add endpoint or CLI: “export” returns a ZIP containing index.html and styles.css (or single HTML with inline CSS) | Downloading and unzipping gives a working static site | [ ] |
| P5.2b | ZIP filename includes date or id so user can save multiple exports | No overwrite confusion | [ ] |

### P5.3 — Regenerate (optional)
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P5.3 | Add “Change answers” or “Regenerate”: user can edit goal/audience/must_haves and run generate again | Same flow as first time; new HTML produced | [ ] |

---

## Phase 6: Automation and docs

### P6.1 – P6.2 (tests and smoke; optional for Thu)
| ID | Task | Acceptance criteria | Done |
|----|------|---------------------|------|
| P6.1 | Add 2+ tests (e.g. ingest returns structure; getSectionList returns array) | `npm test` / `pytest` passes | [ ] |
| P6.2 | Smoke: ingest URL → set goal/audience/must_haves → generate → assert HTML length > 0 | Fails if pipeline breaks | [ ] |

### P6.3 — Document how to run
| ID | Sub-task | Acceptance criteria | Done |
|----|----------|---------------------|------|
| P6.3 | CONTEXT.md or README: how to run server/CLI, env vars, how to paste link and answer 3 questions | Another person could run ProspectPortal and get a preview in < 10 min | [ ] |

---

## Next (pick from here)

- **Mon:** P1.1a–c, P1.2a–c, P1.3a–c.
- **Tue:** P1.4a–b, P1.5a–b, P2.1a–b through P2.4b.
- **Wed:** P3.1a–b through P3.4b.
- **Thu:** P4.1a–c, P4.2a–b, P4.3a–c, P5.1a–b, P5.2a–b, P6.3.

*Part of [ACTION-PLAN.md](../../ACTION-PLAN.md).*
