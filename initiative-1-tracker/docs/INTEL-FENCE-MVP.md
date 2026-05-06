# Intel fence — MVP

**Goal:** Reduce accidental exposure of **repo-derived** content (paths + code lines), optional **encryption for stored signals**, and clear defaults before any **LLM / outbound** enrichment exists.

## Further plan (not in this MVP)

- **Full security audit** — Formal AppSec / threat model review when the tracker is headed for **production**, **broad access**, or **regulated / customer data**; align with Entrata security before **any** external model processes Core-derived text.
- **Secret scanning in CI**, **SBOM**, **dependency audit** — as the program matures.

## What ships in this MVP

| Control | Where | Notes |
|--------|--------|------|
| **Caps** | `config/intel-fence.json` | Max chars per snippet, max snippets per hit, max touchpoints, scan file count/bytes, max gap blob for keyword extraction |
| **Light redaction** | `lib/intelFence.js` | Regex scrub on repo **snippet lines** only (e.g. `sk_live_…`, naive `apikey=` patterns, AWS-like keys, `Bearer …`). Not a full secret scanner. |
| **API disclosure** | `structured.intel_fence` on each “what to change” item | Includes `signals_encrypted_at_rest` when `TRACKER_SIGNALS_ENCRYPTION_KEY` is set |
| **LLM default off** | `intel-fence.json` + env | `llm_enrichment_enabled: false`; optional override `TRACKER_LLM_ENRICHMENT=1` for future wiring **after** policy approval |
| **Encryption at rest (optional)** | `lib/signalsAtRest.js` + `lib/storage.js` | **AES-256-GCM** wrapper for `data/signals.json` when `TRACKER_SIGNALS_ENCRYPTION_KEY` is set (see `.env.example`). **Default: plaintext** (backward compatible). |

## Encryption — important caveats

- **Key custody:** If you lose the key, you **cannot** read `signals.json`. Back up the key in Entrata-approved secret storage—not in Git.
- **Do not remove the key** while the file is encrypted without **decrypting / migrating** first, or the app will see **no signals** until the key is restored.
- **Not a substitute** for FileVault, VPN policy, or repo hygiene; it protects the **file on disk** from casual inspection, not all attack models.

## What this MVP does **not** do

- No outbound HTTP to model providers (placeholder flag only).
- Redaction is **best-effort**; **human review** and **secret hygiene** in Git still required.

## Files

- `tracker/config/intel-fence.json` — tunable limits  
- `tracker/lib/intelFence.js` — load config, sanitize, apply to touchpoints  
- `tracker/lib/signalsAtRest.js` — optional encrypt/decrypt for `signals.json`  
- `tracker/lib/storage.js` — read/write signals through `signalsAtRest`  
- `tracker/lib/repoInsight.js` — scan limits + snippet length from fence  
- `tracker/lib/whatToChange.js` — final `applyFenceToTouchpoints` + `intel_fence` meta  

## Next steps (when adding a real bot)

1. Keep **`llm_enrichment_enabled`** false in prod until legal/security sign off.  
2. **`minimal_model_bundle`** + gateway status in the local API (legacy path) — the org-facing **LLM gateway** spec is **superseded**; see [TRACKER-FLOW-END-TO-END.md](./TRACKER-FLOW-END-TO-END.md) and [_archive/LLM-GATEWAY-MVP.md](./_archive/LLM-GATEWAY-MVP.md) for history. Wire **one** outbound POST only after approval.  
3. Log **category** of data sent (never log raw secrets).

See also: [COMPETITIVE-INTEL-PRESENTATION.md](./COMPETITIVE-INTEL-PRESENTATION.md) (L1/L2/L3).
