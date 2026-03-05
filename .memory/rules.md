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

**When to use:** For waiting on React state changes (loading flags, data arrival). See also R-073 for timer control.

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

**When to use:** For controlling timers in code under test (debounces, throttles, delays). NOT for waiting on React state — use R-070 waitFor() instead.

**Complementary rules:**
- **R-070:** For waiting on React state changes (use waitFor with polling)
- **R-073:** For controlling/fast-forwarding time in tests (use fake timers)

**Source:** useCachedQuery.test.jsx "should not update state after unmount"

### R-074: Use `validate:agent` for Agent Sessions [HIGH]
**Rule:** When running tests from an agent session, always use `npm run validate:agent` (not `validate:quick` or `validate:full`). The wrapper enforces a 10-minute kill switch. If test suite needs more than 10 minutes, it indicates broken tests that need fixing, not a higher timeout.

**Context:** This is the agent-specific variant of R-081 (Test Suite Performance Strategy). Agents MUST use validate:agent; humans use test:fast/test:lowram/validate:full per R-081.

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

### R-080: Cache Architecture Optimizations [FIXED]
**Rule:** The following OOM issues in queryCache architecture have been FIXED (2026-02-23):
1. **Generation Counter** — Prevents background revalidation from writing after `clearCache()`
2. **TTL Eviction** — Garbage collector now purges entries older than 2× STALE_TIME (60s)
3. **Debounced Persistence** — `localStorage` writes debounced to 500ms (was synchronous)
4. **Access Counter Reset** — `accessCounter` properly reset in `clearCache()` for LRU
5. **Render Loop Fix** — `useCachedQueries` now uses stable `queriesKey` instead of `[queries]` array
6. **Code Deduplication** — Extracted `executeParallelQueries()` to eliminate `fetchAll`/`refetchAll` duplication

**Tests Status:** All 26 test files now pass on 8GB machines with `npm run test:lowram`.

**Source:** 2026-02-23 cache architecture refactoring (Phase 4b)

---

### R-081: Test Suite Performance Strategy [HIGH]
**Rule:** Choose the right test command for the context:

⚠️ **AGENT-SPECIFIC NOTE:** Agents MUST ALWAYS use `validate:agent` — see R-074 for mandatory compliance. The table below is primarily guidance for human developers.

| Context | Command | Config | Threads | Duration | Use Case |
|---------|---------|--------|---------|----------|----------|
| **Development (default)** | `npm run test:fast` | vitest.config.js | 1 | ~6.5 min | Local development, catch syntax errors |
| **Development (parallel)** | `npx vitest run --singleThread=false --maxThreads=2` | vitest.config.js | 2 | ~3-4 min | When speed is critical (fast iteration) |
| **Low-RAM machines** | `npm run test:lowram` | vitest.lowram.config.js | sequential | ~20 min | MacBook Air 8GB, only before push |
| **Validation (agents)** | `npm run validate:agent` | vitest.critical.config.js | 4+ | <10 min | **MANDATORY (R-074)** — 10-min kill switch |
| **CI/CD** | `npm run validate:full` | vitest.ci.config.js | 4+ | <5 min | Production validation, max parallelism |

**Explanation:**
- **1 thread (default)**: Safe baseline, no race conditions, ~390s for 26 files
- **2 threads**: Risk of race conditions in poorly-isolated tests, ~50% faster
- **4+ threads**: Only for CI/CD with >16GB RAM, risk of OOM on 8GB machines
- **Sequential (lowram)**: Slowest (~20 min) but guaranteed to work on 8GB with minimal footprint

**Decision Matrix:**
- Local dev? Use `npm run test:fast` (1 thread, 6.5 min) ← **RECOMMENDED**
- Need speed? Try `--maxThreads=2` (3-4 min) with caution
- 8GB machine? Use `npm run test:lowram` (20 min) only before push
- Agent/CI? Timeout enforcement via `validate:agent` / `validate:full`

**Source:** 2026-02-23 test performance analysis

---

## Low-RAM Machine Support Matrix

| Hardware | Status | Recommended Command | Duration | Notes |
|----------|--------|---------------------|----------|-------|
| MacBook Air 2013 (8GB, Intel) | ✅ FULL | `npm run test:lowram` | ~20 min | Sequential execution, all 234 tests pass |
| MacBook Air / Pro (8GB) | ✅ Recommended | `npm run test:fast` | ~6.5 min | 1 thread (safe), good for local iteration |
| MacBook Pro 16GB (M1/M2) | ✅ FAST | `npx vitest run --maxThreads=2` | ~3-4 min | 2 threads, works well with more RAM |
| Development Agents | ✅ Enforced | `npm run validate:agent` | <10 min | Timeout enforced via script wrapper |
| CI/CD (GitHub Actions) | ✅ Full | `npm run validate:full` | <5 min | 4+ threads, no constraints |

