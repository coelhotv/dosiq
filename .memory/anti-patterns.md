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
| AP-020 | Code agent merging its own PR | Unreviewed code, conflicts of interest | Separate responsibilities: Code creates, DevOps merges | R-060 |
| AP-021 | Skipping Gemini Code Assist review to save time | Missed CRITICAL/HIGH issues, production bugs | Always wait for Gemini review, address all CRITICAL/HIGH | R-062 |
| AP-022 | Sequential task creation without validation gates | Accumulated errors, no quality checkpoints | Pause between tasks for review, use quality gates | R-061 |
| AP-023 | Not reading memory files before coding | Repeated mistakes, rule violations, wasted effort | **ALWAYS read `.memory/rules.md` and `.memory/anti-patterns.md` before coding** (R-065) | R-065 |

---

## Testing Anti-Patterns (2026-02-23)

| ID | Anti-Pattern | Consequence | Prevention | Rule Ref |
|----|-------------|-------------|------------|----------|
| AP-T01 | Use parallel threads (>1) without testing for race conditions | Tests pass locally, fail in CI; unpredictable hangs | Default: 1 thread (`npm run test:fast`). Use `--maxThreads=2` only if test isolation verified | R-081 |
| AP-T02 | Skip test cleanup (cache, mocks, timers) | Memory accumulation, OOM on 8GB machines, state leaks between tests | Call `afterEach()`: `clearCache()`, `vi.clearAllMocks()`, `vi.clearAllTimers()`, `if (global.gc) global.gc()` | R-078 |
| AP-T03 | Store data in localStorage during tests | ~200MB memory waste per test suite run | Check `process.env.NODE_ENV === 'test'` and skip persistence in tests | R-076 |
| AP-T04 | Leave `setInterval()` running during test suite | Garbage collection never runs, memory grows indefinitely | Export `cancelGarbageCollection()` / `restartGarbageCollection()` and call in test hooks | R-077 |
| AP-T05 | Test file >300 lines with multiple unrelated test suites | Memory accumulation in single worker, OOM on 8GB machines | Split by scope: one hook/component per file (e.g., `useCachedQuery.test.jsx` + separate `useCachedQueries.test.jsx`) | R-079 |
| AP-T06 | Hardcode `setTimeout()` for timing in `act()` blocks | Timing-dependent, flaky in CI; can timeout unexpectedly | Use `vi.useFakeTimers()` + `vi.runAllTimersAsync()` OR `waitFor()` polling (no hardcoded delays) | R-073 |
| AP-T07 | Resolve Promise only after assertion without `finally` | If assertion fails, Promise stays pending → Vitest hangs indefinitely | Wrap in `try/finally`: resolve always happens, even on error | R-072 |
| AP-T08 | Run full test suite on every commit locally | Blocks development, 6.5 min wait time discourages testing | Use `npm run test:changed` (30s) before commit, full suite only on push or before merge | — |
| AP-T09 | Ignore timeout warnings on slow tests | Tests >15s can trigger 10-min kill switch in agents, fail CI | Optimize slow tests: mock expensive operations, use fake timers, reduce setup overhead | — |
| AP-T10 | Use `new Date()` in tests without timezone awareness | Tests pass in GMT but fail in GMT-3 (local); date off by 1 day | Always use `parseLocalDate()` or `new Date(str + 'T00:00:00')` for date comparisons | R-020 |

---

*Last updated: 2026-02-23*
*Anti-patterns: AP-001 to AP-023 + AP-T01 to AP-T10*
