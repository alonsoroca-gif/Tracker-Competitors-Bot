# Sponsor smoke test — Tracker + `entrata-core`

**Purpose:** prove a new joiner can **clone**, **checkout the documented branches**, and **pull** before demo day — so **Part 4.4** can use the **`entrata-core` gate** instead of guessing **`Status:`**.

**Who runs it:** sponsor, IT delegate, or onboarding buddy — on a **corporate-grade** path (VPN/MFA as real joiners use), not only on a pre-warmed developer laptop.

**Joiner-realistic VPN / MFA:** run this doc while connected **the same way onboarding employees must** — corporate VPN (or tunnel) **if required** for internal Git, and complete **MFA** when prompted (don’t rely on a stale SSO session). See **`TRACKER-EXTERNAL-ONBOARDING.md`** → **Sponsor checklist** note *What real VPN and MFA mean*.

### If MFA prompts you during `git clone` / `git pull`

MFA is enforced by your company / Git host, not by the Tracker. What you’ll see depends on the auth method your sponsor told you to use:

| Auth method | What appears | What you do |
|-------------|--------------|-------------|
| **HTTPS + browser SSO** (Git Credential Manager / `gh auth login`) | Terminal prints a **device code** + URL; a browser tab opens with **SSO login** then an **MFA prompt** (push, code, or security key) | Approve the push / type the code / tap the key. Browser says *"Device authorized"*. Return to terminal — clone resumes. |
| **HTTPS + Personal Access Token (PAT)** | Terminal asks **Username** + **Password**; paste the **PAT** as password | MFA was completed earlier in the browser when the PAT was minted. If you see *"Authentication failed"*, the PAT expired — regenerate it (browser will MFA again). |
| **SSH + key** | First time, may print *"organization has enabled SAML SSO… authorize this key"* with a URL | Open URL → SSO + MFA → **Authorize**. Re-run `git clone`; now silent. |

**Tips while running the smoke test:**

- Have your **phone / authenticator app / security key** within reach — most prompts time out in 30–60 seconds.
- If you see **no prompt at all**, your session may already be warm (still a pass, but mark it). To verify the MFA path itself, sign out of SSO once or use a clean browser profile and re-run.
- Repeated MFA failures = **IdP / IT issue**, not a Tracker issue. Update **Who to ask** in the sponsor table and stop the smoke test until access is fixed.

---

## 1) Fill the handout table first

In **`TRACKER-EXTERNAL-ONBOARDING.md`** at the repo root, complete every cell in **Sponsor: one clone URL + branch** (Tracker HTTPS/SSH/branch, **`entrata-core`** HTTPS/SSH/default branch, who to ask for access).

---

## 2) Copy-paste checks (replace placeholders)

Run from a **parent directory** where you are OK creating two folders (e.g. `~/Projects` or `~/smoke-tracker-$(date +%Y%m%d)`).

### Tracker Competitors Bot

```bash
export TRACKER_URL="<HTTPS-or-SSH-from-sponsor-table>"
export TRACKER_BRANCH="<branch-from-sponsor-table>"

git clone "$TRACKER_URL" smoke-tracker-bot
cd smoke-tracker-bot
git checkout "$TRACKER_BRANCH"
git pull origin "$TRACKER_BRANCH"
cd ..
```

**Pass:** clone finishes, branch matches table, `git pull` succeeds.

### `entrata-core` (managers)

```bash
export ENTRATA_URL="<HTTPS-or-SSH-from-sponsor-table>"
export ENTRATA_BRANCH="<default-branch-from-sponsor-table>"

git clone "$ENTRATA_URL" smoke-entrata-core
cd smoke-entrata-core
git checkout "$ENTRATA_BRANCH"
git pull origin "$ENTRATA_BRANCH"
cd ..
```

**Pass:** clone finishes, branch matches table, `git pull` succeeds. If MFA prompted, use the table in *"If MFA prompts you during `git clone` / `git pull`"* above.

### Optional: wall-clock (for demo pacing)

Note **minutes** from cold `git clone` to successful `git pull` for **`entrata-core`** (often the long pole). Add to internal runbook or Appendix timing notes.

---

## 3) Record + sign-off

Copy the block below into Slack, the ticket, or your onboarding wiki when both passes succeed.

```text
Tracker smoke test — PASS/FAIL — date: ______
  Tracker URL: ______  Branch: ______  Clone→pull notes: ______

entrata-core smoke test — PASS/FAIL — date: ______
  URL: ______  Branch: ______  Clone duration (approx): ______  Notes: ______

Joined by: ______  VPN: required Y/N — on during test Y/N
MFA path verified: Y/N — method (push / TOTP / key / PAT / SSH-SSO): ______
```

**If either fails:** fix **Who to ask** access, URL typo, or default branch — do not hand the guide to external managers until **`entrata-core`** row passes on realistic conditions.

---

## See also

- **`TRACKER-EXTERNAL-ONBOARDING.md`** — **Follow-through §1**, **§3.3**, **Appendix** (demo timing).
- **`initiative-1-tracker/docs/ENTRATA-CODE-IN-CURSOR.md`** — multi-root after clones exist.
