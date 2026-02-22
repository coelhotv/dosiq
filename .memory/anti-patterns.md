# Anti-Patterns (Mistake Prevention)

> Every row represents a mistake that happened in production or during development.
> Cross-referenced with [rules.md](rules.md) for the positive "what to do" guidance.

| ID | Anti-Pattern | Consequence | Prevention | Rule Ref |
|----|-------------|-------------|------------|----------|
| AP-001 | Modify a duplicate file without checking which is actually imported | Production bug — fix goes to unused file | `find src -name "*File*" -type f` + trace imports | R-001 |
| AP-002 | Assume import location based on file name | Wrong file modified, feature doesn't work | Trace actual import with `grep -r "from.*File" src/` | R-002 |
| AP-003 | Import a file that doesn't exist | `ERR_MODULE_NOT_FOUND` crashes build | Validate with `npm run build` before push | R-003 |
| AP-004 | Declare state after useMemo/useEffect | `ReferenceError` — TDZ crash | States -> Memos -> Effects -> Handlers | R-010 |
| AP-005 | Use `new Date('YYYY-MM-DD')` | UTC midnight = wrong day in GMT-3 | Use `parseLocalDate()` or `+ 'T00:00:00'` | R-020 |
| AP-006 | Use English values in Zod enums | UI inconsistency, validation mismatch | Portuguese only: `['diario', 'semanal']` | R-021 |
| AP-007 | Record dosage in mg instead of pills | Exceeds Zod limit of 100 | `quantity_taken` = pill count | R-022 |
| AP-008 | Callback data > 64 bytes in Telegram | API silently fails | Use numeric indices, not UUIDs | R-030 |
| AP-009 | Unescaped MarkdownV2 special chars | Telegram API error 400 | Always use `escapeMarkdownV2()` | R-031 |
| AP-010 | `process.exit()` in serverless function | Function terminates, no response | Use `throw new Error()` | R-041 |
| AP-011 | Missing rewrite in `vercel.json` for API route | 405 error, catch-all serves HTML | Add explicit rewrite before catch-all | R-040 |
| AP-012 | Skip `npm run validate` before commit | Broken build, lint errors, failing tests | Run `validate:quick` during dev, `validate` before PR | R-051 |
| AP-013 | Commit directly to `main` | Unreviewed code in production | Always create feature branch + PR | — |
| AP-014 | Use `--no-verify` to skip hooks | Bypass quality gates | Fix errors properly instead | — |
| AP-015 | Call `logNotification()` after `shouldSendNotification()` | Duplicate notification logs | `shouldSendNotification()` already logs internally | R-032 |
| AP-016 | Endpoint with `service_role` key without auth | Unauthenticated access bypasses RLS | Add Supabase Auth + admin check | R-042 |

---

*Last updated: 2026-02-21*
*Anti-patterns: AP-001 to AP-016*
