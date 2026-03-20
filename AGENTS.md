# Meus Remédios - AI Agent Guide

> **Aplicativo de gerenciamento de medicamentos em português brasileiro**
> **Versão:** 3.3.0 (Fase 5 ✅ + Mobile Perf M0-M8 ✅ + HealthHistory P1-P4 ✅) | React 19 + Vite + Supabase

---

## 📋 Project Identity

**Meus Remédios** is a medication management PWA featuring:
- Multi-user authentication (Supabase Auth + RLS)
- Treatment protocols with dose titration
- Stock management with alerts
- Telegram Bot integration
- Dashboard with gamification
- PWA capabilities (Service Worker, Push Notifications)

**Tech Stack**: React 19 + Vite 7 + Supabase + Zod + Framer Motion 12 + Custom Cache Hook (useCachedQuery) + Vitest

---

## 🗺️ Documentation Map

**For detailed information, read the appropriate document:**

| Need to... | Read... |
|-----------|---------|
| **Set up environment** | [`docs/getting-started/SETUP.md`](docs/getting-started/SETUP.md) |
| **Understand architecture** | [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) *(consolidating)* |
| **Learn coding standards** | [`docs/PADROES_CODIGO.md`](docs/PADROES_CODIGO.md) *(consolidating)* |
| **Write tests** | [`docs/standards/TESTING.md`](docs/standards/TESTING.md) ✅ |
| **Follow Git workflow** | [`docs/standards/GIT_WORKFLOW.md`](docs/standards/GIT_WORKFLOW.md) ✅ |
| **Create PR** | [`docs/standards/PULL_REQUEST_TEMPLATE.md`](docs/standards/PULL_REQUEST_TEMPLATE.md) |
| **Use services API** | [`docs/reference/SERVICES.md`](docs/reference/SERVICES.md) |
| **Use hooks** | [`docs/reference/HOOKS.md`](docs/reference/HOOKS.md) |
| **Use Zod schemas** | [`docs/reference/SCHEMAS.md`](docs/reference/SCHEMAS.md) ✅ |
| **Mobile performance** | [`docs/standards/MOBILE_PERFORMANCE.md`](docs/standards/MOBILE_PERFORMANCE.md) ✅ — Lazy loading, code splitting, CSS, assets, touch UX |
| **Mobile perf roadmap** | [`plans/EXEC_SPEC_MOBILE_PERFORMANCE.md`](plans/EXEC_SPEC_MOBILE_PERFORMANCE.md) — M0-M6 execution spec (M2 ✅) |
| **Execute UX specs** | [`plans/EXEC_SPEC_UX_EVOLUTION.md`](plans/EXEC_SPEC_UX_EVOLUTION.md) + `plans/specs/` |
| **Understand database** | [`docs/architecture/DATABASE.md`](docs/architecture/DATABASE.md) |
| **CSS architecture** | [`docs/architecture/CSS.md`](docs/architecture/CSS.md) |
| **Telegram bot** | [`docs/architecture/TELEGRAM_BOT.md`](docs/architecture/TELEGRAM_BOT.md) ✅ |
| **Chatbot IA (F8.1)** | [`docs/architecture/CHATBOT_AI.md`](docs/architecture/CHATBOT_AI.md) ✅ — contextBuilder, safetyGuard, Groq API, hallucinations |
| **Gemini/AI code review** | [`docs/standards/GEMINI_INTEGRATION.md`](docs/standards/GEMINI_INTEGRATION.md) ✅ |

**Agent-specific rules:**
- **Long-term memory**: [`.memory/`](.memory/) (rules, knowledge, anti-patterns, journal)

---

## 🚨 Critical Constraints (Top 8 Quick Reference)

> Complete rules with examples: [`.memory/rules.md`](.memory/rules.md)
> Anti-patterns table: [`.memory/anti-patterns.md`](.memory/anti-patterns.md)

| # | Constraint | Rule | Ref |
|---|-----------|------|-----|
| **0** | **NO SELF-MERGE** | Agent codes → Gemini reviews → Agent fixes → **USER APPROVES → USER MERGES** | R-060 ⚠️ |
| **0** | **QUALITY > SPEED** | One solid PR > 3 rushed PRs. Approval delays are CORRECT, not bottlenecks | R-062 ⚠️ |
| 1 | **Duplicate Files** | Check `find src -name "*File*"` before modifying ANY file | R-001 |
| 2 | **Hook Order** | States -> Memos -> Effects -> Handlers (prevents TDZ) | R-010 |
| 3 | **Timezone** | Always `parseLocalDate()`, never bare `new Date('YYYY-MM-DD')` | R-020 |
| 4 | **Zod Enums** | Portuguese only: `['diario', 'semanal']` | R-021 |
| 5 | **Dosage Units** | Pills (not mg), `quantity_taken` within Zod limit of 100 | R-022 |
| 6 | **Serverless Limit** | Vercel Hobby max 12 functions. Check budget before adding `.js` to `api/`. Utilities in `_`-prefixed dirs | R-090 |
| 7 | **Mobile Performance** | All views lazy-loaded + Suspense + ViewSkeleton; Vite manualChunks (8 chunks); R-117 | M2 ✅ |

