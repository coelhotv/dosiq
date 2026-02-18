# Documentation & Testing Overhaul Plan

**Version:** 1.0
**Date:** 2026-02-17
**Status:** DRAFT - Awaiting Approval
**Scope:** Complete restructuring of `/docs/`, global testing strategy, and `AGENTS.md` rewrite

---

## Table of Contents

1. [Audit Summary](#1-audit-summary)
2. [Documentation Restructuring Plan](#2-documentation-restructuring-plan)
3. [Global Testing Strategy](#3-global-testing-strategy)
4. [AGENTS.md Rewrite Plan](#4-agentsmd-rewrite-plan)
5. [Execution Task Plan](#5-execution-task-plan)

---

## 1. Audit Summary

### 1.1 Current Documentation Inventory

| File | Lines | Version Stated | Last Updated | Status |
|------|-------|----------------|--------------|--------|
| `AGENTS.md` | ~1200 | 2.7.0 | 2026-02-12 | Stale, massive, duplicates docs/ |
| `docs/ARQUITETURA.md` | 688 | 2.8.0 | 2026-02-13 | Partially current |
| `docs/ARQUITETURA_FRAMEWORK.md` | 796 | 1.0 | 2026-02-04 | Stale, overlaps ARQUITETURA |
| `docs/PADROES_CODIGO.md` | 1516 | - | - | Overlaps .roo/rules-code |
| `docs/CSS_ARCHITECTURE.md` | 503 | 1.1 | 2026-02-10 | Current |
| `docs/API_SERVICES.md` | 1004 | 2.8.0 | 2026-02-12 | Current |
| `docs/HOOKS.md` | 504 | - | - | Current |
| `docs/DATABASE_SCHEMAS.md` | 405 | - | 2026-02-15 | Current |
| `docs/TESTING_GUIDE.md` | 579 | - | - | Aspirational, not matching reality |
| `docs/OTIMIZACAO_TESTES_ESTRATEGIA.md` | 858 | 2.0 | 2026-02-11 | Stale metrics |
| `docs/SETUP.md` | 318 | - | - | Current |
| `docs/QUICKSTART.md` | 376 | - | - | Stale (says V2.2.1, 110+ tests) |
| `docs/LINT_COVERAGE.md` | 575 | - | 2026-02-12 | Historical report, not a guide |
| `docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` | 682 | 3.0.0 | 2026-02-15 | Current |
| `docs/GUIA_TITULACAO.md` | 340 | - | - | Current, user-facing |
| `docs/TRANSICAO_AUTOMATICA.md` | 317 | - | - | Current, user-facing |
| `docs/USER_GUIDE.md` | 50 | - | - | Incomplete stub |
| `docs/PULL_REQUEST_TEMPLATE.md` | - | - | - | Current |
| `.roo/rules-code/rules.md` | 712 | 2.8.0 | 2026-02-13 | Current |
| `.roo/rules-architecture/rules.md` | 681 | 2.8.0 | 2026-02-13 | Current |
| `.roo/rules/memory.md` | ~600 | - | 2026-02-16 | Current |
| `server/BOT README.md` | - | - | - | Current |
| `server/Telegram Bot Architect.md` | - | - | - | Current |
| `docs/past_deliveries/` | 30+ files | - | - | Archive clutter |

### 1.2 Critical Problems Found

#### A. Documentation Fragmentation & Overlap

1. **Architecture described in 3 places**: `docs/ARQUITETURA.md`, `docs/ARQUITETURA_FRAMEWORK.md`, `.roo/rules-architecture/rules.md` -- each with slightly different diagrams and details
2. **Code patterns in 3 places**: `docs/PADROES_CODIGO.md`, `.roo/rules-code/rules.md`, `AGENTS.md` -- conflicting naming conventions (e.g. rules-code says `kebab-case` for service files, actual code uses `camelCase`)
3. **Git workflow duplicated in 3 places**: `AGENTS.md`, `docs/PADROES_CODIGO.md`, `.roo/rules-code/rules.md`
4. **Testing documented in 2 places**: `docs/TESTING_GUIDE.md`, `docs/OTIMIZACAO_TESTES_ESTRATEGIA.md` -- with contradictory test counts

#### B. Stale / Contradictory Information

| Topic | Location A | Location B | Contradiction |
|-------|-----------|-----------|---------------|
| Test count | TESTING_GUIDE: "143 tests" | LINT_COVERAGE: "231+ tests" | Which is real? |
| Project version | QUICKSTART: "V2.2.1" | package.json: "2.8.1" | 6 versions behind |
| Features list | QUICKSTART: "110+ tests" | AGENTS.md: "110+ tests" | Both outdated |
| retryManager | ARQUITETURA diagram shows it | Memory says it was reverted | Phantom feature |

#### C. Test Infrastructure Chaos

**Test file locations -- 4 different patterns used:**

| Pattern | Example | Count |
|---------|---------|-------|
| `__tests__/` subfolder | `src/services/api/__tests__/logService.test.js` | ~15 files |
| Colocated with source | `src/components/protocol/ProtocolForm.test.jsx` | ~4 files |
| Root of directory | `src/services/api.test.js` | 1 file |
| Wrong directory entirely | `src/utils/__tests__/server/retryManager.test.js` | 1 file |

**Other test problems:**
- `src/hooks/__tests__/useCachedQuery.test 2.jsx` -- duplicate file with space in name
- `src/shared/components/ui/Button.test.jsx` AND `src/components/ui/Button.test.jsx` -- duplicate tests for duplicate components
- `server/` directory has ZERO tests despite complex bot logic
- `src/features/` directory has ZERO tests despite being the "new" organization
- `vitest.config.js` EXCLUDES all component tests by default (`**/src/components/**/*.test.jsx`)
- `vitest.critical.config.js` only looks at `src/services`, `src/utils`, `src/schemas`, `src/hooks` -- misses `src/features/`
- `vitest.smoke.config.js` uses deprecated `poolOptions.threads` API (Vitest 4+)
- No test configuration covers `src/features/` at all

#### D. AGENTS.md Problems

1. ~1200 lines -- too long for any agent to process efficiently
2. Duplicates entire Git workflow, code patterns, testing commands from docs
3. References "143 tests" (stale)
4. Contains the retryManager in architecture diagram (reverted)
5. Missing: where to put tests, how to write tests, test file naming convention
6. Missing: clear pointer to which doc is authoritative for what

---

## 2. Documentation Restructuring Plan

### 2.1 Design Principles

1. **Single Source of Truth**: Each topic has exactly ONE authoritative document
2. **Audience-Based**: Separate developer guides from agent rules from user docs
3. **Layered**: AGENTS.md is a concise routing table; detailed docs live in `/docs/`
4. **Current**: Every doc states its version and has a "last verified" date
5. **No Duplication**: Cross-reference instead of copy-pasting

### 2.2 Proposed Documentation Hierarchy

```
AGENTS.md                          # Concise agent routing table + critical rules only
README.md                          # Project overview for humans

docs/
  INDEX.md                         # Master documentation index with reading order

  # --- LAYER 1: Getting Started ---
  getting-started/
    SETUP.md                       # Environment setup (merge current SETUP + QUICKSTART)
    QUICKSTART.md                  # DELETED (merged into SETUP.md)

  # --- LAYER 2: Architecture & Design ---
  architecture/
    OVERVIEW.md                    # System architecture (consolidate ARQUITETURA + ARQUITETURA_FRAMEWORK)
    DATABASE.md                    # Database schemas (rename DATABASE_SCHEMAS)
    CSS.md                         # CSS architecture (rename CSS_ARCHITECTURE)
    TELEGRAM_BOT.md                # Bot architecture (consolidate TELEGRAM_BOT_NOTIFICATION_SYSTEM + server docs)

  # --- LAYER 3: Development Standards ---
  standards/
    CODE_PATTERNS.md               # Coding standards (consolidate PADROES_CODIGO + .roo/rules-code)
    GIT_WORKFLOW.md                # Git workflow extracted to its own file
    TESTING.md                     # THE authoritative testing guide (NEW - replaces 2 files)
    PULL_REQUEST_TEMPLATE.md       # PR template (move from docs root)

  # --- LAYER 4: API Reference ---
  reference/
    SERVICES.md                    # API services (rename API_SERVICES)
    HOOKS.md                       # Custom hooks (keep HOOKS)
    SCHEMAS.md                     # Zod schemas reference (NEW)

  # --- LAYER 5: Feature Guides ---
  features/
    TITRATION.md                   # Titration guide (rename GUIA_TITULACAO)
    AUTO_TRANSITION.md             # Auto transition (rename TRANSICAO_AUTOMATICA)
    USER_GUIDE.md                  # End-user guide (expand current stub)

  # --- Archive ---
  archive/
    past_deliveries/               # Move all delivery reports here
    LINT_COVERAGE.md               # Historical report
    OTIMIZACAO_TESTES_ESTRATEGIA.md  # Historical strategy doc

.roo/
  rules/
    memory.md                      # Keep as-is (agent memory)
  rules-code/
    rules.md                       # BECOMES a slim pointer to docs/standards/CODE_PATTERNS.md
  rules-architecture/
    rules.md                       # BECOMES a slim pointer to docs/architecture/OVERVIEW.md
```

### 2.3 Files to Delete / Merge

| Current File | Action | Target |
|-------------|--------|--------|
| `docs/ARQUITETURA.md` | Merge into | `docs/architecture/OVERVIEW.md` |
| `docs/ARQUITETURA_FRAMEWORK.md` | Merge into | `docs/architecture/OVERVIEW.md` |
| `docs/PADROES_CODIGO.md` | Merge into | `docs/standards/CODE_PATTERNS.md` + `docs/standards/GIT_WORKFLOW.md` |
| `docs/QUICKSTART.md` | Merge into | `docs/getting-started/SETUP.md` |
| `docs/TESTING_GUIDE.md` | Replace with | `docs/standards/TESTING.md` |
| `docs/OTIMIZACAO_TESTES_ESTRATEGIA.md` | Archive to | `docs/archive/` |
| `docs/LINT_COVERAGE.md` | Archive to | `docs/archive/` |
| `docs/CSS_ARCHITECTURE.md` | Move to | `docs/architecture/CSS.md` |
| `docs/API_SERVICES.md` | Move to | `docs/reference/SERVICES.md` |
| `docs/HOOKS.md` | Move to | `docs/reference/HOOKS.md` |
| `docs/DATABASE_SCHEMAS.md` | Move to | `docs/architecture/DATABASE.md` |
| `docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` | Merge into | `docs/architecture/TELEGRAM_BOT.md` |
| `docs/GUIA_TITULACAO.md` | Move to | `docs/features/TITRATION.md` |
| `docs/TRANSICAO_AUTOMATICA.md` | Move to | `docs/features/AUTO_TRANSITION.md` |
| `docs/USER_GUIDE.md` | Move to | `docs/features/USER_GUIDE.md` |
| `docs/PULL_REQUEST_TEMPLATE.md` | Move to | `docs/standards/PULL_REQUEST_TEMPLATE.md` |
| `docs/past_deliveries/*` | Move to | `docs/archive/past_deliveries/` |
| `docs/tech-specs/*` | Move to | `docs/archive/tech-specs/` |

### 2.4 New Files to Create

| File | Purpose | Content Source |
|------|---------|---------------|
| `docs/INDEX.md` | Master index with reading order by audience | New |
| `docs/standards/TESTING.md` | Authoritative testing guide | Section 3 of this plan |
| `docs/standards/GIT_WORKFLOW.md` | Git workflow extracted | From PADROES_CODIGO + AGENTS.md |
| `docs/reference/SCHEMAS.md` | Zod schemas reference | New, from schema source code |

---

## 3. Global Testing Strategy

### 3.1 Current State Assessment

**What exists:**
- 5 vitest config files with overlapping/conflicting settings
- ~25 test files scattered across 4 different organizational patterns
- 4 smoke tests, ~15 unit tests, a few component tests
- CI pipeline with 4 jobs (lint, smoke, critical, build) -- no full test job
- Pre-commit hook runs vitest on changed files
- Pre-push hook runs `test:critical`

**What is broken:**
- Default `vitest.config.js` EXCLUDES all component tests
- `vitest.critical.config.js` ignores `src/features/` entirely
- `vitest.smoke.config.js` uses deprecated Vitest 4 API
- Server code (`server/`) has zero test coverage
- A server test file lives in `src/utils/__tests__/server/` (wrong location)
- Duplicate test file with space in name (`useCachedQuery.test 2.jsx`)
- No test exists for any `src/features/` module
- No convention enforced for test colocation vs `__tests__/` folders

### 3.2 Testing Architecture Design

#### Test Pyramid

```
                    /\
                   /  \         E2E Tests (FUTURE - not in scope)
                  /    \        Manual smoke testing in browser
                 /------\
                /        \      Integration Tests
               / Services \     Service + Supabase mocks
              /   + API    \    ~20% of test suite
             /--------------\
            /                \   Unit Tests
           /  Schemas, Utils, \  Pure functions, hooks, components
          /   Hooks, Components\ ~80% of test suite
         /----==================\
        /                        \ Smoke Tests
       /  Build + Critical Paths  \ Subset of unit tests
      /____________________________\ ~5% of test suite
```

#### Test Categories

| Category | Naming Convention | Config | Trigger | Scope |
|----------|------------------|--------|---------|-------|
| **Smoke** | `*.smoke.test.{js,jsx}` | `vitest.smoke.config.js` | CI Job 2, `npm run test:smoke` | Build verification, critical path validation |
| **Unit** | `*.test.{js,jsx}` | `vitest.config.js` | CI Job 3, `npm run test` | All pure logic: schemas, utils, hooks, services |
| **Component** | `*.test.jsx` (in components/) | `vitest.component.config.js` | CI Job 4, `npm run test:components` | React component rendering and interaction |
| **Integration** | `*.integration.test.{js,jsx}` | `vitest.integration.config.js` | CI Job 5, `npm run test:integration` | Cross-service, multi-module flows |

### 3.3 Test File Location Standard

**Rule: ALL tests use the `__tests__/` subfolder pattern.**

This was chosen over colocation because:
- Cleaner file tree for non-test navigation
- Easier to glob for CI configurations
- Clear visual separation of production vs test code
- Consistent with the majority of existing tests in this project

```
src/
  services/
    api/
      medicineService.js
      __tests__/
        medicineService.test.js
        medicineService.integration.test.js
  schemas/
    medicineSchema.js
    __tests__/
      medicineSchema.test.js
      medicineSchema.smoke.test.js
  utils/
    adherenceLogic.js
    __tests__/
      adherenceLogic.test.js
  hooks/
    useCachedQuery.js
    __tests__/
      useCachedQuery.test.jsx
  components/
    medicine/
      MedicineCard.jsx
      __tests__/
        MedicineCard.test.jsx
  features/
    dashboard/
      hooks/
        useDashboardContext.jsx
      __tests__/
        useDashboardContext.test.jsx
      services/
        insightService.js
      __tests__/            # One __tests__ per leaf directory with testable code
        insightService.test.js

server/
  bot/
    __tests__/
      tasks.test.js
      alerts.test.js
  services/
    __tests__/
      deadLetterQueue.test.js
  utils/
    __tests__/
      retryManager.test.js
      formatters.test.js
```

### 3.4 Test File Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Unit test | `{sourceFileName}.test.{js,jsx}` | `medicineSchema.test.js` |
| Smoke test | `{sourceFileName}.smoke.test.{js,jsx}` | `medicineSchema.smoke.test.js` |
| Integration test | `{sourceFileName}.integration.test.{js,jsx}` | `stockService.integration.test.js` |
| Component test | `{ComponentName}.test.jsx` | `MedicineCard.test.jsx` |

### 3.5 What Each Test Type Must Cover

#### Smoke Tests (build + critical path)
- **Purpose**: Fast fail-safe. If these break, nothing works.
- **Scope**: Schema exports, service factory functions, critical util functions
- **Max execution time**: 10 seconds total
- **Rules**:
  - No external mocks (no Supabase, no fetch)
  - Test only that modules export correctly and basic contracts hold
  - One smoke test per domain: medicines, protocols, stock, adherence, hooks

#### Unit Tests (pure logic)
- **Purpose**: Validate individual functions, hooks, and components in isolation.
- **Scope**:
  - **Schemas**: Every Zod schema validates correct data and rejects invalid data
  - **Utils**: Every exported function with edge cases
  - **Hooks**: Behavior testing with `renderHook`
  - **Services**: Business logic with Supabase mocked
  - **Components**: Rendering, user interaction, state changes
- **Rules**:
  - Mock ALL external dependencies (Supabase, fetch, localStorage)
  - Each test file maps 1:1 to a source file
  - Use `describe` blocks organized by function/method
  - Use Portuguese for test descriptions (matches project convention)
  - Test both success and error paths
  - Use relative date helpers, never hardcoded dates

#### Component Tests (React-specific)
- **Purpose**: Verify component rendering, props handling, user interactions
- **Scope**: All components in `src/components/` and `src/shared/components/`
- **Rules**:
  - Use `@testing-library/react` exclusively (no `enzyme`, no direct DOM)
  - Mock framer-motion with the standard destructure pattern (documented below)
  - Mock Supabase at the service level, not at the component level
  - Test: renders without crash, handles props, user interactions, loading/error states
  - Accessibility: key interactive elements must have accessible labels

#### Integration Tests (cross-module)
- **Purpose**: Verify that modules work together correctly
- **Scope**: Service chains (e.g., log creation + stock decrement), form submission flows
- **Rules**:
  - Can use less mocking than unit tests
  - Must still mock Supabase (no real DB calls)
  - Test realistic user flows end-to-end within the frontend

### 3.6 Standard Test Patterns

#### Mocking Supabase
```javascript
// __mocks__/supabase.js (shared mock)
export const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
}

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}))
```

#### Mocking Framer Motion
```javascript
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ initial, animate, exit, transition, whileHover, whileTap, ...props }) => <div {...props} />),
    span: vi.fn(({ initial, animate, exit, transition, ...props }) => <span {...props} />),
  },
  AnimatePresence: vi.fn(({ children }) => <>{children}</>),
}))
```

#### Date Handling
```javascript
// ALWAYS use relative dates
const getRelativeDate = (daysOffset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().split('T')[0]
}

// NEVER use fixed dates
// BAD: const date = '2026-02-11'
```

#### Test Description Language
```javascript
// Use Portuguese for describe/it blocks
describe('medicineSchema', () => {
  describe('validação de criação', () => {
    it('deve aceitar dados válidos', () => { /* ... */ })
    it('deve rejeitar nome vazio', () => { /* ... */ })
    it('deve rejeitar dosagem negativa', () => { /* ... */ })
  })
})
```

### 3.7 Vitest Configuration Consolidation

**Reduce from 5 configs to 3:**

| Config | Purpose | Includes |
|--------|---------|----------|
| `vitest.config.js` | Default -- runs ALL tests | Everything under `src/` |
| `vitest.smoke.config.js` | Smoke only | `*.smoke.test.*` files |
| `vitest.ci.config.js` | CI/CD full suite with coverage | Everything + coverage report |

**Delete:**
- `vitest.critical.config.js` -- replace with npm script using include patterns
- `vitest.light.config.js` -- replace with `--changed` flag
- `vitest.component.config.js` -- merge into default config

**Key changes to default `vitest.config.js`:**
- REMOVE the exclude for component tests (`**/src/components/**/*.test.jsx`)
- ADD include for `src/features/`
- FIX pool configuration for Vitest 4+
- REMOVE `isolate: false` (causes flaky tests with shared state)

### 3.8 NPM Scripts Consolidation

**Current: 20+ test scripts. Proposed: 10 focused scripts.**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "vitest run --config vitest.smoke.config.js",
    "test:changed": "vitest run --changed=main",
    "test:coverage": "vitest run --config vitest.ci.config.js",
    "test:components": "vitest run --include 'src/components/**/__tests__/*.test.jsx' --include 'src/shared/components/**/__tests__/*.test.jsx'",
    "test:services": "vitest run --include 'src/services/**/__tests__/*.test.js' --include 'src/features/**/services/__tests__/*.test.js'",
    "validate": "npm run lint && npm run test",
    "validate:quick": "npm run lint && npm run test:changed",
    "validate:full": "npm run lint && npm run test:coverage && npm run build"
  }
}
```

### 3.9 CI/CD Pipeline Redesign

```
PR Opened / Push to main
         |
    [Job 1: Lint]                    ~2 min
         |
    [Job 2: Build]                   ~3 min
         |
    [Job 3: Smoke Tests]             ~10 sec
         |
    [Job 4: Unit + Component Tests]  ~3 min
         |
    [Job 5: Full Suite + Coverage]   ~5 min
         |
    [Upload Coverage Artifact]
         |
    PASS = Merge allowed
```

**Changes from current pipeline:**
- Build runs BEFORE tests (catch build errors faster, smoke no longer needs to build)
- Smoke tests run standalone (no `npm run build` prefix needed)
- Single "full test" job replaces separate critical/build jobs
- Coverage always generated in CI (not optional)

### 3.10 Test Migration Tasks

Files that need to be moved to comply with the `__tests__/` standard:

| Current Location | Move To |
|-----------------|---------|
| `src/components/protocol/ProtocolChecklistItem.test.jsx` | `src/components/protocol/__tests__/ProtocolChecklistItem.test.jsx` |
| `src/components/protocol/ProtocolForm.test.jsx` | `src/components/protocol/__tests__/ProtocolForm.test.jsx` |
| `src/components/protocol/TitrationWizard.test.jsx` | `src/components/protocol/__tests__/TitrationWizard.test.jsx` |
| `src/components/ui/Button.test.jsx` | `src/components/ui/__tests__/Button.test.jsx` |
| `src/services/api.test.js` | `src/services/__tests__/api.test.js` |
| `src/utils/__tests__/server/retryManager.test.js` | `server/utils/__tests__/retryManager.test.js` |

**Files to delete:**
| File | Reason |
|------|--------|
| `src/hooks/__tests__/useCachedQuery.test 2.jsx` | Duplicate with space in name |
| `src/shared/components/ui/Button.test.jsx` | Duplicate of `src/components/ui/Button.test.jsx` |

### 3.11 Coverage Targets

| Domain | Current (est.) | Target (Phase 1) | Target (Phase 2) |
|--------|---------------|-------------------|-------------------|
| `src/schemas/` | ~80% | 95% | 95% |
| `src/utils/` | ~70% | 85% | 90% |
| `src/services/` | ~60% | 75% | 85% |
| `src/hooks/` | ~50% | 70% | 80% |
| `src/components/` | ~20% | 40% | 60% |
| `src/features/` | 0% | 30% | 60% |
| `server/` | 0% | 20% | 50% |
| **Overall** | ~40% | **55%** | **70%** |

---

## 4. AGENTS.md Rewrite Plan

### 4.1 Design Principles

The current `AGENTS.md` is ~1200 lines and tries to be everything: setup guide, architecture doc, code standards, testing guide, git workflow, and memory system. This makes it too long for agents to parse efficiently and causes constant duplication.

**New approach:** AGENTS.md becomes a **concise routing table** (~300-400 lines max) that:
1. Gives agents the critical rules they MUST follow (non-negotiable constraints)
2. Points them to the right doc for detailed information
3. Contains ZERO duplicated content from `/docs/`

### 4.2 Proposed AGENTS.md Structure

```markdown
# Meus Remedios - AI Agent Guide
## 1. Project Identity (10 lines)
   - What the project is, tech stack summary, version

## 2. Documentation Map (20 lines)
   - Table: "For X, read Y" routing to docs/

## 3. Critical Constraints (50 lines)
   - React hook order (States > Memos > Effects > Handlers)
   - Zod values in Portuguese
   - Telegram callback_data < 64 bytes
   - Dosage in pills, never mg
   - Operation order: Validate > Record > Decrement
   - LogForm dual return type check

## 4. Development Commands (20 lines)
   - dev, build, lint, test commands

## 5. Testing Rules (30 lines)
   - Where to put tests (__tests__/ folders)
   - Naming convention
   - Which test command to run when
   - Link to docs/standards/TESTING.md

## 6. Git Workflow Summary (20 lines)
   - Branch > Validate > Commit > Push > PR > Review > Merge
   - Link to docs/standards/GIT_WORKFLOW.md

## 7. Code Style Quick Reference (20 lines)
   - Naming table, import order, language rules
   - Link to docs/standards/CODE_PATTERNS.md

## 8. Security (10 lines)
   - RLS, env vars, Zod validation

## 9. Agent Memory System (10 lines)
   - Where memory.md lives, how to update it
```

### 4.3 What Gets REMOVED from AGENTS.md

| Section | Moved To |
|---------|----------|
| Full architecture diagram | `docs/architecture/OVERVIEW.md` |
| Full technology stack table | `docs/architecture/OVERVIEW.md` |
| Full project structure tree | `docs/architecture/OVERVIEW.md` |
| Detailed Git workflow steps | `docs/standards/GIT_WORKFLOW.md` |
| Full code style guidelines | `docs/standards/CODE_PATTERNS.md` |
| Full testing commands matrix | `docs/standards/TESTING.md` |
| Gemini Code Reviewer section | `docs/standards/GIT_WORKFLOW.md` |
| Full onboarding flow | `docs/architecture/OVERVIEW.md` |
| SWR cache details | `docs/reference/HOOKS.md` |
| Common issues section | `docs/standards/TESTING.md` + relevant docs |
| All memory entries | `.roo/rules/memory.md` (already there) |

### 4.4 .roo Rules Files Update

Both `.roo/rules-code/rules.md` and `.roo/rules-architecture/rules.md` will be slimmed down to:
1. A brief summary of the 5 most critical rules for that mode
2. A clear pointer: "For complete standards, see `docs/standards/CODE_PATTERNS.md`"

This prevents the current problem where rules files duplicate 700+ lines from docs.

---

## 5. Execution Task Plan

### Phase 1: Foundation (Testing Infrastructure)

| # | Task | Priority | Depends On |
|---|------|----------|------------|
| 1.1 | Create `docs/standards/TESTING.md` with the complete testing strategy from Section 3 | P0 | - |
| 1.2 | Fix `vitest.config.js`: remove component test exclusion, add `src/features/` support, fix pool config | P0 | - |
| 1.3 | Fix `vitest.smoke.config.js`: update deprecated `poolOptions.threads` API | P0 | - |
| 1.4 | Delete `vitest.critical.config.js` and `vitest.light.config.js` | P1 | 1.2 |
| 1.5 | Create `vitest.ci.config.js` with coverage settings | P1 | 1.2 |
| 1.6 | Move mislocated test files to `__tests__/` pattern (see 3.10) | P0 | 1.1 |
| 1.7 | Delete duplicate test files (`useCachedQuery.test 2.jsx`, shared `Button.test.jsx`) | P0 | - |
| 1.8 | Consolidate npm test scripts in `package.json` (see 3.8) | P1 | 1.2, 1.4 |
| 1.9 | Move `server/utils/retryManager.test.js` to correct location | P0 | 1.1 |
| 1.10 | Update `.github/workflows/test.yml` CI pipeline (see 3.9) | P1 | 1.2, 1.5, 1.8 |

### Phase 2: Documentation Restructure

| # | Task | Priority | Depends On |
|---|------|----------|------------|
| 2.1 | Create directory structure: `docs/getting-started/`, `docs/architecture/`, `docs/standards/`, `docs/reference/`, `docs/features/`, `docs/archive/` | P0 | - |
| 2.2 | Create `docs/INDEX.md` master documentation index | P0 | 2.1 |
| 2.3 | Consolidate `ARQUITETURA.md` + `ARQUITETURA_FRAMEWORK.md` into `docs/architecture/OVERVIEW.md` | P0 | 2.1 |
| 2.4 | Move and update `DATABASE_SCHEMAS.md` to `docs/architecture/DATABASE.md` | P1 | 2.1 |
| 2.5 | Move and update `CSS_ARCHITECTURE.md` to `docs/architecture/CSS.md` | P1 | 2.1 |
| 2.6 | Consolidate `TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` + server docs into `docs/architecture/TELEGRAM_BOT.md` | P1 | 2.1 |
| 2.7 | Consolidate `PADROES_CODIGO.md` into `docs/standards/CODE_PATTERNS.md` (deduplicate with .roo rules) | P0 | 2.1 |
| 2.8 | Extract Git workflow into `docs/standards/GIT_WORKFLOW.md` | P0 | 2.1 |
| 2.9 | Move `PULL_REQUEST_TEMPLATE.md` to `docs/standards/` | P1 | 2.1 |
| 2.10 | Move `API_SERVICES.md` to `docs/reference/SERVICES.md`, update internal links | P1 | 2.1 |
| 2.11 | Move `HOOKS.md` to `docs/reference/HOOKS.md`, update internal links | P1 | 2.1 |
| 2.12 | Create `docs/reference/SCHEMAS.md` from schema source code | P2 | 2.1 |
| 2.13 | Merge `SETUP.md` + `QUICKSTART.md` into `docs/getting-started/SETUP.md` | P1 | 2.1 |
| 2.14 | Move feature guides (`GUIA_TITULACAO`, `TRANSICAO_AUTOMATICA`, `USER_GUIDE`) to `docs/features/` | P2 | 2.1 |
| 2.15 | Expand `USER_GUIDE.md` from 50-line stub to complete guide | P2 | 2.14 |
| 2.16 | Archive `LINT_COVERAGE.md`, `OTIMIZACAO_TESTES_ESTRATEGIA.md`, `past_deliveries/`, `tech-specs/` to `docs/archive/` | P1 | 2.1 |
| 2.17 | Delete old files from `docs/` root after moves are complete | P0 | 2.3-2.16 |
| 2.18 | Update all cross-references and internal links across moved docs | P0 | 2.17 |

### Phase 3: AGENTS.md & Rules Rewrite

| # | Task | Priority | Depends On |
|---|------|----------|------------|
| 3.1 | Rewrite `AGENTS.md` as concise routing table (~300-400 lines, see Section 4.2) | P0 | Phase 2 |
| 3.2 | Slim down `.roo/rules-code/rules.md` to critical rules + pointer to `docs/standards/CODE_PATTERNS.md` | P0 | 2.7 |
| 3.3 | Slim down `.roo/rules-architecture/rules.md` to critical rules + pointer to `docs/architecture/OVERVIEW.md` | P0 | 2.3 |
| 3.4 | Update `.roo/rules/memory.md` with this overhaul as a memory entry | P1 | Phase 3 |

### Phase 4: Validation & Gap Filling

| # | Task | Priority | Depends On |
|---|------|----------|------------|
| 4.1 | Run `npm run lint` -- verify zero errors | P0 | All phases |
| 4.2 | Run `npm run test` -- verify all tests pass with new config | P0 | Phase 1 |
| 4.3 | Run `npm run build` -- verify production build succeeds | P0 | All phases |
| 4.4 | Verify all internal doc links resolve correctly | P0 | Phase 2, 3 |
| 4.5 | Write missing smoke tests for `src/features/` modules | P1 | Phase 1 |
| 4.6 | Write initial unit tests for `server/` modules (tasks, formatters, DLQ) | P2 | Phase 1 |
| 4.7 | Verify version numbers are consistent across all docs (should say 2.8.1) | P1 | Phase 2 |

---

## Appendix A: Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Moving test files breaks CI | High | Run full test suite after each move, verify CI green |
| Changing vitest.config.js makes previously-passing tests fail | Medium | Keep old configs until new one is verified |
| Broken internal links after doc moves | Medium | Script to verify all markdown links |
| Agents reference old doc paths | Medium | AGENTS.md rewrite includes all new paths |
| Large PR is hard to review | Low | Split into 4 PRs matching the 4 phases |

## Appendix B: PR Strategy

This work should be split into **4 separate PRs**, one per phase:

1. **PR #1**: `feat(test): restructure testing infrastructure` -- Phase 1
2. **PR #2**: `docs: restructure documentation hierarchy` -- Phase 2
3. **PR #3**: `docs(agents): rewrite AGENTS.md as routing table` -- Phase 3
4. **PR #4**: `test: add missing tests and validate` -- Phase 4

Each PR should be independently mergeable and not break anything if merged alone.
