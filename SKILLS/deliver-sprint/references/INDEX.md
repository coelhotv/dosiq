# deliver-sprint References

## How to Use This Skill

1. **Start here**: Read `../SKILL.md` (main workflow)
2. **Then reference**: Pick the file for your scenario:
   - `examples-real.md` — Real sprints 5.A, 5.B, 5.C with timelines
   - `phase-1-setup.md` — Detailed exploration checklist
   - `phase-2-patterns.md` — Code patterns (hooks, Zod, services)
   - `phase-3-validation.md` — Testing commands + debug guide
   - `phase-5-code-review.md` — PR template + Gemini workflow
   - `gh-code-review-guide.md` — GitHub CLI commands for managing reviews
   - `checklist-quick.md` — One-page checkpoint (print or bookmark)

---

## Quick Reference by Scenario

### "I'm ready to start implementing"
→ Read: `../SKILL.md` Phase 1 + Phase 2
→ Reference: `phase-2-patterns.md` (patterns) + `checklist-quick.md`

### "Testes estão falhando"
→ Read: `phase-3-validation.md` "Debug Failing Tests" section

### "Preciso fazer PR"
→ Read: `../SKILL.md` Phase 5
→ Use template in: `phase-5-code-review.md`

### "Finalizando entrega"
→ Read: `../SKILL.md` Phases 6–7
→ Reference: `checklist-quick.md` to confirm all steps

### "Quero entender real examples"
→ Read: `examples-real.md` (3 complete sprints)

---

## File Map

```
references/
├── INDEX.md (you are here)
├── examples-real.md ............... Real sprint 5.A/5.B/5.C timelines
├── phase-1-setup.md ............... Exploration + codebase analysis
├── phase-2-patterns.md ............ React, Zod, Services, CSS patterns
├── phase-3-validation.md .......... Testing + debug guide
├── phase-5-code-review.md ......... PR template + Gemini workflow
├── gh-code-review-guide.md ........ GitHub CLI: view comments, check status, apply reviews
└── checklist-quick.md ............ One-page checkpoint
```

---

## When You Get Stuck

| Problem | Solution |
|---------|----------|
| "What hooks order?" | See `phase-2-patterns.md` "React Hooks" |
| "How do I make a service?" | See `phase-2-patterns.md` "Service Pattern" |
| "Zod validation failing" | See `phase-2-patterns.md` "Zod Schema Pattern" |
| "Tests won't pass" | See `phase-3-validation.md` "Debug Failing Tests" |
| "What should PR look like?" | See `phase-5-code-review.md` "PR Template" |
| "How check if Gemini commented?" | See `gh-code-review-guide.md` "Quick Commands Reference" |
| "Can't see suggestions in PR?" | See `gh-code-review-guide.md` "Common Debugging Scenarios" |
| "How was 5.B really done?" | See `examples-real.md` "Sprint 5.B — Complete Timeline" |

---

**Last Updated**: 2026-W11
**Compiled from**: Sprints 5.A (Cost Analysis), 5.B (Encoding + Autocomplete), 5.C (Onboarding Fixes)
