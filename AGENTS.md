# Meus Remédios - AI Agent Guide

> **Aplicativo de gerenciamento de medicamentos em português brasileiro**  
> **Versão:** 3.0.0 | React 19 + Vite + Supabase

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
| **Understand database** | [`docs/architecture/DATABASE.md`](docs/architecture/DATABASE.md) |
| **CSS architecture** | [`docs/architecture/CSS.md`](docs/architecture/CSS.md) |
| **Telegram bot** | [`docs/architecture/TELEGRAM_BOT.md`](docs/architecture/TELEGRAM_BOT.md) ✅ |
| **Gemini/AI code review** | [`docs/standards/GEMINI_INTEGRATION.md`](docs/standards/GEMINI_INTEGRATION.md) ✅ |

**Agent-specific rules:**
- **Code mode**: [`.roo/rules-code/rules.md`](.roo/rules-code/rules.md)
- **Architecture mode**: [`.roo/rules-architecture/rules.md`](.roo/rules-architecture/rules.md)
- **Long-term memory**: [`.roo/rules/memory.md`](.roo/rules/memory.md)

---

## 🚨 Critical Constraints (NON-NEGOTIABLE)

These rules prevent recurring errors and **must be followed unconditionally**:

### 0. Duplicate File Prevention (HIGHEST PRIORITY)

**This rule prevents production bugs caused by outdated duplicate files.**

```bash
# BEFORE modifying ANY file, ALWAYS run these checks:

# 1. Search for duplicate files with same name
find src -name "ProtocolForm*" -type f
find src -name "*Service.js" -type f | grep -i adherence

# 2. Search for all exports of the same function
grep -r "export.*adherenceService" src/

# 3. Check which file is ACTUALLY imported (trace imports)
grep -r "from.*adherenceService" src/
```

**Canonical File Locations:**
| Domain | Canonical Location | DO NOT USE (legado) |
|--------|-------------------|------------|
| API Services | `src/services/api/*.js` | `src/components/*/services/*.js` |
| Shared Services | `src/shared/services/*.js` e `src/shared/services/api/*.js` | — |
| Feature Services | `src/features/*/services/*.js` *(legítimo para lógica local da feature)* | — |
| Schemas | `src/schemas/*.js` | `src/shared/constants/*.js` |
| Feature-local Schemas | `src/features/*/constants/*.js` *(ex: medicineSchema, stockSchema)* | — |
| Utils | `src/utils/*.js` | `src/features/*/utils/*.js` |
| Hooks | `src/shared/hooks/*.js` | `src/hooks/*.js` *(diretório legado)* |
| Shared Components | `src/shared/components/**/*.jsx` | `src/components/**/*.jsx` *(diretório legado)* |
| Protocol Components | `src/features/protocols/components/*.jsx` | `src/components/protocol/*.jsx` |
| Dashboard Components | `src/features/dashboard/components/*.jsx` | `src/components/dashboard/*.jsx` |

> **⚠️ Diretórios Legados**: `src/components/` e `src/hooks/` estão sendo migrados para `src/shared/components/` e `src/shared/hooks/`. Esses dirs legados são a **principal causa de duplicatas** no projeto. Ao criar novos arquivos, use SEMPRE os locais canônicos acima.

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

**⚠️ CRITICAL**: When you see `import { x } from '@adherence/services/...'`, this resolves to `src/features/adherence/services/...`, NOT `src/services/api/...`. Always verify the actual file being imported!

### 1. React Hook Declaration Order
```jsx
// ✅ CORRECT - Prevents TDZ (Temporal Dead Zone)
function Component() {
  const [data, setData] = useState()        // 1. States first
  const processed = useMemo(() => ..., [data]) // 2. Memos
  useEffect(() => { ... }, [processed])     // 3. Effects
  const handleClick = () => { ... }         // 4. Handlers
}

// ❌ WRONG - ReferenceError
function Component() {
  const processed = useMemo(() => data + 1, [data]) // data is undefined!
  const [data, setData] = useState(0)               // Too late
}
```

