# EXEC SPEC — Dosiq Plans Migration to DEVFLOW v1.8 Spec Format

## Objetivo

Construir uma Fase 2 separada do upgrade DEVFLOW v1.8: um processo prescritivo para agentes AI converterem ou atualizarem specs e planos já redigidos em `/Users/coelhotv/git/dosiq/plans/` para o novo formato esperado por `/devflow specifying`.

Esta fase não implementa produto. Ela só reorganiza conhecimento de planning existente em artefatos DEVFLOW v1.8:

```text
plans/specs/NNN-feature-name/
  spec.md
  plan.md
  tasks.md
  analysis.md
  checklists/
    requirements.md
  contracts/
```

Resultado esperado:

- Specs vivas de `dosiq/plans/` ficam migradas para `plans/specs/NNN-feature-name/`.
- Specs legadas permanecem rastreáveis, sem perda de conteúdo.
- Agentes conseguem continuar execução futura lendo `spec.md`, `plan.md`, `tasks.md` e `analysis.md`.
- Arquivos arquivados, retrospectivas, benchmarks e documentos de estratégia não viram specs executáveis sem critério.

## Relação com Fase 1

Fase 1 é o upgrade do skill DEVFLOW em `/Users/coelhotv/SKILLS/devflow`.

Fase 2 é a migração de conteúdo existente no projeto consumidor `/Users/coelhotv/git/dosiq`.

Ordem obrigatória:

1. Fase 1 implementada e validada.
2. `/Users/coelhotv/git/dosiq/.agent/constitution.md` criada.
3. Fase 2 executada por ondas de migração.

Não executar Fase 2 antes de Fase 1, porque a migração depende dos formatos e gates definidos em DEVFLOW v1.8.

## Restrições Obrigatórias

- Não alterar código de produto.
- Não executar migrations de banco.
- Não alterar `.agent/memory/*_INDEX.md` salvo se uma conversão revelar contrato/ADR ausente e o operador autorizar escopo adicional.
- Não apagar planos legados.
- Não mover arquivos legados na primeira migração. Copiar e referenciar; limpeza fica para etapa futura.
- Não migrar `plans/archive_old/**` por padrão.
- Não migrar retrospectives (`RETRO_*`) para specs executáveis.
- Não transformar benchmarks, briefings ou estratégia em tasks de implementação sem aprovação humana.
- Não inventar requisitos novos para preencher lacunas.
- Se conteúdo legado não tiver informação suficiente, marcar `[NEEDS CLARIFICATION]` ou registrar gap em `analysis.md`.
- Não usar `.specify/`; destino é sempre `plans/specs/`.
- Manter português nos documentos de produto/processo do `dosiq`, salvo nomes técnicos e IDs.

## Fontes a Inventariar

Rodar no início:

```bash
cd /Users/coelhotv/git/dosiq
/usr/bin/find plans -type f -name '*.md' | sort
git status --short --branch
sed -n '1,220p' .agent/state.json
test -f .agent/constitution.md && sed -n '1,220p' .agent/constitution.md
```

Inventário observado inicialmente:

- `plans/dose_instances_refactor/`
- `plans/native_app_ux_revamp/`
- `plans/backlog-native_app/`
- `plans/backlog-notifications/`
- `plans/backlog-roadmap_v4/`
- `plans/backlog-unified_app_2026/`
- `plans/benchmarks/`
- `plans/archive_old/`
- arquivos estratégicos soltos: `PRODUCT_STRATEGY_CONSOLIDATED.md`, `DOSIQ_PRODUCT_BRIEF.md`, `UX_VISION_EXPERIENCIA_PACIENTE.md`, `DESIGN-SYSTEM.md`

## Classificação de Documentos

Cada arquivo legado deve receber uma classe antes da migração:

