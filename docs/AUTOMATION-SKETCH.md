# Automation sketch: overnight agent + “virtual me” reviewer

Long-term flow: you code and supervise at the office → you run a command when your shift ends → overnight an agent keeps coding on **branches** (never directly on `main`) → a “virtual me” bot accepts or rejects changes → the "virtual me" bot accepts or denies changes **while the automation is running** (it does not merge). You **always merge to main manually** when you're ready. Same idea as a team: work on a branch, open a PR, bot says pass/fail, you merge.

---

## 1. Branch-based workflow (avoid breaking main)

- **Main is protected.** No one—and no agent—pushes directly to `main`.
- The **coding agent** always works on a **branch** (e.g. `agent/T1.4a`, `automation/2025-02-25`, or `feature/agent-<task-id>`).
- It commits there and **opens a PR** into `main` (or pushes the branch and a small script opens the PR via GitHub API).
- **Nothing lands on main** until **you manually merge** a PR. The bot never merges; it only accept/denies. You merge when you're ready.
So: same as people working together on GitHub—add product/feature on a branch, open PR, then merge when it’s ready. Long-term this keeps the app from breaking main.

---

## 2. End-to-end steps

| Step | Who / What | Action |
|------|------------|--------|
| **1. You’re at the office** | You | Code, supervise, run tests. When done for the day you run the handoff command (e.g. `./scripts/handoff.sh`). |
| **2. Handoff** | You / script | Handoff script updates STATUS + HANDOFF, commits, pushes to `main`. Optionally: trigger the “overnight run” (e.g. webhook, or a scheduled job that starts at a fixed time). |
| **3. Overnight – coding agent** | Coding-automation agent (runs on a machine: your PC left on, or cloud) | (a) Pulls latest `main`. (b) Creates a branch e.g. `agent/T1.4a`. (c) Gets next task from TASKS.md. (d) Calls AI, applies edits on that branch. (e) Runs tests. (f) If tests pass: commits on the branch, pushes branch, opens PR into `main`. (g) Optionally marks task as done in TASKS.md on the same branch (so the PR includes that change). (h) Stops or picks next task and repeats (each task = one branch + one PR, or one branch with multiple commits and one PR—your choice). |
| **4. Virtual me – gate** | “Virtual me” bot | For each PR opened by the agent (e.g. from `agent/*`): runs tests (or trusts CI), maybe checks commit message / diff. **Accept:** post "Virtual me: Accept (tests pass)". **Deny:** post "Virtual me: Deny (tests failed)". The bot never merges; optionally comment “Needs human review” or close. |
| **5. Morning – you** | You | Open repo / notifications: see which PRs were merged (what “virtual me” accepted) and which are still open (need your review). Fix or merge manually as needed. Run `./scripts/resume.sh`, read HANDOFF + GAPS, continue. |

So: **agent only ever pushes to branches and opens PRs; the bot only says accept/deny; you always merge to main yourself.**

---

## 3. Options for building the “virtual me” bot

### Option A: GitHub Action (recommended)

- **What:** A workflow in the Tracker repo (e.g. `.github/workflows/review-agent-prs.yml`) that runs on `pull_request` (or when a PR is labeled `agent`).
- **Logic:** On PR from branch `agent/*` (or with label `agent`): run tests (or use existing CI). If tests pass and maybe other checks (e.g. commit message contains `task:`), post a comment "Virtual me: Accept" or "Deny" (the Action never merges); you merge to main when you're ready. If tests fail, post Deny (PR stays open for you).
- **Pros:** No extra service, no AI cost, runs on GitHub. Simple “tests pass → merge” gate.
- **Cons:** No nuanced “read the diff and decide”; it’s rule-based only.

### Option B: Build the reviewer in Cursor (as an agent)

