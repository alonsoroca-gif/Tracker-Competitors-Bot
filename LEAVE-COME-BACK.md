# Leaving or coming back?

**Leaving?**  
→ Run: `./scripts/handoff.sh`  
(Updates STATUS, commits, pushes. CI runs on GitHub.)

**Coming back?**  
→ Run: `./scripts/resume.sh`  
(Pull latest, run gaps-check, refresh GAPS.md.)

**After a break:** also run **`node scripts/session-context.js`** so you reload agreed priorities (YouTube discovery, transcripts, agent). Details: [docs/REMINDER-WHEN-RETURNING.md](docs/REMINDER-WHEN-RETURNING.md).

---

*You can also ask the agent: “I’m leaving” or “I’m coming back” and it will remind you and can run the script.*