| Classe | Exemplos | Destino |
|--------|----------|---------|
| `active_exec_spec` | `EXEC_SPECS_PHASE_4.md`, `EXEC_SPEC_FASE*.md` | Migrar para feature spec |
| `master_plan` | `MASTER_PLAN_*.md`, `ROADMAP_v4.md` | Usar como source/ref; pode virar umbrella spec se acionável |
| `prd` | `PRD_*.md`, `DRAFT_*.md`, `PHASE_*_SPEC.md` | Migrar para `spec.md`, gerar `plan.md` se houver base técnica |
| `addendum` | `EXEC_SPEC_*_ADDENDUM_*.md` | Incorporar em spec/plan de feature principal ou criar linked spec |
| `index` | `INDEX_EXEC_SPECS.md`, `README.md` | Não migrar como feature; usar para mapear fontes |
| `retro` | `RETRO_*.md` | Não migrar; extrair lessons só se operador pedir memory update |
| `strategy` | briefs, benchmarks, product strategy | Não migrar como executável; referenciar em assumptions/context |
| `archive` | `plans/archive_old/**` | Excluir da Fase 2 padrão |

## Priorização de Migração

Migrar em ondas. Cada onda deve gerar PR separado ou commit separado, conforme operador decidir.

### Wave M0 — Setup e Índice

Objetivo: criar mapa de migração sem converter conteúdo.

Saídas:

```text
plans/specs/MIGRATION_INDEX.md
plans/specs/MIGRATION_STATUS.md
```

`MIGRATION_INDEX.md` deve conter:

```markdown
# Dosiq Plans Migration Index

| Legacy Path | Class | Target Spec Dir | Status | Notes |
|-------------|-------|-----------------|--------|-------|
```

Status permitido:

- `pending`
- `migrated`
- `deferred`
- `excluded`
- `blocked`

### Wave M1 — Specs Ativas de Execução

Migrar primeiro documentos em execução ou ainda relevantes:

- `plans/dose_instances_refactor/EXEC_SPECS_PHASE_4.md`
- `plans/dose_instances_refactor/EXEC_SPECS_PHASE_3.md`
- `plans/dose_instances_refactor/EXEC_SPECS_PHASE_1_2.md`
- `plans/native_app_ux_revamp/EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`
- `plans/native_app_ux_revamp/EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`

Critério: documento tem DoD, sprints, files, PRs, gates ou status de entrega.

### Wave M2 — PRDs e Planos de Produto Ainda Vivos

Migrar PRDs/planos com valor futuro:

- `plans/native_app_ux_revamp/PRD_NATIVE_APP_UX_REVAMP.md`
- `plans/native_app_ux_revamp/MASTER_PLAN_NATIVE_UX_REVAMP.md`
- `plans/backlog-unified_app_2026/UNIFIED_ROADMAP_2026.md`
- `plans/backlog-roadmap_v4/ROADMAP_v4.md`
- `plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md`

Critério: documento ainda orienta roadmap ou próxima entrega.

### Wave M3 — Backlog Executável

Migrar specs backlog com escopo claro:

- `plans/backlog-native_app/EXEC_SPEC_*.md`
- `plans/backlog-notifications/EXEC_SPEC_*.md`
- `plans/backlog-roadmap_v4/EXEC_SPEC_*.md`
- `plans/backlog-unified_app_2026/EXEC_SPEC_*.md`

Critério: arquivo tem ação implementável.

### Wave M4 — Estratégia, Benchmarks e Arquivo

Não migrar por padrão. Classificar:

- `strategy`: referenciável em specs futuras.
- `archive`: excluído.
- `retro`: candidato a memory distillation, não spec.

Qualquer migração nesta onda exige aprovação explícita do operador.

## Algoritmo de Numbering

Destino:

```text
plans/specs/NNN-feature-name/
```

Regras:

1. Se `plans/specs/` não existir, criar.
2. Se já houver specs novas, próximo número = maior prefixo + 1.
3. Usar sequência única para todo `dosiq`, não por epic.
4. Não reutilizar números.
5. Não derivar número dos nomes antigos.
6. Preservar rastreabilidade em `spec.md` via `Legacy Sources`.

Slug:

- 2 a 5 palavras.
- kebab-case.
- preferir domínio + ação.
- evitar `exec-spec`, `phase`, `fase`, `draft`, `final`.

Exemplos:

| Legacy | Target |
|--------|--------|
| `dose_instances_refactor/EXEC_SPECS_PHASE_4.md` | `plans/specs/001-timeline-event-stream/` |
| `native_app_ux_revamp/PRD_NATIVE_APP_UX_REVAMP.md` | `plans/specs/002-native-ux-revamp/` |
| `backlog-notifications/EXEC_SPEC_SNOOZE_DOSE.md` | `plans/specs/003-snooze-dose-notification/` |