**Historical Note:**
- Previous `vitest.config.js` was hardcoded to `singleThread: true` (1 thread) — made it slow
- All test configs now properly support parallelism with safe defaults

---

## Schema & Database Synchronization (2026-02-24)

### R-082: Zod-SQL Schema Synchronization [CRITICAL]
**Rule:** Zod schemas and database schemas MUST be synchronized. Any CHECK constraint, NOT NULL constraint, or enum in the database MUST have a corresponding validation in Zod. When one changes, the other must be updated in the same commit.

**Source:** Sprint 7 Gemini Integration (PR #146, #152) - Multiple constraint violations

**Common mismatches:**
- Database has CHECK constraint but Zod allows any value
- Zod has default value that database doesn't accept
- Database column is NOT NULL but Zod field is optional
- Zod enum values don't match database CHECK constraint

**Prevention:**
```javascript
// CORRECT - Zod matches database CHECK constraint
// Database: CHECK (category IN ('estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade'))
const categorySchema = z.enum(['estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade'])

// WRONG - 'geral' is not in the database CHECK constraint
const categorySchema = z.enum(['estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade', 'geral'])
```

---

### R-083: Environment Variable Fallbacks [HIGH]
**Rule:** When accessing environment variables that may have alternative names across environments (local vs CI vs production), always provide fallbacks. Never assume a specific variable name exists everywhere.

**Source:** Sprint 7 Gemini Integration (PR #149) - SUPABASE_URL vs VITE_SUPABASE_URL

**Common scenarios:**
- `VITE_*` prefix for Vite-exposed variables vs unprefixed for server-side
- Different naming conventions between CI and production
- Legacy variable names still in some environments

**Pattern:**
```javascript
// CORRECT - Fallback for alternative names
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

// WRONG - Assumes specific variable name
const SUPABASE_URL = process.env.SUPABASE_URL // Fails if only VITE_SUPABASE_URL exists
```

---

### R-084: Private Storage Authentication [HIGH]
**Rule:** When accessing private storage (Vercel Blob, S3, etc.), always include authentication headers. Never assume storage is publicly accessible without explicit confirmation.

**Source:** Sprint 7 Gemini Integration (PR #150) - 403 Forbidden on blob downloads

**Pattern:**
```javascript
// CORRECT - Include auth header for private storage
const response = await fetch(blobUrl, {
  headers: {
    'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
  }
})

// WRONG - Assumes public access
const response = await fetch(blobUrl)
```

---

### R-085: Nullable Schema Fields [HIGH]
**Rule:** When a field can receive `null` from external sources (APIs, databases, parsers), use `.nullable().optional()` in Zod. Using only `.optional()` allows `undefined` but rejects `null`.

**Source:** Sprint 7 Gemini Integration (PR #151) - suggestion field rejecting null

**Pattern:**
```javascript
// CORRECT - Accepts undefined, null, or string
const schema = z.object({
  suggestion: z.string().nullable().optional()
})

// WRONG - Rejects null (only accepts undefined or string)
const schema = z.object({
  suggestion: z.string().optional()
})
```

---

### R-086: Serverless Response Format [HIGH]
**Rule:** In Vercel serverless functions, always use `res.status(code).json(body)` format. Never use Express-style `res.json()` or `res.send()` without explicit status.

**Source:** Sprint 7 Gemini Integration (PR #152) - Response headers not sent correctly

**Pattern:**
```javascript
// CORRECT - Vercel serverless format
return res.status(200).json({ success: true, data })

// WRONG - Express style (may not work correctly in Vercel)
return res.json({ success: true, data })
```

---

### R-087: Structured Logging from Day One [HIGH]
**Rule:** Implement structured logging (with timestamp, level, context, and correlation IDs) from the first commit of any API endpoint. Never treat logging as "nice to have" — it's essential for debugging production issues.

**Source:** Sprint 7 Gemini Integration (PR #148) - Hours wasted debugging without logs

**Pattern:**
```javascript
// CORRECT - Structured logging from the start
export function log(endpoint, level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    level,
    message,
    correlationId: getCorrelationId(),
    ...data
  }
  console.log(JSON.stringify(logEntry))
}

// WRONG - No structure, hard to parse in production logs
console.log('Error:', error.message)
```

---

## Pre-Deployment Validation (2026-02-24)

### R-088: Pre-Deployment Environment Checklist [CRITICAL]
**Rule:** Before deploying any new API endpoint or service, validate ALL required environment variables exist in the target environment. Create a startup check that fails fast with clear messages.

**Source:** Sprint 7 Gemini Integration (PR #149) - Missing env vars caused 500 errors

**Checklist pattern:**
```javascript
// Startup validation
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VERCEL_GITHUB_ACTIONS_SECRET',
  'BLOB_READ_WRITE_TOKEN'
]

function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v] && !process.env[`VITE_${v}`])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
```

---

### R-089: Database Column Existence Check [HIGH]
**Rule:** When writing INSERT statements, verify all columns exist in the target table. Never assume columns exist based on previous versions or documentation — check the actual schema.

**Source:** Sprint 7 Gemini Integration (PR #146) - `review_data` column didn't exist

**Prevention:**
- Keep migration files synchronized with code
- Use TypeScript types generated from database schema
- Add integration tests that actually insert data

---

## Serverless Architecture (2026-02-24)

### R-090: Vercel Hobby 12-Function Limit [CRITICAL]
**Rule:** The Vercel Hobby plan allows a maximum of 12 serverless functions per deployment. Every `.js` file inside `api/` (including subdirectories) counts as a function, UNLESS it is inside a directory prefixed with `_` or `.`. Before creating ANY new `.js` file in `api/`, verify the current function budget.

**Source:** Deployment blocked when adding `api/share.js` (13th function). See `plans/SERVERLESS_CONSOLIDATION.md`.

**Prevention:**
```bash
# Count current functions (exclude _-prefixed dirs and non-.js files)
find api -name "*.js" -not -path "*/_*" -not -path "*/.*" -not -name "CLAUDE.md" | wc -l

# If >= 10: consolidate into existing router instead of creating new file
```

**Current budget (post-consolidation):** 6/12 functions used, 6 slots free.

**Router pattern for new endpoints:**
```javascript
// Instead of creating api/new-endpoint.js, add to existing router:
// api/domain.js → dispatch by req.query.action or URL segment
```

---

### R-091: Underscore Prefix for API Utilities [HIGH]
**Rule:** Helper files, shared utilities, and extracted handler functions inside `api/` MUST be placed in directories prefixed with `_` (underscore). Without the prefix, Vercel counts them as serverless functions even if they don't export an HTTP handler.

**Source:** `api/gemini-reviews/shared/logger.js` and `security.js` were counted as functions, wasting 2 of the 12-function budget.

**Correct patterns:**
- `api/gemini-reviews/_shared/logger.js` — NOT counted as function
- `api/gemini-reviews/_handlers/persist.js` — NOT counted as function
- `api/dlq/_handlers/retry.js` — NOT counted as function

**Wrong patterns:**
- `api/gemini-reviews/shared/logger.js` — COUNTED as function
- `api/gemini-reviews/helpers/utils.js` — COUNTED as function
- `api/utils.js` — COUNTED as function

---

---

## UI Component Patterns (Wave 1 UX Evolution — 2026-03-05)

### R-092: Spec Path Verification Before Edit [HIGH]
**Rule:** Before editing any file referenced in a spec/task, always verify the actual path with `find`. Specs often reference canonical paths that differ from where the file actually lives.
**Source:** journal/2026-W10 (L-01) — W1-04 spec said `src/shared/components/log/SwipeRegisterItem.jsx`, actual file was `src/features/dashboard/components/SwipeRegisterItem.jsx`.
```bash
find src -name "*TargetFile*" -type f
# Then trace imports before editing
grep -r "from.*TargetFile" src/ | head -10
```

### R-093: ESLint Unused Vars — Remove, Don't Alias [HIGH]
**Rule:** When a destructured prop/variable is unused, remove it from destructuring entirely. Do NOT rely on `_prefix` aliasing (e.g., `trend: _trend`) to silence ESLint — `varsIgnorePattern` in this project does not reliably cover aliased destructuring.
**Source:** journal/2026-W10 (L-02) — `trend: _trend = 'neutral'` still failed ESLint in RingGauge.
```jsx
// CORRECT — remove from destructuring (add back when actually used in Onda 2)
const { score, streak, size, onClick } = props

// WRONG — _alias doesn't silence ESLint for destructuring aliases
const { score, trend: _trend, streak } = props  // _trend still flagged
```

### R-094: CSS Selector Over getByText for Non-Unique Text [HIGH]
**Rule:** When asserting on text that may appear in multiple DOM elements (e.g., "80%" in stats badge AND tooltip labels), use `container.querySelector('.specific-class').textContent` instead of `screen.getByText()`. Using `getByText()` on non-unique text throws "Found multiple elements matching…".
**Source:** journal/2026-W10 (L-03) — SparklineAdesao "80%" appeared in tooltip + stats badge.
```javascript
// CORRECT — target the specific element
expect(container.querySelector('.sparkline-average').textContent).toBe('80%')

// WRONG — fails if text appears in multiple elements
expect(screen.getByText('80%')).toBeInTheDocument() // throws: found 2 elements
```

### R-095: Wave 1 Component Purity — No Context Imports [CRITICAL for Onda 1]
**Rule:** All components created in Wave 1 (Onda 1) must receive data ONLY via props. Never import `useDashboardContext`, `DashboardProvider`, or any feature context. Integration with context happens in Onda 2 (the parent component fetches from context and passes as props).
**Source:** journal/2026-W10 (L-07) — guardrail defined in spec, confirmed as critical.

### R-096: Framer Motion SVG — Set strokeDashoffset in Both style and initial [MEDIUM]
**Rule:** For SVG `motion.circle` with `strokeDashoffset` animation, set the value in BOTH `style` (static CSS) and `initial`/`animate` (Framer Motion). Without `style`, the browser renders the default `strokeDashoffset: 0` (full ring) before Framer Motion takes control → visible flash on load.
**Source:** journal/2026-W10 (L-06) — RingGauge ring showed full circle flash before animating.
```jsx
// CORRECT — style prevents flash; initial/animate handle animation
<motion.circle
  style={{ strokeDashoffset: circumference - (score / 100) * circumference }}
  initial={{ strokeDashoffset: circumference }}
  animate={{ strokeDashoffset: circumference - (score / 100) * circumference }}
/>

// WRONG — flash: browser renders default 0 before Framer Motion overrides
<motion.circle
  initial={{ strokeDashoffset: circumference }}
  animate={{ strokeDashoffset: circumference - (score / 100) * circumference }}
/>
```

### R-097: CSS color-mix() Progressive Enhancement [MEDIUM]
**Rule:** When using `color-mix()` for background or border colors (e.g., heat map transparency), wrap in `@supports` with a graceful fallback. Safari < 16.2 does not support `color-mix()`.
**Source:** journal/2026-W10 (L-05) — Calendar heat map needed `@supports not` fallback.
```css
/* CORRECT — fallback for Safari < 16.2 */
@supports not (background: color-mix(in srgb, red 50%, transparent)) {
  .calendar-day.has-adherence {
    border: 1px solid var(--heat-color);
  }
}
.calendar-day.has-adherence {
  background: color-mix(in srgb, var(--heat-color) 25%, transparent);
}

/* WRONG — fails silently on older Safari */
.calendar-day.has-adherence {
  background: color-mix(in srgb, var(--heat-color) 25%, transparent);
}
```

---

### R-098: DoseZoneList Adapter Pattern (D-01) — Interface Mismatch [HIGH]
**Rule:** When a new component (DoseZoneList) has a different callback interface than the existing Dashboard handlers, create thin adapter functions. Do NOT refactor existing handlers to match.
**Source:** Wave 2 implementation (W2-10)
**Adapters created:**
- `handleRegisterFromZone(protocolId, dosagePerIntake)` → calls `handleRegisterDose(medicine_id, protocolId, dosagePerIntake)`
- `handleBatchRegisterDoses(doseItems[])` → calls `logService.createBulk()`
- `handleToggleDoseSelection(protocolId, scheduledTime)` → updates `selectedDoseKeys` Set
**Why not refactor:** Dashboard.jsx is 932+ lines; refactoring handleRegisterDose would risk breaking SmartAlerts and LogForm interactions.

### R-099: selectedMedicines useState Position (D-02) — Known Tech Debt [MEDIUM]
**Rule:** The `selectedMedicines` useState in Dashboard.jsx is at line ~535 (after handlers), violating States-first order. Do NOT move it in Wave 2 or 3 without a dedicated refactor PR.
**Source:** Wave 2 analysis (D-02 architectural decision)
**Note:** Wave 3+ should create a separate PR to fix hook order in Dashboard.jsx before adding more complexity.

### R-100: Multiple useDashboard() Calls are Safe (D-03) [INFO]
**Rule:** Multiple components (Dashboard, useComplexityMode, useDoseZones) calling `useDashboard()` is safe and correct. React Context consumers always receive the same object reference — no performance penalty.
**Source:** Wave 2 analysis (D-03 architectural decision)

### R-101: DoseZoneList Internal Sub-components [HIGH]
**Rule:** DoseCard and ZoneSection are internal sub-components of DoseZoneList, NOT exported. This is intentional — they have no use outside DoseZoneList and exporting them prematurely increases API surface.
**Source:** Wave 2 W2-03 implementation

### R-102: SwipeRegisterItem onRegister vs onRegisterDose Mismatch [HIGH]
**Rule:** SwipeRegisterItem calls `onRegister(medicineId, dosagePerIntake)`. DoseZoneList needs `onRegisterDose(protocolId, dosagePerIntake)`. Use a closure wrapper:
```jsx
onRegister={(_medicineId, dosage) => onRegisterDose(dose.protocolId, dosage)}
```
**Source:** Wave 2 W2-03 (plan mode integration)

---

*Last updated: 2026-03-05*
*Rules: R-001 to R-102*
