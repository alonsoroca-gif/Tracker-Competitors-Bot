# API costs and license (coding-automation agent)

Short reference for the **coding-automation agent** when it uses an **OpenAI API key**: how much it spends and how that fits with a license or budget.

---

## Model and pricing (OpenAI)

- **Default model:** `gpt-4o-mini`
- **Pricing (typical):**
  - **Input:** ~$0.15 per 1M tokens  
  - **Output:** ~$0.60 per 1M tokens  

*(Check [OpenAI Pricing](https://openai.com/api/pricing/) for current numbers.)*

---

## Weekly cost estimate

Rough range for **one week** of overnight automation (agent picks one task per run, one API call per task):

| Scenario | Tasks/week | Input (approx) | Output (approx) | Cost/week (approx) |
|----------|------------|----------------|-----------------|--------------------|
| Light    | 5          | 50k tokens     | 10k tokens      | **~$0.02**         |
| Medium   | 15         | 150k           | 30k             | **~$0.05**         |
| Heavy    | 30         | 300k           | 60k             | **~$0.10**         |

So in normal use the bot is in the **few cents to about $0.10 per week** range with `gpt-4o-mini`. Even at 50 tasks/week you’re still well under **~$0.20/week** unless context or responses get very large.

If you switch to **gpt-4o** (more capable, more expensive), multiply by roughly 10–15× for the same usage (e.g. **~$0.20–$1.50/week** for the same task counts).

---

## Matching this to your license

- If your **license** is a **usage-based** OpenAI plan (pay-as-you-go or prepaid credits), the bot’s usage is just part of that: set a **monthly budget** or **usage limit** in the OpenAI dashboard so the agent can’t exceed what you’re okay with.
- If the license is **per-seat** (e.g. Cursor, Copilot) and does **not** include the OpenAI API, then the **API key is separate**: the bot’s cost is whatever the key is charged (as above). In that case, a **weekly budget of a few dollars** is usually more than enough for this agent; you can cap it in OpenAI (e.g. $5–10/month) and the bot will stay under that unless you scale up a lot.

**Bottom line:** On `gpt-4o-mini`, expect **well under $1/week** in normal use; often **under $0.10/week**. Your license can cover it if it includes API usage; otherwise a small monthly cap (e.g. $5) is enough to stay safe.

---

## Optional: weekly cap in code

The agent does **not** currently enforce a spending cap; that’s done in the **OpenAI account** (usage limits / budget). If you want a rough “max N tasks per week” to control cost, we can add a simple check (e.g. a small file or env var that counts runs per week and stops after a limit).