## Processo por Spec Migrada

Cada agente deve executar exatamente esta sequência para cada target spec.

### Migrate 0 — Read Legacy Bundle

Ler:

- arquivo legado primário
- arquivos irmãos relevantes no mesmo diretório
- `.agent/constitution.md`
- `.agent/state.json`
- índices de contracts/ADRs quando o legado cita interfaces, ADRs, PRs ou migrations

Não carregar `archive_old` salvo se o arquivo legado apontar explicitamente para ele.

### Migrate 1 — Create Target Directory

Criar:

```text
plans/specs/NNN-feature-name/
plans/specs/NNN-feature-name/checklists/
plans/specs/NNN-feature-name/contracts/
```

### Migrate 2 — Write `spec.md`

`spec.md` deve conter intenção e requisitos, não implementação detalhada.

Template:

```markdown
# Feature Specification: <Feature Name>

**Feature Directory**: `plans/specs/NNN-feature-name`
**Created**: YYYY-MM-DD
**Status**: Migrated Draft
**Migration Status**: migrated | partial | blocked
**Legacy Sources**:
- `plans/.../OLD.md`

## Context

<why this exists, extracted from legacy docs>

## User Scenarios & Testing

### User Story 1 - <Title> (Priority: P1)

**Why this priority**: <value>
**Independent Test**: <testable scenario>

**Acceptance Scenarios**:
1. Given <state>, When <action>, Then <outcome>

## Edge Cases

- <edge case from legacy>

## Requirements

### Functional Requirements

- **FR-001**: <testable requirement>

### Key Entities

- **Entity**: <meaning and key attributes>

## Success Criteria

- **SC-001**: <measurable outcome>

## Assumptions

- <assumption from legacy or migration note>

## Open Questions

- [NEEDS CLARIFICATION: <question>]
```

Rules:

- Preserve every legacy acceptance criterion or DoD item somewhere in `spec.md` or `plan.md`.
- Do not invent user stories if legacy doc is purely technical; write technical objective as context and mark missing product scenario in Open Questions.
- If legacy doc contains product and implementation mixed together, split product intent into `spec.md` and technical detail into `plan.md`.

### Migrate 3 — Write `plan.md`

`plan.md` captures execution design from the legacy doc.

Template:

```markdown
# Implementation Plan: <Feature Name>

**Feature Directory**: `plans/specs/NNN-feature-name`
**Spec**: `spec.md`
**Legacy Sources**:
- `plans/.../OLD.md`

## Summary

## Technical Context

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|

## Architecture / Approach

## Target Files

| Path | Purpose | Source Evidence |
|------|---------|-----------------|

## Contracts and ADRs

## Risks

## Quality Gates

## Migration Notes
```

Rules:

- File paths must be copied only if legacy doc names them or repo inspection confirms them.
- If path cannot be verified during migration, mark `UNVERIFIED`.
- Do not silently normalize old design decisions that conflict with constitution; record conflict.

### Migrate 4 — Write `tasks.md`

Template:

```markdown
# Tasks: <Feature Name>

**Feature Directory**: `plans/specs/NNN-feature-name`
**Input**: `spec.md`, `plan.md`, legacy sources
**Status**: Migrated Draft

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Verify legacy source completeness in `plans/.../OLD.md`

## Phase 2: Implementation

- [ ] T002 [US1] <task with file path when known>

## Phase 3: Validation

- [ ] TXXX [C4] Verify <acceptance criterion>

## Phase 4: DEVFLOW Record

- [ ] TXXX [C5] Update events/journal/state after implementation

## Dependencies

## Parallel Opportunities
```

Rules:

- Every task starts with `- [ ] TNNN`.
- Use `[P]` only when task touches different files and has no dependency.
- Use `[US1]`, `[US2]` when tied to user story.
- Use `[C4]` for validation tasks.
- Use `[C5]` for record tasks.
- Do not mark tasks complete during migration.

### Migrate 5 — Write `checklists/requirements.md`

Purpose: validate requirements quality, not implementation.

Template:

```markdown
# Requirements Checklist: <Feature Name>

**Feature Directory**: `plans/specs/NNN-feature-name`
**Created**: YYYY-MM-DD
**Source**: migrated legacy plan

## Completeness

- [ ] CHK001 Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]

## Clarity

- [ ] CHK002 Are vague terms from legacy docs quantified or marked for clarification? [Clarity]

## Traceability

- [ ] CHK003 Does each FR/SC map to at least one task? [Traceability]

## Constitution Alignment

- [ ] CHK004 Are dosiq constitution constraints reflected in the plan? [Consistency]
```