### 2. Zod Schema Values in Portuguese
```javascript
// ✅ CORRECT - UI consistency
const FREQUENCIES = ['diário', 'dias_alternados', 'semanal', 'personalizado']
const MEDICINE_TYPES = ['comprimido', 'cápsula', 'líquido', 'injeção']

// ❌ WRONG - Never use English in schemas
const FREQUENCIES = ['daily', 'weekly'] // Causes UI inconsistencies
```

### 3. Telegram Bot Callback Data Limits
```javascript
// ❌ WRONG - Exceeds 64 bytes
callback_data: `reg_med:${medicineId}:${protocolId}` // ~81 chars

// ✅ CORRECT - Use numeric indices
callback_data: `reg_med:${index}` // ~15 chars
session.set('medicineMap', medicines) // Store mapping in session
```

### 4. Dosage Recording Units
```javascript
// ✅ CORRECT - Record in pills (within Zod limit of 100)
const pillsToDecrease = quantity / dosagePerPill
await logService.create({ quantity_taken: pillsToDecrease })

// ❌ WRONG - Exceeds Zod schema limit
await logService.create({ quantity_taken: 2000 }) // mg exceeds limit!
```

### 5. Operation Order for Dose Registration
```javascript
// ✅ CORRECT - Validate → Record → Decrement
try {
  if (stock < pillsToDecrease) throw new Error('Estoque insuficiente')
  await logService.create(log)
  await stockService.decrease(medicineId, pillsToDecrease)
}
```

### 6. LogForm Dual Return Type
```jsx
// ✅ ALWAYS check both return types
if (Array.isArray(logData)) {
  await logService.createBulk(logData) // type === 'plan'
} else {
  await logService.create(logData)     // type === 'protocol'
}
```

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
npm run test:changed # Only changed files since main
npm run test:components # Components (src/components + src/shared/components)
npm run test:services   # Services + features (src/services + src/features)
npm run test:coverage   # Full suite with coverage report (CI)

# Validation
npm run lint          # ESLint check
npm run validate      # Lint + all tests
npm run validate:quick # Lint + test:changed (fastest pre-commit check)
npm run validate:full  # Lint + coverage + build (full CI)
```

---

## 🧪 Testing Rules

### Where to Put Tests
**Rule**: ALL tests use `__tests__/` subfolder pattern

```
src/services/api/
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
| Any file | `npm run test:changed` | Quick check before commit |

**📖 Complete guide**: [`docs/standards/TESTING.md`](docs/standards/TESTING.md)

---

## 🔄 Git Workflow Summary

```
1. CREATE BRANCH:    git checkout -b feature/wave-X/nome
2. MAKE CHANGES:     Follow coding standards
3. VALIDATE:         npm run validate (MUST PASS)
4. COMMIT:           git commit -m "feat(scope): descrição"
5. PUSH:             git push origin feature/wave-X/nome
6. CREATE PR:        Use template, fill all sections
7. WAIT FOR REVIEW:  Address all comments
8. MERGE & CLEANUP:  Merge with --no-ff, delete branch
```

**⚠️ NEVER:**
- Commit directly to `main`
- Skip validation
- Use `--no-verify`
- Merge without review

**📖 Complete guide**: [`docs/standards/GIT_WORKFLOW.md`](docs/standards/GIT_WORKFLOW.md)

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

### Long-Term Memory
All lessons learned and patterns are stored in:
- [`.roo/rules/memory.md`](.roo/rules/memory.md) - Memory entries with lessons

### Memory Entry Format
```markdown
## Memory Entry — YYYY-MM-DD HH:MM
**Contexto / Objetivo**
**O que foi feito**
**O que deu certo**
**O que não deu certo**
**Regras locais para o futuro**
**Pendências**
```

---

## 🎯 Design Principles & Heuristics

### Universal Constraints (From Memory)

