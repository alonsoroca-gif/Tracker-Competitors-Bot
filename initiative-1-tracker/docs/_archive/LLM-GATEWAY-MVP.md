# LLM gateway MVP — minimal payloads + approved path (no outbound yet)

**Ships today**

1. **`structured.llm_readiness`** on each “what to change” item in the report API:
   - **`gateway`** — `mode`, `endpoint_configured`, `outbound_implemented: false`, short `note`.
   - **`minimal_model_bundle`** — small JSON object: competitor summary, dimension, fenced **`repo_excerpts`**, **`grounding_terms`**, etc.
   - **`bundle_json_chars`** — size check against `config/llm-gateway.json` **`max_bundle_json_chars`**.

2. **Config** — `tracker/config/llm-gateway.json` (caps + default **`mode`: `off`**).

3. **Env (after approval only)**  
   - **`TRACKER_LLM_MODE`** — `off` | `internal_http` | `http` (override file).  
   - **`TRACKER_LLM_ENDPOINT`** — approved HTTPS URL.  
   Still **no HTTP** to this URL in the codebase until a follow-up implements the call under AppSec sign-off.

**Code:** `lib/modelBundle.js`, `lib/llmGateway.js`, `lib/whatToChange.js`.

**Relationship to the fence:** Bundles use **`repo_touchpoints` after `applyFenceToTouchpoints`**, so snippets are already capped/redacted.

**Next implementation step (separate PR):** one function `postMinimalBundle(bundle)` behind `outbound_implemented`, feature-flagged, with logging and timeouts—only after policy approves endpoint + data classes.

See: [INTEL-FENCE-MVP.md](./INTEL-FENCE-MVP.md).