### Migrate 6 — Write `analysis.md`

Run C1.5-style analysis after migration.

Template:

```markdown
# Artifact Coverage Analysis: <Feature Name>

**Feature Directory**: `plans/specs/NNN-feature-name`
**Created**: YYYY-MM-DD
**Status**: PASS | PARTIAL | BLOCKED

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|----------------|-------------|-------|

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|

## Contract / ADR Coverage

## Constitution Alignment

## Gaps

| ID | Severity | Summary | Required Action |
|----|----------|---------|-----------------|

## Gate Decision
```

Severity:

- `CRITICAL`: lost acceptance criterion, constitution conflict, breaking contract unhandled.
- `HIGH`: major ambiguous requirement, missing task for core requirement.
- `MEDIUM`: terminology drift, weak NFR.
- `LOW`: formatting or minor traceability gap.

### Migrate 7 — Update Migration Index

Update `plans/specs/MIGRATION_INDEX.md`:

```markdown
| Legacy Path | Class | Target Spec Dir | Status | Notes |
```

Update `plans/specs/MIGRATION_STATUS.md`:

```markdown
## Wave M1

- migrated: N
- partial: N
- blocked: N
- excluded: N
```

## Agent Work Packages

### Package A — Inventory Agent

Purpose: map all markdown files in `plans/`.

Inputs:

- `plans/**/*.md`

Outputs:

- `plans/specs/MIGRATION_INDEX.md`
- `plans/specs/MIGRATION_STATUS.md`

No feature directories created in Package A unless approved.

### Package B — Active Specs Agent

Purpose: migrate Wave M1 active execution specs.

Inputs:

- migration index
- active exec specs
- `.agent/constitution.md`

Outputs:

- one `plans/specs/NNN-feature-name/` per active spec
- updated migration index/status

### Package C — Product Specs Agent

Purpose: migrate PRDs and master plans with ongoing value.

Inputs:

- Wave M2 docs
- product strategy docs as references only

Outputs:

- product-oriented specs with implementation details split into `plan.md`

### Package D — Backlog Specs Agent

Purpose: migrate executable backlog items.

Inputs:

- Wave M3 docs

Outputs:

- specs with clear status `Migrated Draft`
- gaps captured where backlog is too thin

### Package E — Review Agent

Purpose: review migrated artifacts only.

Checks:

- no lost DoD
- traceability legacy -> spec/plan/tasks
- constitution alignment
- C1.5 analysis completeness
- no accidental code/product changes

## Acceptance Criteria

- `plans/specs/MIGRATION_INDEX.md` exists.
- `plans/specs/MIGRATION_STATUS.md` exists.
- Every non-archive markdown file in `plans/` is classified.
- Every migrated feature has `spec.md`, `plan.md`, `tasks.md`, `analysis.md`, `checklists/requirements.md`.
- Every migrated feature lists legacy sources.
- Every migrated `tasks.md` uses `TNNN` IDs.
- No migrated task is marked complete.
- Every `analysis.md` includes legacy source coverage.
- Archive files are excluded unless explicitly approved.
- Retrospectives are not converted into executable specs.
- `git diff --check` passes.
- Product code remains unchanged.

## Verification Commands

Run in `/Users/coelhotv/git/dosiq`:

```bash
git status --short --branch
/usr/bin/find plans/specs -maxdepth 3 -type f | sort
rg -n "Legacy Sources|Migration Status|Artifact Coverage Analysis|Requirements Checklist|Tasks:" plans/specs
rg -n "^- \\[x\\] T[0-9]{3}" plans/specs || true
git diff --check
```

Expected:

- new files only under `plans/specs/` unless operator approved otherwise.
- no completed task checkboxes in migrated specs.
- no whitespace errors.

## Out of Scope

- Migrating `plans/archive_old/**` by default.
- Updating `.agent/memory` from retrospectives.
- Refactoring legacy plan files.
- Deleting old plan files.
- Changing application code.
- Creating PRs for product implementation.
- Running DEVFLOW coding from migrated specs.