---

## 🚀 Mobile Performance Initiative (M0-M8 + P1-P4 ✅)

**Status:** Todos sprints M0-M8 + P1-P4 **MERGED** (último: PR #403, 2026-03-20)

| Sprint | Focus | Status | Impact |
|--------|-------|--------|--------|
| **M0** | Lazy imports + startTransition + Virtuoso | ✅ | -400ms TTI |
| **M1** | Virtuoso list optimization | ✅ | -600ms LCP (HealthHistory) |
| **M2** | Lazy views + manualChunks + ViewSkeleton | ✅ | 989KB → 102kB gzip (89% reduction) |
| **M3** | DB indexes + query optimization | ✅ | -5sec initial load |
| **M5** | CSS/Assets fixes + favicon compression | ✅ | -50ms FCP |
| **M6** | Touch UX (tap, scroll, overscroll) | ✅ | Better mobile feel |
| **P1** | cachedAdherenceService SWR + protocols 1× | ✅ | -3 duplicate queries |
| **P2** | loadData faseado (requestIdleCallback) | ✅ | 12+ → 2 concurrent requests |
| **P3** | Slim select timeline | ✅ | 76% payload reduction |
| **P4** | Slim Dashboard + getUserId cache + streaks | ✅ | 13 → 1 auth roundtrip, Zod read validation |
| **D1-D6** | Dashboard first load optimization | 🔜 | Target: 25 → ≤12 queries, <5s 4G |

**Key Deliverables (M2):**
- ✅ 13 views converted to `React.lazy()` + Suspense
- ✅ ViewSkeleton component (skeleton loading fallback)
- ✅ Vite manualChunks: 8 vendor/feature chunks
- ✅ Critical bug fix: Landing without Suspense (would crash for unauth users)
- ✅ `docs/standards/MOBILE_PERFORMANCE.md` created (Sections 1-2, incremental expansion M3-M6)
- ✅ `plans/EXEC_SPEC_MOBILE_PERFORMANCE.md` execution spec

**Performance Gains:**
- Main bundle: **102.47 kB gzip** (down from 989KB)
- jsPDF + html2canvas: 174KB (lazy, on export handler trigger)
- medicineDatabase: 105KB (lazy, on medicines view)
- FCP improvement: ~500ms faster on mid-tier devices
- Tests: ✅ 539/539 passing, 0 lint errors

**When to Use ViewSkeleton:**
```jsx
const Medicines = lazy(() => import('./views/Medicines'))

// ✅ CORRECT
<Suspense fallback={<ViewSkeleton />}>
  <Medicines {...props} />
</Suspense>

// ❌ WRONG
<Medicines {...props} />  // Will crash at lazy boundary
<Suspense fallback={<Spinner />}>  // ViewSkeleton is standard
  <Medicines {...props} />
</Suspense>
```

**Rule R-117:** All non-critical views (non-Dashboard) MUST be lazy-loaded. Suspension fallback MUST be ViewSkeleton. Never lazy-load Dashboard (critical path).

**Documentation:**
- [`docs/standards/MOBILE_PERFORMANCE.md`](docs/standards/MOBILE_PERFORMANCE.md) — Living standards (Sections 1-2: principles, lazy loading)
- [`plans/EXEC_SPEC_MOBILE_PERFORMANCE.md`](plans/EXEC_SPEC_MOBILE_PERFORMANCE.md) — Roadmap with all 6 sprints + gap analysis
- [`CLAUDE.md`](CLAUDE.md) — R-117 rule reference

**Next:** D1-D6 — Dashboard first load optimization (spec: `plans/EXEC_SPEC_DASHBOARD_FIRST_LOAD.md`).

---

**Canonical File Locations (Wave 9 — estrutura final):**
| Domain | Canonical Location | Obs |
|--------|-------------------|-----|
| API Services (adherence/dlq) | `src/services/api/adherenceService.js`, `dlqService.js` | Unicos sem equivalente em feature |
| Feature Services | `src/features/*/services/*.js` | Ex: `@medications/services/medicineService` |
| Shared Services | `src/shared/services/*.js` e `src/shared/services/api/logService.js` | cachedServices, migrationService |
| Schemas | `src/schemas/*.js` | **Unico local** para schemas Zod |
| Utils | `src/utils/*.js` | adherenceLogic, dateUtils, titrationUtils |
| Hooks | `src/shared/hooks/*.js` | useCachedQuery, useTheme, useHapticFeedback, useShake |
| Shared Components | `src/shared/components/**/*.jsx` | ui/, gamification/, log/, onboarding/, pwa/ |
| Feature Components | `src/features/*/components/*.jsx` | Componentes especificos da feature |
| Supabase client | `@shared/utils/supabase` | Era `src/lib/supabase.js` (deletado) |
| Cache util | `@shared/utils/queryCache` | Era `src/lib/queryCache.js` (deletado) |

> **Wave 9 concluida**: `src/lib/`, `src/hooks/`, `src/components/`, `src/shared/constants/`, `src/features/*/constants/` e servicos duplicados em `src/services/api/` foram **deletados**. ESLint `no-restricted-imports` agora bloqueia importacoes de caminhos legados.

**Path Aliases (defined in `vite.config.js`):**
| Alias | Resolves To |
|-------|-------------|
| `@` | `src/` |
| `@features` | `src/features` |
| `@shared` | `src/shared` |
| `@services` | `src/services` |
| `@dashboard` | `src/features/dashboard` |
| `@medications` | `src/features/medications` |
| `@protocols` | `src/features/protocols` |
| `@stock` | `src/features/stock` |
| `@adherence` | `src/features/adherence` |
| `@schemas` | `src/schemas` |
| `@utils` | `src/utils` |

**CRITICAL**: `@adherence/services/x` resolves to `src/features/adherence/services/x`, NOT `src/services/api/`. Always verify!

---

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Vite dev server (http://localhost:5173)
npm run bot          # Telegram bot locally

# Build & Deploy
npm run build        # Production build
npm run preview      # Preview build locally

# Testing (see docs/standards/TESTING.md)
npm run test         # All tests (run once)
npm run test:watch   # Tests in watch mode (local dev)
npm run test:smoke   # Smoke tests only (~10s)
npm run test:critical # Critical tests (services, utils, schemas, hooks)
npm run test:unit    # All unit tests without coverage (~8 min)
npm run test:changed # Only changed files since main (~30s)
npm run test:components # Components (src/components + src/shared/components)
npm run test:services   # Services + features (src/services + src/features)
npm run test:coverage   # Full suite with coverage report (CI)

# Validation (all include timeout protection)
npm run lint          # ESLint check
npm run validate:agent # **AGENTS USE THIS**: critical tests + bail-fast + 10min timeout
npm run validate:quick # Lint + test:changed + 5min timeout (pre-commit)
npm run validate:full  # Lint + coverage + build + 15min timeout (full CI)
```

---

## 📋 Sprint Delivery Workflow

**Use the `/deliver-sprint` skill** for structured, zero-defect sprint delivery:

```bash
/deliver-sprint
```

**This skill provides a 7-phase workflow:**
1. **Setup & Exploration** (10–15 min) — Read spec, explore codebase, verify patterns
2. **Implementation** (45–60 min) — Code following project standards (Schemas → Services → Components → Tests → CSS)
3. **Validation Local** (5–10 min) — `npm run validate:agent` must pass
4. **Git & Documentation** (5 min) — Update memory, semantic commits
5. **Push & Code Review** (5–30 min) — Push, create PR, **WAIT FOR GEMINI REVIEW**
6. **Merge & Cleanup** (5 min) — **ONLY AFTER EXPLICIT USER APPROVAL** (R-060)
7. **Final Documentation** (5–10 min) — Update spec, journal, MEMORY.md

**⚠️ CRITICAL**: Agent role ends at Phase 5.3 (all Gemini suggestions applied). Agent MUST WAIT for explicit user approval before Phase 6 (merge).

---

## 🧪 Testing Rules

### Where to Put Tests
**Rule**: ALL tests use `__tests__/` subfolder pattern

```
src/features/medications/services/
  medicineService.js
  __tests__/
    medicineService.test.js
```

### Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Unit test | `{file}.test.{js,jsx}` | `medicineService.test.js` |
| Smoke test | `{file}.smoke.test.{js,jsx}` | `medicineSchema.smoke.test.js` |
| Integration | `{file}.integration.test.{js,jsx}` | `stockService.integration.test.js` |

### Which Test Command to Run

| File Type | Command | Rationale |
|-----------|---------|-----------|
| `*.service.js` | `npm run test:critical` | Services are business logic |
| `*.schema.js` | `npm run test:critical` | Schemas are critical validation |
| `*.util.js` | `npm run test:critical` | Pure functions |
| `*.jsx` (component) | `npm run test:components` | UI components |
| Any file (agent session) | `npm run validate:agent` | Timeout + bail-fast (10 min) |
| Any file (pre-commit) | `npm run test:changed` | Quick check before commit |

**📖 Complete guide**: [`docs/standards/TESTING.md`](docs/standards/TESTING.md)

---

## 🔄 Git Workflow Summary

### Core Principles

**R-060 (CRITICAL — Non-Negotiable):** Code agents NEVER merge their own PRs without explicit user (Product Owner) approval.
```
Correct Flow:
Agent codes → Gemini reviews → Agent applies fixes → USER APPROVES → USER MERGES → Agent documents

Agent role ends at: "PR created + all Gemini suggestions applied + awaiting your approval"
```

**R-062 (CRITICAL — Quality Over Speed):** One well-reviewed PR > 3 rushed PRs. Each phase of `/deliver-sprint` has purpose.
```
Wrong:  Rush implementation → skip validation → force merge = production bugs
Right:  Thorough implementation → wait for review → await approval → merge = quality delivery

Approval delays are NORMAL and CORRECT. They represent:
  ✓ Code review completeness
  ✓ Quality assurance
  ✓ Knowledge transfer
```

### Workflow Steps

```
1. CREATE BRANCH:    git checkout -b feature/wave-X/nome
2. MAKE CHANGES:     Follow coding standards
3. VALIDATE:         npm run validate:agent (MUST PASS — 10min timeout)
4. COMMIT:           git commit -m "feat(scope): descrição" (semantic)
5. PUSH:             git push origin feature/wave-X/nome
6. CREATE PR:        Use template, fill all sections, await Gemini review
7. APPLY FIXES:      Address all Gemini suggestions (Phase 5.3)
8. WAIT FOR USER:    **BLOCKING STEP** — Agent MUST STOP here (R-060)
9. USER MERGES:      User reviews and merges (Phase 6 — user only)
10. DOCUMENT:        Agent updates spec, journal, MEMORY.md (Phase 7)
```

**⚠️ NEVER:**
- Commit directly to `main` (R-060)
- Skip validation (R-062)
- Use `--no-verify` (defeats pre-commit hooks)
- Merge without explicit user approval (R-060)
- Rush phases to finish faster (R-062)

**📖 Complete guide**: [`docs/standards/GIT_WORKFLOW.md`](docs/standards/GIT_WORKFLOW.md)

### Quality Gates Between Phases

**Before proceeding to the next phase, validate:**

| Phase | Gate | Validation | Command |
|-------|------|------------|---------|
| **Implementation** | Code Complete | Lint passes | `npm run lint` |
| **Implementation** | Tests Pass | Critical tests pass | `npm run test:critical` |
| **Validation** | Build Success | Production build works | `npm run build` |
| **Git** | No Duplicates | No duplicate files | `find src -name "*File*" -type f` |
| **Push** | Code Review | Gemini analysis complete | Wait for bot comment |
| **Push** | Fixes Applied | All suggestions addressed | New commits pushed |
| **Push → Merge** | **USER APPROVAL** | Explicit user message | **BLOCKING — Agent waits** |
| **Merge** | Documentation | Spec + journal updated | Phase 7 complete |

**⚠️ Phase 5.4 is BLOCKING:** Agent MUST STOP and await explicit user approval before Phase 6 (merge). This is not a bottleneck — it's quality assurance.

---

## 💻 Code Style Quick Reference

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `MedicineCard.jsx` |
| Functions/Variables | camelCase | `calculateAdherence`, `medicineName` |
| Constants | SCREAMING_SNAKE | `CACHE_STALE_TIME`, `MAX_RETRIES` |
| Hooks | use + PascalCase | `useCachedQuery`, `useDashboardContext` |
| Branches | kebab-case | `feature/wave-2/fix-login` |

### Language Rules

| Context | Language | Example |
|---------|---------|---------|
| Code (variables, functions) | English | `const medicineName = ''` |
| Error messages | Portuguese | `'Nome é obrigatório'` |
| UI (labels, buttons) | Portuguese | `Salvar Medicamento` |
| Documentation | Portuguese | This file |
| Commits | Portuguese | `feat: adiciona validação Zod` |
| Database tables/columns | Portuguese | `medicamentos.nome` |
| Internal thinking | English | Planning/analysis |

### Import Order

```jsx
// 1. React and external libraries
import { useState, useEffect } from 'react'
import { z } from 'zod'

// 2. Internal components
import Button from '../ui/Button'

// 3. Hooks and utils
import { useCachedQuery } from '@shared/hooks/useCachedQuery'

// 4. Services and schemas
import { medicineService } from '@features/medications/services/medicineService'

// 5. CSS (always last)
import './MedicineForm.css'
```

**📖 Complete guide**: [`docs/PADROES_CODIGO.md`](docs/PADROES_CODIGO.md) *(consolidating to `docs/standards/CODE_PATTERNS.md`)*

---

## 🔒 Security

### Authentication & Authorization
- JWT tokens managed by Supabase Auth
- Automatic session refresh
- **RLS (Row Level Security)** on all tables - users can only access their own data

### Data Validation
- **Zod schemas**: Runtime validation in all services
- **No data** reaches backend without validation
- Error messages in Portuguese

### Environment Variables
```bash
# Required in .env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
TELEGRAM_BOT_TOKEN=...
CRON_SECRET=...
```

**⚠️ NEVER** commit `.env` file (already in `.gitignore`)

---

## 🧠 Agent Memory System

All lessons learned, rules, and domain knowledge are stored in [`.memory/`](.memory/):

| File | Contains |
|------|----------|
| [`.memory/rules.md`](.memory/rules.md) | Graduated rules (R-NNN) — the "brain" |
| [`.memory/knowledge.md`](.memory/knowledge.md) | Domain facts, component APIs, patterns |
| [`.memory/anti-patterns.md`](.memory/anti-patterns.md) | Mistake prevention table (AP-NNN) |
| [`.memory/journal/`](.memory/journal/) | Chronological session entries (weekly) |

**Session protocol:** See [`.memory/README.md`](.memory/README.md) for full loading and writing instructions.

---

## 🎯 Design Principles & Heuristics

### Context-Dependent Recommendations

#### When to Use Client-Side vs API Calculation
| Scenario | Recommendation | Rationale |
|----------|---------------|-----------|
| Data in SWR cache | Client-side | Zero network requests |
| Complex aggregation | Client-side | Avoid server load |
| Timezone-sensitive | Client-side | Brazil local time (GMT-3) |
| Large datasets (>1000 rows) | API | Memory optimization |

#### Test Command Selection
| Contexto | Comando | Rationale |
|----------|---------|-----------|
| Agente — validação rápida | `npm run validate:agent` | Timeout 10min + bail-fast |
| `*.service.js` | `npm run test:critical` | Business logic |
| `*.schema.js` | `npm run test:critical` | Critical validation |
| `*.util.js` | `npm run test:critical` | Pure functions |
| `*.jsx` (component) | `npm run test:components` | UI testing |
| Config files | `npm run test` | May affect entire suite |

---

## 📁 Project Structure (Quick Reference)

```
src/
├── features/          # Domain-driven features (F4.6) — CANONICAL
│   ├── adherence/     # components/, hooks/
│   ├── dashboard/     # components/, hooks/, services/
│   ├── medications/   # components/, services/
│   ├── protocols/     # components/, services/, utils/
│   └── stock/         # components/, services/
├── shared/            # Shared resources — CANONICAL
│   ├── components/    # ui/, gamification/, log/, onboarding/, pwa/
│   ├── hooks/         # useCachedQuery, useTheme, useHapticFeedback, useShake
│   ├── services/      # cachedServices, migrationService
│   │   └── api/       # logService (canônico para logs)
│   └── utils/         # supabase.js (cliente), queryCache.js
├── services/          # ✅ Apenas 2 serviços sem equivalente em feature
│   └── api/           # adherenceService.js, dlqService.js — APENAS ESTES 2
├── schemas/           # Zod schemas globais (ÚNICO local — use @schemas/)
├── utils/             # Utilitários globais (dateUtils, adherenceLogic, titrationUtils)
└── views/             # Page components — **TODAS lazy-loaded com Suspense + ViewSkeleton (R-117, M2 ✅)**

server/                # Telegram Bot (Node.js separado — server/package.json)
├── bot/
│   ├── commands/      # /start, /hoje, /registrar, /estoque, etc.
│   ├── callbacks/     # doseActions, conversational
│   ├── middleware/    # commandWrapper, userResolver
│   ├── scheduler.js   # Cron jobs
│   ├── alerts.js      # Sistema de alertas
│   └── tasks.js       # Tarefas agendadas
├── services/          # userService, sessionManager, deadLetterQueue, etc.
└── utils/             # formatters, timezone, retryManager

api/                   # Serverless Functions (Vercel) — MAX 12 funcoes no Hobby plan!
├── dlq.js             # Router DLQ (list + retry + discard)
│   └── _handlers/     # retry.js, discard.js (nao contados — prefixo _)
├── gemini-reviews.js  # Router Gemini (persist + create-issues + update-status + batch-update)
│   ├── _shared/       # logger.js, security.js (nao contados — prefixo _)
│   └── _handlers/     # persist.js, create-issues.js, update-status.js, batch-update.js
├── health/            # notifications.js (health check)
├── notify.js          # Cron orchestrator (maxDuration: 60s)
├── share.js           # PDF sharing via Vercel Blob
└── telegram.js        # Webhook Telegram (maxDuration: 10s)
# Budget: 6/12 funcoes usadas — ver api/CLAUDE.md para detalhes
```

> **✅ Wave 9 concluída**: `src/lib/`, `src/hooks/`, `src/components/`, `src/shared/constants/` e `src/features/*/constants/` foram deletados. Não há mais diretórios legados em `src/`. O ESLint bloqueia importações de caminhos antigos.

**📖 Complete architecture**: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

---

## ⏱️ The Cost of Rushing (R-062 Rationale)

Why each phase of `/deliver-sprint` cannot be compressed:

| Phase | If Rushed | Cost | Time Saved |
|-------|-----------|------|------------|
| **Phase 1: Setup** | Skip exploration → wrong files modified | Production bug + rework | 5 min |
| **Phase 2: Implementation** | Copy-paste patterns → untested code | Runtime errors + debugging | 20 min |
| **Phase 3: Validation** | Skip tests → regressions slip through | User-facing bugs | 10 min |
| **Phase 4: Git & Docs** | No memory update → same error repeats | Technical debt accumulates | 5 min |
| **Phase 5: Review** | Ignore Gemini suggestions → architectural debt | Maintainability suffers | 15 min |
| **Phase 6: Merge** | Self-merge without approval → bypasses QA | Unknown issues reach production | 5 min |
| **Phase 7: Documentation** | Skip journal → future agents repeat mistakes | Knowledge loss = slower future sprints | 10 min |

**Result of rushing all 7 phases:** Save 70 minutes, but create 5+ hours of debugging/rework later.

**Result of completing all 7 phases thoroughly:** Takes 2 hours total, prevents 90% of recurring bugs, enables future agents to deliver faster.

**R-062: One solid PR (2h) > 3 rushed PRs (90 min + 5h debugging) = 40% faster delivery long-term.**

---

## ✅ Pre-Commit Checklist

Before committing, verify:

- [ ] **NO duplicate files exist** (run `find src -name "*ComponentName*" -type f`)
- [ ] **Import resolves to correct file** (check `vite.config.js` aliases)
- [ ] Code follows naming conventions (PascalCase, camelCase, etc.)
- [ ] Props have validation/default values
- [ ] Zod validation applied in all services
- [ ] Cache invalidated after mutations (use cachedServices)
- [ ] Errors handled with try/catch
- [ ] Tests added for new logic
- [ ] `console.log` debug statements removed
- [ ] CSS follows mobile-first
- [ ] Imports organized correctly
- [ ] States declared BEFORE useMemo/useEffect
- [ ] `npm run validate` passes (lint + tests)

---

## 🚫 Anti-Patterns

> Complete table with 60+ anti-patterns: [`.memory/anti-patterns.md`](.memory/anti-patterns.md)

---

## 🤖 Agent Modes Available

For specialized tasks, switch to appropriate mode:

| Mode | When to Use | Purpose |
|------|------------|---------|
| **🏗️ Architect** | Planning, design, strategy | System design, technical specs |
| **💻 Code** | Writing/modifying code | Implementation, refactoring |
| **❓ Ask** | Need explanations | Understanding, recommendations |
| **🪲 Debug** | Troubleshooting issues | Error investigation, diagnosis |
| **🪃 Orchestrator** | Complex multi-step projects | Coordination, workflow management |
| **🎨 UX Builder** | Implementing UX evolution specs | Follow atomic UI/UX specs |

---

## 🔄 Agent Feedback Loop

### Overview

This section defines the continuous feedback process between AI agents to ensure quality, prevent recurring errors, and promote organizational learning.

### Agent Handoff Protocol

When delegating tasks between agents, the following protocol MUST be followed:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT HANDOFF PROTOCOL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ORCHESTRATOR → SPECIALIST                                   │
│     ├── Define clear scope and expected output                  │
│     ├── Provide all relevant context from previous tasks        │
│     ├── Specify validation criteria                             │
│     └── Set explicit completion signal (attempt_completion)     │
│                                                                 │
│  2. SPECIALIST → ORCHESTRATOR                                   │
│     ├── Report findings/implementation via attempt_completion   │
│     ├── Include specific file paths and line numbers            │
│     ├── Document any issues encountered                         │
│     └── Suggest next steps if applicable                        │
│                                                                 │
│  3. ORCHESTRATOR → NEXT SPECIALIST                              │
│     ├── Include learnings from previous specialist              │
│     ├── Update TODO list with current status                    │
│     └── Adjust scope based on findings                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quality Gates Between Phases

Before proceeding to the next phase, validate:

| Gate | Validation | Command/Action |
|------|------------|----------------|
| **Code Complete** | Lint passes | `npm run lint` |
| **Tests Pass** | Critical tests pass | `npm run test:critical` |
| **Build Success** | Production build works | `npm run build` |
| **No Duplicates** | No duplicate files created | `find src -name "*File*" -type f` |
| **Memory Updated** | Lessons learned documented | Update `.memory/journal/` |

### Mandatory Post-Task Review

After each significant task completion, the agent MUST:

1. **Document Findings**:
   ```markdown
   ## Task Review — YYYY-MM-DD
   **Task**: [Description]
   **Files Modified**: [List with paths]
   **Issues Found**: [Any problems encountered]
   **Lessons Learned**: [What to remember for future]
   **Follow-up Needed**: [Yes/No - if yes, what]
   ```

2. **Update Memory** (if significant):
   - Add entry to `.memory/journal/[current-week].md`
   - Follow the format in [`.memory/README.md`](.memory/README.md)

3. **Report to Orchestrator** (with strict R-060 compliance):
   - Use comprehensive summary with specific file paths and line numbers
   - Include all issues encountered and how they were resolved
   - **CRITICAL**: State clearly: "PR created, awaiting your approval before merge" (R-060)
   - Do NOT self-merge (R-060 violation = learning opportunity for future prevention)
   - Do NOT rush to Phase 6/7 without explicit user approval message

### Continuous Improvement Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│              CONTINUOUS IMPROVEMENT CYCLE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │  PLAN    │───▶│  EXECUTE │───▶│  REVIEW  │───▶│  LEARN   │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│        ▲                                                │       │
│        └────────────────────────────────────────────────┘       │
│                                                                 │
│   PLAN:   Define scope, identify risks, check for duplicates    │
│   EXECUTE: Implement changes, follow coding standards           │
│   REVIEW: Validate (lint, tests, build), check for issues       │
│   LEARN:  Update memory, document lessons, improve process      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Escalation Procedures

When issues are found that require attention:

| Issue Type | Action | Escalate To |
|------------|--------|-------------|
| **CRITICAL** (blocks production) | Stop immediately, report to user | User/Orchestrator |
| **HIGH** (affects functionality) | Fix before proceeding, document | Orchestrator |
| **MEDIUM** (improvement) | Create GitHub Issue, continue | Backlog |
| **LOW** (nice to have) | Note in completion report | Backlog |

### Inter-Agent Communication Standards

When agents communicate via `attempt_completion`:

1. **Be Specific**: Include exact file paths and line numbers
2. **Be Comprehensive**: Summarize all changes, not just the main one
3. **Be Honest**: Report issues encountered, even if resolved
4. **Be Forward-Looking**: Suggest next steps or follow-up items

Example completion report:
```markdown
## Task Complete: [Task Name]

### Changes Made
- `src/path/to/file.js` (line 42): Added validation
- `src/another/file.jsx` (line 15-20): Fixed bug

### Issues Found
- Duplicate file at `src/old/location.js` - deleted
- Test failing due to mock - fixed by updating mock

### Validation
- ✅ Lint: 0 errors
- ✅ Tests: 146 passed
- ✅ Build: Success

### Follow-up Needed
- Issue #XX created for remaining refactoring
```

---

## 📚 Complete Documentation Index

**Master index with reading order**: [`docs/INDEX.md`](docs/INDEX.md)

### By Category

**Getting Started**
- [`docs/getting-started/SETUP.md`](docs/getting-started/SETUP.md) - Environment setup

**Architecture**
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) - System overview *(consolidating)*
- [`docs/architecture/DATABASE.md`](docs/architecture/DATABASE.md) - Database schemas
- [`docs/architecture/CSS.md`](docs/architecture/CSS.md) - CSS architecture

**Standards**
- [`docs/standards/TESTING.md`](docs/standards/TESTING.md) - Testing guide ✅
- [`docs/standards/GIT_WORKFLOW.md`](docs/standards/GIT_WORKFLOW.md) - Git workflow ✅
- [`docs/standards/PULL_REQUEST_TEMPLATE.md`](docs/standards/PULL_REQUEST_TEMPLATE.md) - PR template
- [`docs/PADROES_CODIGO.md`](docs/PADROES_CODIGO.md) - Code patterns *(consolidating)*

**Reference**
- [`docs/reference/SERVICES.md`](docs/reference/SERVICES.md) - Service APIs
- [`docs/reference/HOOKS.md`](docs/reference/HOOKS.md) - Custom hooks

**Features**
- [`docs/features/TITRATION.md`](docs/features/TITRATION.md) - Titration guide
- [`docs/features/AUTO_TRANSITION.md`](docs/features/AUTO_TRANSITION.md) - Auto transition
- [`docs/features/USER_GUIDE.md`](docs/features/USER_GUIDE.md) - User guide

---

## 🎓 Common Workflows

### Before Modifying ANY Existing File

**This workflow prevents production bugs caused by duplicate files.**

```bash
# Step 1: Check for duplicate files
find src -name "*TargetFile*" -type f

# Step 2: If duplicates exist, identify which one is ACTUALLY used
grep -r "from.*TargetFile" src/ | head -20

# Step 3: Check path aliases in vite.config.js
# An import like "@adherence/services/x" resolves to "src/features/adherence/services/x"

# Step 4: Verify the correct file before making changes
# The canonical location is:
# - Feature services: src/features/{domain}/services/
# - Shared services: src/shared/services/ or src/shared/services/api/
# - Admin services (adherence/dlq): src/services/api/
# - Schemas: src/schemas/  ← ÚNICO local, use @schemas/
# - Utils: src/utils/
# - Components: src/features/{domain}/components/ or src/shared/components/
```

### Creating a New Feature

```bash
# 1. Create branch
git checkout -b feature/wave-X/new-feature

# 2. Create service with Zod validation
# See: docs/reference/SERVICES.md

# 3. Create component
# See: docs/PADROES_CODIGO.md (consolidating to docs/standards/CODE_PATTERNS.md)

# 4. Write tests
# See: docs/standards/TESTING.md

# 5. Validate
npm run lint
npm run validate

# 6. Create PR
# See: docs/standards/GIT_WORKFLOW.md
```

### Fixing a Bug

```bash
# 1. Create branch
git checkout -b fix/wave-X/bug-description

# 2. Identify root cause
# Use git debugging: git log -S "search_term" -p

# 3. CRITICAL: Check for duplicate files before modifying
find src -name "*TargetFile*" -type f
grep -r "from.*TargetFile" src/

# 4. Write failing test first
# See: docs/standards/TESTING.md

# 5. Fix the bug (in the CORRECT file)

# 6. Ensure test passes
npm run lint
npm run test:changed

# 7. Validate and PR
npm run validate && git push
```

### Debugging Production Issues

**Systematic approach for production bugs:**

```bash
# Step 1: Identify the symptom
# What is the user seeing? What should they see?

# Step 2: Trace the data flow
# Where does the data come from? Service → Hook → Component

# Step 3: Check for duplicate files
find src -name "*ServiceName*" -type f
find src -name "*ComponentName*" -type f

# Step 4: Verify which file is ACTUALLY being used
grep -r "from.*ServiceName" src/
grep -r "from.*ComponentName" src/

# Step 5: Check path aliases in vite.config.js
# An import like "@adherence/services/x" resolves to "src/features/adherence/services/x"

# Step 6: Fix the CORRECT file and delete duplicates
```

### Adding Tests

```bash
# 1. Create test file in __tests__/ subdirectory
# Format: {sourceFile}.test.{js,jsx}

# 2. Follow test patterns
# See: docs/standards/TESTING.md

# 3. Run tests
npm run lint
npm run test:changed

# 4. Check coverage
npm run test:coverage
```

---

## 🎨 UX Evolution — Specs de Interface

### Contexto

O projeto passou por uma evolucao de UX (navegacao por entidade -> navegacao por atividade). O trabalho foi organizado em 3 ondas com specs atomicas detalhadas que agentes de codigo executaram.

### Documentacao UX

| Documento | Proposito | Quando ler |
|-----------|-----------|------------|
| [`plans/UX_VISION_EXPERIENCIA_PACIENTE.md`](plans/UX_VISION_EXPERIENCIA_PACIENTE.md) | Visao de experiencia, wireframes, filosofia | Para entender o "o que" e o "porque" |
| [`.claude/skills/ui-design-brain/SKILL.md`](.claude/skills/ui-design-brain/SKILL.md) | Referencia de design (60+ patterns) | Para decisoes visuais |

---

## 📞 Resources

### Documentation
- **Master Index**: [`docs/INDEX.md`](docs/INDEX.md)
- **Testing Guide**: [`docs/standards/TESTING.md`](docs/standards/TESTING.md)
- **Git Workflow**: [`docs/standards/GIT_WORKFLOW.md`](docs/standards/GIT_WORKFLOW.md)

### External
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev/guide/
- **Vitest Docs**: https://vitest.dev/
- **Zod Docs**: https://zod.dev/
- **Telegram Bot API**: https://core.telegram.org/bots/api

---

*Última atualização: 2026-03-20*
*Versão do projeto: 3.3.0*
*Status: Fase 5 ✅ + Mobile Perf M0-M8 ✅ + HealthHistory P1-P4 ✅*
*Formato: Routing Table (Wave 9 — Legacy Cleanup concluído) + Mobile Performance Initiative*
