# Dosiq - AI Agent Guide

> **PWA de gerenciamento de medicamentos** | v3.3.0 | React 19 + Vite + Supabase + Zod + Framer Motion
> **Implementation rules, path aliases, coding conventions, critical constraints:** see [CLAUDE.md](CLAUDE.md)

---

## 🚨 Critical Constraints (Quick Reference)

| # | Constraint | Rule |
|---|-----------|------|
| **0** | **NO SELF-MERGE** | Agent codes → Gemini reviews → fixes → **USER APPROVES → USER MERGES** | R-060 |
| 1 | **Duplicate Files** | `find src -name "*File*"` before modifying any file | R-001 |
| 2 | **Hook Order** | States → Memos → Effects → Handlers (TDZ prevention) | R-010 |
| 3 | **Timezone** | `parseLocalDate()` always, never `new Date('YYYY-MM-DD')` | R-020 |
| 4 | **Zod Enums** | Portuguese only: `['diario', 'semanal']` | R-021 |
| 5 | **Serverless Limit** | Vercel Hobby max 12 functions. Utilities in `api/_`-prefixed dirs | R-090 |
| 6 | **Mobile Performance** | All views lazy-loaded + Suspense + ViewSkeleton | R-117 |

---

## 📁 Canonical File Locations

| Domain | Canonical Path |
|--------|---------------|
| Feature services | `src/features/{domain}/services/` |
| Shared services | `src/shared/services/` + `src/shared/services/api/logService.js` |
| Adherence + DLQ (only 2 non-feature services) | `src/services/api/` |
| Schemas | `src/schemas/` — **único local**, use `@schemas/` |
| Utils | `src/utils/` |
| Hooks | `src/shared/hooks/` |
| Shared components | `src/shared/components/` |
| Feature components | `src/features/{domain}/components/` |
| Supabase client | `@shared/utils/supabase` |
| Cache util | `@shared/utils/queryCache` |

> **CRITICAL**: `@adherence/services/x` → `src/features/adherence/services/x`, NOT `src/services/api/`

---

## 🤖 DEVFLOW — Workflow Oficial

```
/devflow → bootstrap → codificar (C1-C4) → /deliver-sprint → C5 (memória) → distill
```

- Bootstrap: `/devflow` (sem args) — carrega `state.json` + `hot` + `warm` por contexto
- Skill completa: `.agent/DEVFLOW.md` | Memória: `.agent/memory/` | Estado: `.agent/state.json`
- **Validação obrigatória:** `npm run validate:agent` (10min timeout, bail-fast)

---

## 🛠️ Development Commands

```bash
npm run dev             # Vite dev server (http://localhost:5173)
npm run validate:agent  # AGENTS USE THIS — critical tests + bail-fast + 10min timeout
npm run test:critical   # Services, schemas, utils, hooks
npm run test:changed    # Only changed files since main
npm run lint            # ESLint check
npm run build           # Production build
```

---

## 🤖 Agent Modes

| Mode | When to Use |
|------|------------|
| 🏗️ Architect | Planning, design, specs |
| 💻 Code | Implementation, refactoring |
| ❓ Ask | Explanations, recommendations |
| 🪲 Debug | Error investigation |
| 🪃 Orchestrator | Complex multi-step projects |
| 🎨 UX Builder | Implementing UX evolution specs |

---

## 🎯 Design Principles

### Client-Side vs API Calculation

| Scenario | Use |
|----------|-----|
| Data in SWR cache | Client-side (zero network) |
| Complex aggregation | Client-side (avoid server load) |
| Timezone-sensitive | Client-side (Brazil GMT-3) |
| Large datasets (>1000 rows) | API (memory) |

---

## 🔄 Agent Handoff Protocol

```
ORCHESTRATOR → SPECIALIST:
  - Define scope + expected output
  - Provide context from previous tasks
  - Specify validation criteria

SPECIALIST → ORCHESTRATOR:
  - Report via attempt_completion with file:line references
  - Document issues encountered
  - "PR created, awaiting your approval before merge" (R-060)

ORCHESTRATOR → NEXT SPECIALIST:
  - Include learnings from previous specialist
  - Adjust scope based on findings
```

### Quality Gates

| Gate | Command |
|------|---------|
| Lint passes | `npm run lint` |
| Tests pass | `npm run test:critical` |
| Build works | `npm run build` |
| No duplicates | `find src -name "*File*" -type f` |
| Memory updated | DEVFLOW C5 → `.agent/memory/journal/YYYY-WWW.jsonl` |

### Escalation

| Severity | Action |
|----------|--------|
| CRITICAL (blocks prod) | Stop, report to user |
| HIGH (affects functionality) | Fix before proceeding |
| MEDIUM (improvement) | GitHub Issue, continue |
| LOW | Note in report |

### Post-Task Report Format

```markdown
## Task Complete: [Name]
### Changes Made
- `src/path/file.js` (line 42): description
### Issues Found
- ...
### Validation
- ✅ Lint / ✅ Tests / ✅ Build
### Follow-up Needed
- Issue #XX for ...
```

---

## 🎓 Common Workflows

### Before Modifying ANY Existing File

```bash
find src -name "*TargetFile*" -type f          # check duplicates
grep -r "from.*TargetFile" src/ | head -20     # identify which is actually used
# verify alias in vite.config.js
```

### Fixing a Bug

```bash
git checkout -b fix/wave-X/bug-description
find src -name "*TargetFile*" -type f          # CRITICAL: check duplicates first
grep -r "from.*TargetFile" src/
# write failing test → fix in CORRECT file → validate
npm run lint && npm run test:changed
```

### Debugging Production Issues

```bash
# 1. Identify symptom (what user sees vs what should happen)
# 2. Trace: Service → Hook → Component
find src -name "*ServiceName*" -type f
grep -r "from.*ServiceName" src/
# 3. Fix CORRECT file, delete duplicates
```

---

## MCP Tools: code-review-graph

**Use graph tools BEFORE Grep/Glob/Read** — faster, fewer tokens, structural context.

| Tool | When |
|------|------|
| `semantic_search_nodes` | Find functions/classes by name |
| `detect_changes` | Review changes with risk score |
| `get_impact_radius` | Blast radius of a change |
| `query_graph` | Callers/callees/imports/tests |
| `get_architecture_overview` | High-level structure |
