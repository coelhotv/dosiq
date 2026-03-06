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

## Schema & API Integration Anti-Patterns (2026-02-24)

| ID | Anti-Pattern | Consequence | Prevention | Rule Ref |
|----|-------------|-------------|------------|----------|
| AP-S01 | Zod enum values don't match database CHECK constraint | 500 error on INSERT, data rejected by database | Keep Zod and SQL schemas synchronized; test with real INSERT | R-082 |
| AP-S02 | Use `.optional()` for fields that can be `null` | Zod rejects `null` from APIs/databases, 400 error | Use `.nullable().optional()` for fields that can receive `null` | R-085 |
| AP-S03 | Assume specific environment variable name | Code fails in CI/production where name differs | Provide fallbacks: `process.env.VAR \|\| process.env.ALTERNATIVE_VAR` | R-083 |
| AP-S04 | Access private storage without authentication | 403 Forbidden, download fails | Always include auth headers for private blobs/S3/storage | R-084 |
| AP-S05 | Use Express-style `res.json()` in Vercel serverless | Response may not be sent correctly | Use `res.status(code).json(body)` for Vercel compatibility | R-086 |
| AP-S06 | Implement logging "later" after functionality works | Hours wasted debugging production issues without visibility | Add structured logging from the first commit of any endpoint | R-087 |
| AP-S07 | Deploy without validating environment variables | 500 errors in production, missing config | Run startup validation that fails fast with clear messages | R-088 |
| AP-S08 | INSERT into columns that don't exist | Database error, failed writes | Verify schema before INSERT; keep migrations synchronized | R-089 |
| AP-S09 | Assume `user_id` or other NOT NULL columns have defaults | INSERT fails with constraint violation | Always include NOT NULL columns in INSERT statements | R-082 |

---

## Serverless Architecture Anti-Patterns (2026-02-24)

| ID | Anti-Pattern | Consequence | Prevention | Rule Ref |
|----|-------------|-------------|------------|----------|
| AP-S10 | Create `.js` file in `api/` without checking function budget | Deployment blocked (Vercel Hobby limit: 12 functions) | Run `find api -name "*.js" -not -path "*/_*" \| wc -l` before adding files. Prefer consolidating into existing routers | R-090 |
| AP-S11 | Place utility/helper files in `api/` without `_` directory prefix | Utility counted as serverless function, wastes budget | Always use `_`-prefixed directories: `_shared/`, `_handlers/`, `_utils/` | R-091 |

---

---

## UI Component Anti-Patterns (Wave 1 UX Evolution — 2026-03-05)

| ID | Anti-Pattern | Consequence | Prevention | Rule Ref |
|----|-------------|-------------|------------|----------|
| AP-W01 | Edit a file referenced in spec without verifying the actual path first | Edit goes to wrong file; bug remains; spec can have stale paths | Always `find src -name "*File*" -type f` before editing any spec-referenced file | R-092 |
| AP-W02 | Use `_prefix` aliasing to silence unused variable ESLint errors (e.g., `trend: _trend`) | ESLint still reports the error; `varsIgnorePattern` in this project doesn't cover destructuring aliases | Remove unused props from destructuring entirely; add them back when actually used | R-093 |
| AP-W03 | Use `screen.getByText('X%')` when the same text appears in multiple elements | `"Found multiple elements with text…"` test failure | Use `container.querySelector('.specific-class').textContent` for non-unique text | R-094 |
| AP-W04 | Import context (`useDashboardContext`, `DashboardProvider`) in a Wave 1 component | Violates Wave 1 purity guardrail; couples component to context, breaking reuse | Wave 1 = props only. Context integration belongs in Onda 2 (parent passes data as props) | R-095 |
| AP-W05 | Set `strokeDashoffset` only in Framer Motion `initial`/`animate` without `style` | Flash of full/empty ring before animation starts (browser renders default value) | Set `strokeDashoffset` in both `style` (static) and `initial`/`animate` (animated) | R-096 |
| AP-W06 | Use `color-mix()` CSS without `@supports` fallback | Silent failure on Safari < 16.2; no background color applied | Always add `@supports not (background: color-mix(...))` with a border fallback | R-097 |