- **What:** A Cursor **agent** (or a Cursor rule + saved instructions) that you run when you’re at the computer: “Review open PRs from the automation agent; for each one, decide accept or reject and tell me (or merge via gh CLI).” So the “virtual me” is you + Cursor in the morning: you open the repo, run the agent, it reads PRs and suggests or performs merge.
- **Pros:** Uses your Cursor credits; can use full context (diff, TASKS, history). Good for “first version” of the bot without new infra.
- **Cons:** Not fully automated overnight—you still have to run it in the morning. To make it “run without you,” you’d need Cursor (or something that calls Cursor) to run on a schedule, which brings back the “machine + API” question for true 24/7.

### Option C: Small reviewer service (AI or rules)

- **What:** A small script or service (Node/Python) that runs on a schedule or is triggered by “PR opened” (e.g. GitHub Action calls it, or a cron on a VPS). It fetches open PRs from the agent (e.g. `agent/*`), reads diff + description, and either: (1) **Rules only:** merge if tests pass and branch name matches. (2) **AI:** call an API (OpenAI/Claude) with “Should I merge this PR? Diff: …” and act on the answer (merge or comment).
- **Pros:** Can run fully automated; can be rule-based (no API key) or AI-based for smarter decisions.
- **Cons:** Needs a place to run (GitHub Action for rules, or VPS/cron for AI reviewer) and possibly an API key for the AI version.

### Option D: Hybrid (recommended for long-term)

- **Short term:** Use **Option A** (GitHub Action) so that “tests pass → auto-merge agent PRs” works without any extra machine or API. Optionally use **Option B** in the morning to review any PRs the Action left open (e.g. failed tests) with Cursor.
- **Later:** Add **Option C** (reviewer service with AI) if you want “virtual me” to actually read the diff and reject bad changes even when tests pass. That reviewer can run in the same place as the coding agent (e.g. same VPS, after the agent opens a PR).

---

## 4. Coding agent changes needed for this sketch

- **Never commit to `main`.** Always create a branch (e.g. `agent/<task-id>`), commit there, push the branch.
- **Open a PR** into `main` (via `gh pr create` or GitHub API) after pushing the branch.
- Optionally **mark task done** in TASKS.md on that branch so the PR includes the checkbox update.
- **Virtual me** (Option A is best: GitHub Action) runs on that PR, runs tests, and posts Accept or Deny; it never merges. You merge to main when you’re ready.

So the coding-automation agent repo needs a “branch + PR” mode: same logic as now (get task → AI → apply → test), but instead of committing to `main`, it: checkout new branch → commit → push branch → open PR.

---

## 5. One-page flow diagram

```
You (office)                    Overnight                           Morning
     |                               |                                  |
     |  handoff command               |  Coding agent (machine on)       |
     |  push to main                  |  - pull main                    |
     |--------------------------------|  - create branch agent/T1.4a    |
     |                                |  - get next task, AI, apply     |
     |                                |  - run tests                     |
     |                                |  - commit on branch, push        |
     |                                |  - open PR -> main               |
     |                                |                                  |
     |                                |  Virtual me (GitHub Action)       |
     |                                |  - on PR from agent/*            |
     |                                |  - run tests -> comment Accept   |
     |                                |    or Deny (never merge)          |
     |                                |----------------------------------|
     |                                |                                  |  You: see PRs + Accept/Deny
     |                                |                                  |  You: manually merge to main
     |                                |                                  |  resume.sh, continue
```

---

## 6. Summary

- **Avoid breaking the app:** Agent never pushes to `main`; always branch → PR → you always merge to main manually; the bot only accept/denies, never merges. Same as team workflow.
- **Steps:** Handoff → overnight agent (branch + PR per task) → virtual me (accept/reject) → morning you review and continue.
- **Build the “virtual me” bot:** (A) GitHub Action is the most beneficial: runs tests, posts Accept/Deny, never merges; (B) Cursor as agent (you run it in the morning, uses Cursor credits); (C) small reviewer service (AI or rules, can run on schedule); (D) hybrid: A now, add C later for smarter review.
- **Coding agent:** Add “branch + PR” mode so it never commits to main, and optionally mark task done in TASKS.md on the branch. **API key and costs:** See [API-COSTS-AND-LICENSE.md](API-COSTS-AND-LICENSE.md) for weekly estimate and license.
