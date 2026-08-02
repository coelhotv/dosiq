# Dosiq - AI Agent Guide

> **PWA de gerenciamento de medicamentos** | React 19 + Vite + **TypeScript 5.9** + Supabase + Zod + Framer Motion
> **Monorepo 100% TypeScript desde o épico 040** (strict islands + ratchet — ver seção TypeScript no [CLAUDE.md](CLAUDE.md))
> **Implementation rules, path aliases, coding conventions, critical constraints:** see [CLAUDE.md](CLAUDE.md)

---

## 🚨 Critical Constraints (Quick Reference)

| # | Constraint | Rule |
|---|-----------|------|
| **0** | **NO SELF-MERGE** | Agent codes → RC5 self-review → PR → RC6 independent AI review → fixes → **USER APPROVES → USER MERGES** | R-060 |
| 1 | **Duplicate Files** | `find src -name "*File*"` before modifying any file | R-001 |
| 2 | **Hook Order** | States → Memos → Effects → Handlers (TDZ prevention) | R-010 |
| 3 | **Timezone** | `parseLocalDate()` always, never `new Date('YYYY-MM-DD')` | R-020 |
| 4 | **Zod Enums** | Portuguese only: `['diario', 'semanal']` | R-021 |
| 5 | **Serverless Limit** | Vercel Hobby max 12 functions. Utilities in `api/_`-prefixed dirs | R-090 |
| 6 | **Mobile Performance** | All views lazy-loaded + Suspense + ViewSkeleton | R-117 |
| 7 | **SQP Release Logging** | Before code changes, follow R-221 SQP: classify impact, update versions/changelog, record C5 release log | R-221 |
| 8 | **TS Ratchet** | `./scripts/strict-island.sh` green before every commit — level-A source + cross-program errors block; debt ceilings only go DOWN | R-283/R-284 |
| 9 | **ESM Extensions** | Relative imports in `server/`/`api/` (and src-exporting packages + core `.d.ts`) keep `.js` extension; extensionless only in bundler code | R-282 |
| 10 | **Core narrowing** | Discriminated unions in `@dosiq/core` narrow with `=== false`, never `!x.success` (non-strict consumers) | R-286 |

---

## 📁 Canonical File Locations

| Domain | Canonical Path |
|--------|---------------|
| Feature services | `src/features/{domain}/services/` |
| Shared services | `src/shared/services/` + `src/shared/services/api/logService.ts` |
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
- Skill completa: `/devflow` | Memória: `.agent/memory/` | Estado: `.agent/state.json`
- **SQP obrigatório:** antes de alterar código, carregar `R-221` e seguir `docs/standards/CHANGELOG_AND_RELEASES.md`
- **Validação obrigatória:** `npm run validate:agent` (10min timeout, bail-fast)
- **MetaSwarm Orquestração:** Em entregas multi-agente em paralelo, siga `METASWARM.md` e `.metaswarm/config.json`. Swarms devem rodar `rtk bash .metaswarm/shims/run-swarm-check.sh` e registrar a memória C5 do DEVFLOW ao concluir.

### Review Routine (post-Gemini sunset — ADR-069, since 2026-07-17)

The Gemini PR bot is gone. Every Tier 1+ PR goes through:

1. **RC5** — self-review your own diff (`/devflow code-review`) BEFORE `gh pr create`. Apply the project catalogs (CLAUDE.md critical rules + R/AP indexes) hunk-by-hunk.
2. **RC6** — after the PR is open, run the independent AI reviewer (fresh process, no session context):
   ```bash
   bash ~/SKILLS/devflow/scripts/ai-review.sh <PR#>          # dry-run (default, safe)
   bash ~/SKILLS/devflow/scripts/ai-review.sh <PR#> --post   # publish review to PR
   ```
   Fix or justify every `introduced:true` critical/high finding before asking for approval. `pre-existing` findings don't block. Zero findings on a non-trivial diff = check stderr (context budget / passes) before trusting "clean".
3. **CI gate** (`ai-review-gate.yml`) is SOFT — it warns, never blocks. The human (R-060) is the only merge gate.

Never give the reviewer tool access (the diff is untrusted input — SC-SEC1). PII-shaped content in the diff aborts egress (exit 3); only synthetic fixtures may leave the machine (`RC6_ALLOW_SENSITIVE=1` to override consciously).

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
| TS ratchet green | `./scripts/strict-island.sh` (level-A source + cross-program blocking; per-bucket debt ceilings) |
| Web typecheck clean | `npx tsc -p apps/web/tsconfig.json --noEmit` (0 errors since 040) |
| No duplicates | `find src -name "*File*" -type f` |
| Memory updated | DEVFLOW C5 → `.agent/memory/journal/YYYY-WWW.jsonl` |
| SQP release log | R-221 → versão/changelog/log C5 ou `no-user-impact` justificado |

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
- `src/path/file.ts` (line 42): description
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