---

## UI Component Anti-Patterns (Wave 2 UX Evolution — 2026-03-05)

| ID | Anti-Pattern | Consequence | Prevention | Rule Ref |
|----|-------------|-------------|------------|----------|
| AP-W07 | Write test expecting UTC timestamp as "tomorrow" when timezone is BRT (UTC-3) | Test fails: `2026-03-06T02:00:00Z` = 23:00 BRT = still "today" | Use `T04:00:00Z` (01:00 BRT) for reliable "next day" test data | R-020 |
| AP-W08 | Use `onRegister(medicineId, dosage)` interface from SwipeRegisterItem as if it were `onRegisterDose(protocolId, dosage)` | Wrong ID passed to logService.create(); log references wrong protocol | Always wrap: `onRegister={(_medicineId, dosage) => onRegisterDose(dose.protocolId, dosage)}` | R-102 |
| AP-W09 | Refactor Dashboard.jsx handlers when a new component has incompatible interface | High risk of breaking SmartAlerts, LogForm integrations in 932-line file | Create thin adapter functions (D-01 pattern); never refactor existing handlers for new components | R-098 |
| AP-W10 | Export internal sub-components (DoseCard, ZoneSection) from a parent component file | Increases API surface; creates unintended dependencies | Keep internal sub-components unexported; only export the public API | R-101 |
| AP-W11 | Pass a prop to an internal sub-component JSX but omit it from the function signature | Prop silently ignored; feature broken with no error or warning in runtime or tests | List ALL interaction props in destructuring; add click/interaction test for each callback | R-103 |
| AP-W12 | Use `\|\|` as fallback for numeric props that can legitimately be `0` | `dosage_per_intake = 0` becomes `1`; incorrect dose recorded | Use `??` (nullish coalescing) for numeric defaults; `\|\|` only for non-zero defaults | R-104 |
| AP-W13 | Leave dead code (old states, memos, handlers) after replacing a JSX section | CI lint failure; confuses future agents about what is active | Run `grep -n "NomeVarAntiga"` post-replacement; `npm run lint` before commit | R-105 |
| AP-W14 | Use `new Date('YYYY-MM-DDTHH:MM:00.000Z')` as reference in tests involving `setHours` | Test passes in BRT but fails in CI (UTC): same UTC timestamp = different local hours | Use `const now = new Date(); now.setHours(h, m, 0, 0)` for timezone-agnostic dates | R-106 |
| AP-W15 | Initialize state with `useState(() => derivedHook())` assuming it will stay reactive | State is stale if derived value changes after mount (e.g., `defaultViewMode` after complexity change) | Add `useEffect(() => { if (!savedPref) setState(derived) }, [derived])` | R-107 |
| AP-W16 | `bail: 1` em vitest.critical.config.js mascara múltiplas falhas timezone no mesmo arquivo | CI reporta apenas o PRIMEIRO teste que falha; outros testes timezone-dependentes no mesmo arquivo ficam ocultos, gerando múltiplos ciclos de fix | Rodar `test:critical` sem bail localmente (ou temporariamente) para revelar TODAS as falhas no arquivo antes de commitar | R-106 |
| AP-W17 | Componente com estado interno inicializado de uma prop (`complexityMode`) não reinicializa quando a prop muda | Defaults de expansão de seções ficam presos no valor do primeiro render; UX inconsistente ao mudar complexidade | Usar `key={controllingProp}` no componente para forçar remount completo quando o prop que define os defaults muda | R-109 |

---

*Last updated: 2026-03-05*
*Anti-patterns: AP-001 to AP-023 + AP-T01 to AP-T10 + AP-S01 to AP-S11 + AP-W01 to AP-W17*