| Constraint | Rule | Example |
|-----------|------|---------|
| **Hook Order** | States → Memos → Effects → Handlers | Prevents TDZ |
| **Zod Enums** | Portuguese only | `['diário', 'semanal']` |
| **Telegram Callback** | < 64 bytes | Use indices, not UUIDs |
| **Dosage Units** | Pills, never mg | `quantity_taken = pills` |
| **Operation Order** | Validate → Record → Decrement | Stock consistency |
| **Duplicate Files** | Check before modifying | `find src -name "*File*"` |
| **Import Path** | Verify actual resolution | Check `vite.config.js` aliases |

### Context-Dependent Recommendations

#### When to Use Client-Side vs API Calculation
| Scenario | Recommendation | Rationale |
|----------|---------------|-----------|
| Data in SWR cache | Client-side | Zero network requests |
| Complex aggregation | Client-side | Avoid server load |
| Timezone-sensitive | Client-side | Brazil local time (GMT-3) |
| Large datasets (>1000 rows) | API | Memory optimization |

#### Test Command Selection
| File Type | Command | Rationale |
|-----------|---------|-----------|
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
│   ├── medications/   # components/, services/, constants/
│   ├── protocols/     # components/, services/, utils/
│   └── stock/         # components/, services/, constants/
├── shared/            # Shared resources — CANONICAL
│   ├── components/    # ui/, gamification/, log/, onboarding/
│   ├── hooks/         # useCachedQuery, useTheme, useHapticFeedback, useShake
│   ├── services/      # cachedServices, migrationService, paginationService
│   │   └── api/       # logService (canônico para logs)
│   ├── constants/     # ⚠️ LEGADO — schemas sendo migrados para src/schemas/
│   └── utils/         # supabase.js (cliente), queryCache.js
├── services/          # Serviços de API canônicos
│   └── api/           # medicineService, protocolService, stockService, etc.
├── schemas/           # Zod schemas globais canônicos
├── utils/             # Utilitários globais (dateUtils, adherenceLogic, titrationUtils)
├── views/             # Page components
├── components/        # ⚠️ LEGADO — migrando para src/shared/components/
└── hooks/             # ⚠️ LEGADO — migrando para src/shared/hooks/

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

api/                   # Serverless Functions (Vercel)
├── telegram.js        # Webhook Telegram
├── notify.js          # Endpoint de notificações (cron)
├── dlq.js             # Dead Letter Queue
├── dlq/[id]/          # retry.js, discard.js (rotas dinâmicas)
└── health/            # notifications.js (health check)
```

> **⚠️ Sobre dirs legados**: `src/components/` e `src/hooks/` são os principais responsáveis pelas duplicatas de arquivos. Ao buscar bugs, SEMPRE verifique se o arquivo está sendo importado do local canônico ou do legado.

**📖 Complete architecture**: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

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

## 🚫 Anti-Patterns (STRICTLY PROHIBITED)

| Anti-Pattern | Consequence | Prevention |
|--------------|-------------|------------|
| **Modify duplicate file** | Production bug | Check for duplicates FIRST |
| **Assume import location** | Wrong file modified | Trace actual import path |
| Declare state after useMemo | ReferenceError (TDZ) | States → Memos → Effects |
| Skip validation | Broken build | Always run `npm run validate` |
| Commit to main | Unreviewed code | Always create branch |
| Ignore lint errors | Build fails | Fix all errors |
| Mix languages in schemas | UI inconsistency | Portuguese only |
| Use `--no-verify` | Bypass quality gates | Fix errors properly |

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
| **Memory Updated** | Lessons learned documented | Update `.kilocode/rules/memory.md` |

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
   - Add entry to `.kilocode/rules/memory.md`
   - Follow the Memory Entry Format defined in this file

3. **Report to Orchestrator**:
   - Use `attempt_completion` with comprehensive summary
   - Include specific file paths and line numbers for changes
   - List any issues that need follow-up

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
# The canonical location is usually:
# - Services: src/services/api/
# - Schemas: src/schemas/
# - Utils: src/utils/
# - Components: src/features/{domain}/components/
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
npm run test:changed

# 4. Check coverage
npm run test:coverage
```

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

*Última atualização: 2026-02-20*
*Versão do projeto: 3.0.0*
*Formato: Routing Table (Phase 3 - Documentation Overhaul)*
