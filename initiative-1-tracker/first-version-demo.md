# First-version demo — Tracker Bot (Initiative 1)

End-to-end run for the manager: **one product + one competitor** → newsletter + gap summary + **response schema (how we respond)** + recommended actions. Use mock data below to present the first version. Our response is high priority: the bot develops a schema for *how we respond* to competitor actions, not just what changed.

---

## 1. Demo scenario

- **Our product:** Product A (example B2B SaaS).
- **Competitor:** Competitor X.
- **Period:** Last 7 days (e.g. 2025-02-17 to 2025-02-24).
- **Sources:** Mock competitor signals (blog, pricing page, job post).

---

## 2. Mock inputs

### Competitor signals (market analysis)

| Date | Source | Signal |
|------|--------|--------|
| 2025-02-20 | Competitor X blog | Launched 24/7 live chat support. |
| 2025-02-22 | Competitor X pricing page | New tier “Pro” at $49/mo; “no credit card required” and “cancel anytime” highlighted. |
| 2025-02-18 | Competitor X careers | Job posting: “VP Product – growth and international.” |

### Our product (current state)

| Dimension | Our state |
|-----------|-----------|
| Support | Email only; no live chat. |
| Pricing page | No “no credit card” or “cancel anytime” messaging. |
| Positioning | No explicit international/growth narrative. |

---

## 3. Gap report (generated)

| Gap ID | Dimension | Title | Description | Priority |
|--------|-----------|-------|-------------|----------|
| gap-001 | features | Live chat support | Competitor X launched 24/7 live chat; we only have email. | high |
| gap-002 | messaging | Pricing page copy | Competitor X emphasizes “no credit card” and “cancel anytime”; we don’t. | medium |
| gap-003 | positioning | Growth/international | Competitor X hiring VP Product for growth/international; we have no public narrative here. | low |

---

## 4. Weekly newsletter (sample) — first section

**Tracker Competitors Bot — Weekly report**  
**Product A · 17–24 Feb 2025**

**KPIs this week**

- Competitor X: 1 major release (live chat), 1 pricing page update, 1 key hire (VP Product).
- No pricing change detected for Competitor X.

**Highlights**

- Competitor X launched 24/7 live chat (blog, 20 Feb).
- Competitor X updated pricing page with “no credit card required” and “cancel anytime.”
- Competitor X posted VP Product – growth and international.

---

## 5. “How we respond” (response schema — sample)

The bot proposes *how we respond* to each competitor action (response type + actions + timeline). See [response-schema.md](response-schema.md).

| Competitor action | Our response | Actions | Timeline |
|-------------------|--------------|---------|----------|
| Competitor X launched 24/7 live chat | **Match** — Close the gap; support is key in our segment. | 1. Add live chat to roadmap. 2. Communicate “coming soon” if we can’t ship soon. | Decide within 2 weeks; ship by Q2 if we match. |
| Competitor X updated pricing page (“no credit card”, “cancel anytime”) | **Match** — Align messaging to reduce friction. | 1. Refresh pricing page copy with same guarantees where true. 2. Legal to confirm “cancel anytime”. | Within 2 weeks. |
| Competitor X hiring VP Product (growth/international) | **Differentiate** — Strengthen our own narrative; don’t copy. | 1. Draft one-paragraph positioning for growth/international. 2. Decide if we publish or keep internal. | Low urgency; review in 1 month. |

---

## 6. “What to change this week” (sample block)

1. **Add or roadmap live chat support** · *Response: Match*  
   Competitor X launched 24/7 live chat; we only offer email.  
   *Source: Competitor X blog, 2025-02-20* · *Priority: High* · *Timeline: Decide within 2 weeks; ship by Q2*

2. **Refresh pricing page messaging** · *Response: Match*  
   Competitor X is emphasizing “no credit card required” and “cancel anytime”; our page doesn’t.  
   *Source: Competitor X pricing page, 2025-02-22* · *Priority: Medium* · *Timeline: Within 2 weeks*

3. **Review growth/international positioning** · *Response: Differentiate*  
   Competitor X is hiring VP Product for growth and international; consider whether we want a public narrative here.  
   *Source: Competitor X careers, 2025-02-18* · *Priority: Low* · *Timeline: Review in 1 month*

---

## 7. Demo script (for manager)

1. **Context (30 sec):** “We’re evolving the Tracker from an information source into a product: same signals, plus gap analysis and — importantly — a **schema for how we respond**. Our response is high priority: the bot doesn’t just say what changed; it proposes how we respond to each competitor action.”
2. **Flow (1 min):** “We analyze the market and our product in parallel, find gaps, then the bot **develops the response schema**: for each relevant competitor move, we get a response type (match, differentiate, ignore, accelerate, counter), concrete actions, and a timeline. That schema is in the newsletter as ‘How we respond’ and in the ‘What to change this week’ block.”
3. **Show newsletter:** Walk through the sample newsletter (KPIs + highlights).
4. **Show gap report:** Show the 3 gaps (table or JSON).
5. **Show response schema:** Walk through “How we respond” — competitor action → our response type → actions → timeline. Emphasize that this is the high-priority output: *how we respond*, not just what to change.
6. **Show recommendations:** Read the “What to change this week” block; tie each item to the gap, competitor signal, and response type/timeline.
7. **Next steps:** “First version is this structure; next we plug in real data, agree response types and priority rules with you, and decide who owns acting on the response schema.”

---

*Part of the three initiatives plan. See ACTION-PLAN.md.*
