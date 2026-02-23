# Project Rules (Graduated from Experience)

> Source of truth for all project-specific rules learned through development.
> Do NOT duplicate these in AGENTS.md, .gemini/styleguide.md, or other files — link here.
> See [README.md](/.memory/README.md) for how this system works.

---

## File Management

### R-001: Duplicate File Check [CRITICAL]
**Rule:** Before modifying ANY file, search for duplicates with the same name. If duplicates exist, trace which file is actually imported. Modify only the canonical file; delete duplicates.
**Source:** journal/archive (5+ incidents in W06-W08)
**Commands:**
```bash
find src -name "*TargetFile*" -type f
grep -r "from.*TargetFile" src/ | head -20
```

### R-002: Path Alias Verification [HIGH]
**Rule:** When you see `@adherence/services/x`, verify it resolves to `src/features/adherence/services/x` (NOT `src/services/api/`). Always check `vite.config.js` for alias definitions.
**Source:** journal/archive (production bugs from wrong file modified)

### R-003: Import Existence Check [HIGH]
**Rule:** Never import files that do not exist. Always validate with `npm run build` before pushing.
**Source:** journal/archive (ERR_MODULE_NOT_FOUND from orphaned retryManager import)

---

## React Patterns

### R-010: Hook Declaration Order [CRITICAL]
**Rule:** Always declare in order: States -> useMemo -> useEffect -> Handlers. Declaring state after useMemo causes TDZ (Temporal Dead Zone) ReferenceError.
**Source:** journal/archive (Dashboard crash from snoozedAlertIds TDZ)
```jsx
// Correct
const [data, setData] = useState()
const processed = useMemo(() => transform(data), [data])
useEffect(() => { fetch() }, [processed])
const handleClick = () => { ... }

// Wrong — ReferenceError
const processed = useMemo(() => data + 1, [data]) // data undefined!
const [data, setData] = useState(0)
```

### R-011: LogForm Dual Return Type [HIGH]
**Rule:** LogForm returns Array when `type === 'plan'` (bulk), Object when `type === 'protocol'`. Always check `Array.isArray(logData)` before processing.
**Source:** journal/archive

---

## Data & Validation

### R-020: Timezone — Local Dates [CRITICAL]
**Rule:** ALWAYS use `parseLocalDate(dateStr)` from `@utils/dateUtils` or `new Date(dateStr + 'T00:00:00')`. NEVER use `new Date('YYYY-MM-DD')` — creates UTC midnight, which is 21:00 previous day in GMT-3.
**Source:** journal/archive (production adherence score bug)
```javascript
// Correct
import { parseLocalDate } from '@utils/dateUtils'
const date = parseLocalDate('2026-02-18')

// Wrong — midnight UTC = 21:00 Feb 17 in GMT-3
const date = new Date('2026-02-18')
```

### R-021: Zod Enums in Portuguese [HIGH]
**Rule:** All Zod schema enum values must be in Portuguese. English values cause UI inconsistencies. Always export labels for UI display.
**Source:** journal/archive
```javascript
// Correct
const FREQUENCIES = ['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']
export const FREQUENCY_LABELS = { diário: 'Diário', dias_alternados: 'Dias Alternados', ... }

// Wrong
const FREQUENCIES = ['daily', 'weekly']
```

### R-022: Dosage in Pills, Not Milligrams [CRITICAL]
**Rule:** `quantity_taken` must be recorded in pills (within Zod limit of 100), never in milligrams. Recording 2000mg exceeds schema validation.
**Source:** journal/archive

### R-023: Operation Order for Doses [HIGH]
**Rule:** Always follow Validate -> Record -> Decrement order for dose registration. Validate stock first, then create log, then decrease stock.
**Source:** journal/archive

---

## Telegram Bot

### R-030: Callback Data < 64 Bytes [HIGH]
**Rule:** Use numeric indices in `callback_data`, not UUIDs. Store full mapping in session.
**Source:** journal/archive
```javascript
// Correct
callback_data: `reg_med:${index}`
session.set('medicineMap', medicines)

// Wrong — exceeds 64 bytes
callback_data: `reg_med:${medicineId}:${protocolId}`
```

### R-031: MarkdownV2 Escaping [HIGH]
**Rule:** Always use `escapeMarkdownV2()` for messages with `parse_mode: 'MarkdownV2'`. Escape backslash FIRST, then other 17 special characters. Do NOT escape text in `answerCallbackQuery` (plain text).
**Source:** journal/archive (DLQ errors from unescaped `!`)

### R-032: shouldSendNotification() Includes Logging [MEDIUM]
**Rule:** `shouldSendNotification()` already calls `logNotification()` internally. Never call `logNotification()` explicitly after it returns true — causes duplicate logs.
**Source:** journal/archive

---

## Infrastructure

### R-040: Vercel API Rewrites [HIGH]
**Rule:** Always add explicit rewrites in `vercel.json` for new API routes. The catch-all `/(.*) -> /index.html` must be the LAST rewrite. Use `:id` syntax for dynamic parameters.
**Source:** journal/archive (DLQ 405 errors)

