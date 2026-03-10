# “What to change” block — Tracker Bot (Initiative 1)

First version of the **product output**: a short section in the weekly report (or Slack) with 1–3 recommended changes, each tied to a gap and a competitor signal. These recommendations are part of our **response schema**: the bot proposes *how we respond* to competitor actions (see [response-schema.md](response-schema.md)). Our response is high priority; the “what to change” block and the “how we respond” section together form the response schema in readable form.

---

## 1. Placement

- **In the weekly newsletter:** Add a section titled **“What to change this week”** (or “Recommended actions”) after KPIs and before or after the competitor summary.
- **In Slack:** Same content can be a second message block or a dedicated thread under the weekly report.

---

## 2. Block structure (per recommendation)

Each recommendation should include:

| Element | Example |
|--------|--------|
| **Action** | One short sentence: what we should do (e.g. “Add live chat support” or “Adjust pricing page copy”). |
| **Response type** | How we respond: *match* / *differentiate* / *ignore* / *accelerate* / *counter* (from [response-schema.md](response-schema.md)). |
| **Why** | One sentence: which gap it addresses (e.g. “Competitor X launched 24/7 chat; we only have email.”). |
| **Source** | Competitor signal (e.g. “Competitor X blog, 2025-02-20”). |
| **Priority** | high / medium / low. |
| **Timeline** | Optional: when we respond (e.g. “Within 2 weeks”, “Q2”). |

---

## 3. Sample output (Slack / newsletter copy)

**What to change this week** *(how we respond)*

1. **Add or roadmap live chat support** · *Response: Match*  
   Competitor X launched 24/7 live chat; we only offer email. This was the top-requested feature in our segment last quarter.  
   *Source: Competitor X blog, 2025-02-20* · *Priority: High* · *Timeline: Decide within 2 weeks; ship by Q2 if we match*

2. **Refresh pricing page messaging** · *Response: Match*  
   Competitor Y is now emphasizing “no credit card required” and “cancel anytime” on their pricing page; our page doesn’t. Aligning messaging could reduce signup friction.  
   *Source: Competitor Y pricing page, 2025-02-22* · *Priority: Medium* · *Timeline: Within 2 weeks*

3. **Review support SLA positioning** · *Response: Differentiate*  
   Competitor Z advertises “response within 2 hours” for paid plans. We don’t state a target; consider adding one if we can commit, or emphasize a different differentiator.  
   *Source: Competitor Z help center, 2025-02-18* · *Priority: Low* · *Timeline: Review in 1 month*

---

## 4. Rules for the bot (v1)

- Show **at most 3** recommendations per product per week.
- Prefer **high** priority first; then medium; then low.
- Every recommendation must reference a **gap** from the gap report and a **competitor_signal** (source + date).
- Every recommendation should have a **response type** (match, differentiate, ignore, accelerate, counter) and optional **timeline** so we have a clear schema for *how we respond* (see [response-schema.md](response-schema.md)).
- Owner of “what to change” (who decides which to adopt) is to be agreed with manager; the block is informational only.

---

*Part of the three initiatives plan. See ACTION-PLAN.md.*
