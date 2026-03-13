# deliver-sprint References

## How to Use This Skill

1. **Start here**: Read `../SKILL.md` (main workflow)
2. **Then reference**: Pick the file for your scenario:
   - `examples-real.md` — Real sprints 5.A, 5.B, 5.C with timelines
   - `step-1-setup.md` — Detailed exploration checklist
   - `step-2-patterns.md` — Code patterns (hooks, Zod, services)
   - `step-3-validation.md` — Testing commands + debug guide
   - `step-5-code-review.md` — PR template + Gemini workflow
   - `gh-code-review-guide.md` — GitHub CLI commands for managing reviews
   - `checklist-quick.md` — One-page checkpoint (print or bookmark)

---

## Quick Reference by Scenario

### "I'm ready to start implementing"
→ Read: `../SKILL.md` Step 1 + Step 2
→ Reference: `step-2-patterns.md` (patterns) + `checklist-quick.md`

### "Testes estão falhando"
→ Read: `step-3-validation.md` "Debug Failing Tests" section

### "Preciso fazer PR"
→ Read: `../SKILL.md` Step 5
→ Use template in: `step-5-code-review.md`

### "Finalizando entrega"
→ Read: `../SKILL.md` Steps 6–7
→ Reference: `checklist-quick.md` to confirm all steps

### "Quero entender real examples"
→ Read: `examples-real.md` (3 complete sprints)

---

## File Map

```
references/
├── INDEX.md (you are here)
├── examples-real.md ............... Real sprint 5.A/5.B/5.C timelines
├── step-1-setup.md ............... Exploration + codebase analysis
├── step-2-patterns.md ............ React, Zod, Services, CSS patterns
├── step-3-validation.md .......... Testing + debug guide
├── step-5-code-review.md ......... PR template + Gemini workflow
├── gh-code-review-guide.md ........ GitHub CLI: view comments, check status, apply reviews
└── checklist-quick.md ............ One-page checkpoint
```

---

## When You Get Stuck

| Problem | Solution |
|---------|----------|
| "What hooks order?" | See `step-2-patterns.md` "React Hooks" |
| "How do I make a service?" | See `step-2-patterns.md` "Service Pattern" |
| "Zod validation failing" | See `step-2-patterns.md` "Zod Schema Pattern" |
| "Tests won't pass" | See `step-3-validation.md` "Debug Failing Tests" |
| "What should PR look like?" | See `step-5-code-review.md` "PR Template" |
| "How check if Gemini commented?" | See `gh-code-review-guide.md` "Quick Commands Reference" |
| "Can't see suggestions in PR?" | See `gh-code-review-guide.md` "Common Debugging Scenarios" |
| "How was 5.B really done?" | See `examples-real.md` "Sprint 5.B — Complete Timeline" |

---

**Last Updated**: 2026-W11
**Compiled from**: Sprints 5.A (Cost Analysis), 5.B (Encoding + Autocomplete), 5.C (Onboarding Fixes)