### R-041: No process.exit() in Serverless [HIGH]
**Rule:** Never use `process.exit()` in Vercel serverless functions. Use `throw new Error()` instead. Conditional dotenv: `if (process.env.NODE_ENV !== 'production')`.
**Source:** journal/archive (bot crash in production)

### R-042: Service Role Authentication [HIGH]
**Rule:** Any endpoint using `service_role` key (which bypasses RLS) MUST have authentication. Verify admin identity via Supabase Auth + ADMIN_CHAT_ID.
**Source:** journal/archive (PR #73 security fix)

---

## Code Quality

### R-050: JSDoc in Portuguese [MEDIUM]
**Rule:** All JSDoc comments must be in Portuguese from the first commit. Template: `/** Descricao. @param {tipo} nome - Descricao. @returns {tipo} Descricao. */`
**Source:** journal/archive (PR #44 review)

### R-051: Validate Before Push [HIGH]
**Rule:** Always run `npm run validate:quick` (lint + changed tests) during development. Run `npm run validate` (lint + all tests) before creating PR.
**Source:** journal/archive

---

## Agent Coordination

### R-060: No Self-Merge for Code Agents [CRITICAL]
**Rule:** Never allow a code agent to merge its own PR. Code creates PR → Debug/Code reviews → DevOps merges only after explicit approval.
**Source:** journal/2026-W09 (coordination failure)

### R-061: Mandatory Review Pause [HIGH]
**Rule:** Always have a pause for review between coding tasks. Never create sequential tasks without validation gates. Quality checkpoints must exist between implementation phases.
**Source:** journal/2026-W09 (coordination failure)

### R-062: Quality Over Speed [HIGH]
**Rule:** One well-reviewed PR is worth more than 3 rushed PRs. Never sacrifice code review rigor for delivery speed. Gemini Code Assist review is non-negotiable.
**Source:** journal/2026-W09 (coordination failure)

### R-063: Process as Protection [MEDIUM]
**Rule:** The rigorous workflow exists to prevent errors. Never skip steps "just this once." Process violations compound into production failures.
**Source:** journal/2026-W09 (coordination failure)

### R-065: Read Memory Before Coding [CRITICAL]
**Rule:** Every Code agent MUST read `.memory/rules.md` and `.memory/anti-patterns.md` BEFORE writing any code. This prevents repeating known mistakes and ensures compliance with project standards.

**Required sequence:**
1. Read `.memory/rules.md` → Note relevant R-NNN rules
2. Read `.memory/anti-patterns.md` → Note relevant AP-NNN patterns
3. Check for duplicate files (R-001)
4. Only then start coding

**Source:** Agent feedback from PR #132 review process

---

## Test Anti-Patterns (Testing Infrastructure Overhaul — 2026-02)

### R-070: No `setTimeout` in `act()` Blocks [HIGH]
**Rule:** Never use `setTimeout(resolve, N)` inside `act()` to "wait for component to load". Use `waitFor(() => expect(result.current.isLoading).toBe(false))` instead. Hardcoded delays fail when component takes longer than N milliseconds.

**Source:** useDashboardContext.test.jsx (11 hanging instances before fix)

```javascript
// WRONG — hangs if component takes >100ms
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
})

// CORRECT — polls until condition or timeout
await waitFor(() => expect(result.current.isLoading).toBe(false))
```

### R-071: Mock External Services in Hook Tests [CRITICAL]
**Rule:** Any hook test that renders a Provider which calls external services (Supabase, API) MUST mock those services at the module level with `vi.mock()`. Without mocks, the hook fires real network calls that hang indefinitely in test environments.

**Source:** useDashboardContext.test.jsx — no mocks for medicineService, protocolService, logService

```javascript
// Required at the top of any test file that uses DashboardProvider
vi.mock('@medications/services/medicineService', () => ({
  medicineService: { getAll: vi.fn().mockResolvedValue([]) },
}))
```

### R-072: Always Resolve Dangling Promises [HIGH]
**Rule:** When a test creates a manually-controlled Promise (capturing `resolve` from the executor), ALWAYS resolve it in a `finally` block. If an assertion fails before the manual `resolve()` call, the Promise stays pending and Vitest hangs waiting for it.

**Source:** StockForm.test.jsx "disable buttons while submitting" test

```javascript
// WRONG — resolveSave() never called if waitFor throws
resolveSave()  // ← orphaned if assertion above fails

// CORRECT
try {
  await waitFor(() => { expect(...).toBeInTheDocument() })
} finally {
  resolveSave?.()
}
```

### R-073: Use Fake Timers for Timer-Dependent Tests [MEDIUM]
**Rule:** Tests that depend on real elapsed time (e.g., "wait 150ms for 100ms async to settle") are inherently flaky in CI. Use `vi.useFakeTimers()` and `vi.runAllTimersAsync()` for deterministic control. Always call `vi.useRealTimers()` in `afterEach` or `finally`.

**Source:** useCachedQuery.test.jsx "should not update state after unmount"

### R-074: Use `validate:agent` for Agent Sessions [HIGH]
**Rule:** When running tests from an agent session, always use `npm run validate:agent` (not `validate:quick` or `validate:full`). The wrapper enforces a 10-minute kill switch. If test suite needs more than 10 minutes, it indicates broken tests that need fixing, not a higher timeout.

**Source:** Testing Infrastructure Overhaul 2026-02

**Exit codes:**
- `0` — Tests passed
- `1` — Tests failed
- `124` — Timeout exceeded (kill after 10min)

---

## Low-RAM Machine Optimization (2026-02-23)

### R-075: Low-RAM Test Compatibility [CRITICAL for MacBook Air 2013]
**Rule:** All tests must pass on 8GB RAM machines using `npm run test:lowram`. Split large test files (>300 lines) into smaller files by test scope (one hook/component per file). Each file = fresh worker = no memory accumulation.

**Source:** 2026-02-23 low-RAM optimization sprint

```bash
# MacBook Air 2013 (8GB) command
npm run test:lowram  # Sequential execution, excludes memory-intensive tests
```

---

### R-076: Disable localStorage in Tests [HIGH]
**Rule:** Tests must disable localStorage persistence to save ~200MB memory. The queryCache must check `process.env.NODE_ENV === 'test'` and skip `localStorage.setItem()` / `localStorage.getItem()` operations.

**Source:** 2026-02-23 queryCache optimization

```javascript
// CORRECT - Skip localStorage in test env
function persistCache() {
  if (process.env.NODE_ENV === 'test') return
  localStorage.setItem(CACHE_CONFIG.PERSIST_KEY, JSON.stringify(entries))
}

// WRONG - Accumulates memory in tests
function persistCache() {
  localStorage.setItem(CACHE_CONFIG.PERSIST_KEY, JSON.stringify(entries))
}
```

---

### R-077: Cancel setInterval in Tests [HIGH]
**Rule:** Global `setInterval` (e.g., for garbage collection) MUST be cancellable and restarted in test hooks. Intervals that run during tests cause memory accumulation. Export `cancelGarbageCollection()` / `restartGarbageCollection()` functions from modules.

**Source:** 2026-02-23 queryCache GC optimization

```javascript
// Module: queryCache.js
let gcInterval = setInterval(garbageCollect, 60000)
export function cancelGarbageCollection() {
  if (gcInterval) { clearInterval(gcInterval); gcInterval = null }
}
export function restartGarbageCollection() {
  if (!gcInterval) { gcInterval = setInterval(garbageCollect, 60000) }
}

// Test setup
beforeAll(() => { cancelGarbageCollection() })
afterAll(() => { restartGarbageCollection() })
```

---

### R-078: Aggressive Test Cleanup [HIGH]
**Rule:** Every test's `afterEach` hook must call: (1) `clearCache()`/`clearState()`, (2) `vi.clearAllMocks()`, (3) `vi.clearAllTimers()`, (4) optionally `if (global.gc) global.gc()` for low-RAM machines.

**Source:** 2026-02-23 test isolation

```javascript
afterEach(() => {
  clearCache()
  vi.clearAllMocks()
  vi.resetAllMocks()
  vi.clearAllTimers()
  if (global.gc) global.gc()  // Hint JVM to GC
})
```

---

### R-079: Split Test Files by Scope [HIGH]
**Rule:** Test files >300 lines must be split by feature/hook/component. Each file tests ONE logical unit to prevent memory accumulation. Pattern: `{source}.test.jsx` for main tests, separate files for related utilities.

**Examples:**
- ✅ GOOD: `useCachedQuery.test.jsx` (12 tests, 230 lines) + `useCachedQueries.test.jsx` (5 tests, 140 lines)
- ❌ BAD: Single 500-line file with all query hooks

**Source:** 2026-02-23 test architecture

---

### R-080: Parallel Query Chains Cause OOM [KNOWN LIMITATION]
**Rule:** Tests using `Promise.all()` on multiple parallel queries (queryCache behavior) accumulate memory faster than single-query tests. Known problematic patterns:
- `useCachedQueries()` with 3+ parallel fetchers
- `useCachedMutation()` with multiple cache invalidations

**Current Status:** Excluded from `vitest.lowram.config.js` pending architectural fix to queryCache.

**Workaround:** Run on machines with >16GB RAM or use `npm run test:critical` (parallel pool) instead of `test:lowram` (sequential).

**Architectural Fix (TODO):**
- Replace `Promise.all()` with streaming/pagination
- Use `WeakMap` for cache to enable GC of unused entries
- Implement LRU eviction more aggressively

**Source:** 2026-02-23 useCachedQueries OOM diagnosis

---

## Low-RAM Machine Support Matrix

| Hardware | Status | Command | Notes |
|----------|--------|---------|-------|
| MacBook Air 2013 (8GB, Intel) | ✅ Partial | `npm run test:lowram` | 12/25 tests pass; excludes 2 problematic files |
| MacBook Pro 16GB (M1) | ✅ Full | Any command | All features work |
| CI/CD (GitHub Actions) | ✅ Full | `npm run validate:full` | No RAM constraints |

---

*Last updated: 2026-02-23*
*Rules: R-001 to R-080*
