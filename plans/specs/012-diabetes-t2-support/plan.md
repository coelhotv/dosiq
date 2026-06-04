# Implementation Plan: Suporte a Diabéticos Tipo 2 (Épico)

**Feature Directory**: `plans/specs/012-diabetes-t2-support`
**Spec**: `spec.md`
**Created**: 2026-06-04
**Tier**: 2 (épico — 5 fases A→E, multi-PR)

---

## Summary

Épico ponta-a-ponta para diabetes T2, faseado A→E. Constrói sobre a fundação já em prod
(`dose_instances`/ADR-050, FP-1..FP-4) e sobre a spec 022 (líquidos, ADR-058: `units_per_ml` +
`presentation`). **Registro passivo** — zero cálculo/sugestão de dose (linha SaMD, ADR-062).

---

## Technical Context (evidência real verificada)

| Área | Evidência (file:line / DB) | Implicação |
|------|----------------------------|-----------|
| Tolerância | `computeTolerances` (`packages/core/src/utils/doseInstanceGenerator.js:76-94`): **não-diário → `MAX_TOLERANCE_MINUTES`=120 FIXO**; diário multi → `min(floor(gap/2),120)` | FR-007 net-new: não-diário precisa derivar do **período da frequência** (semanal=10080min) **sem cap** — hoje retorna 120 chapado |
| Tolerância (prod) | `dose_instances.tolerance_minutes` default 120; prod min 21 / max 120 (MCP) | cap de 2h confirmado em dados; só não-diário muda |
| Titulação | `protocols.titration_schedule` (jsonb), `current_stage_index`, `stage_started_at`, `titration_status` ('estável') — todos em prod (MCP). `titrationService.js`, `TitrationWizard/Timeline/Badge.jsx`, `@dosiq/core titrationUtils.js` | infra **existe** — FR-005 audita/corrige, não reconstrói |
| Dose congelada | `expected_dose numeric` (prod); gerador congela na geração (FP-1) | titulação GLP-1 cabe sem novo mecanismo (FR-006) |
| Decimais | colunas dose `numeric`; Zod `z.number()` sem `.int()` | `0,5` já aceito — sem mudança de coluna |
| `medicines` | `type` CHECK `('medicamento','suplemento')` (categoria); **sem** `presentation`/`units_per_ml`/`shelf_life_days` em prod | `presentation`/`units_per_ml` vêm da 022 (ADR-058); `shelf_life_days` é net-new (Fase A) |
| `stock` | `quantity`/`original_quantity` `numeric`; **sem** `opened_at` (MCP) | `opened_at` net-new (Fase A) |
| Timeline (R-252) | `timelineService.doseInstancesToEvents` (`timelineService.js:118`) adapter; `timeline.js` builder PURO; `eventCardRegistry.js` (web). Comentários: "biomarkers_log → adapter biomarker entra ao lado" | FR-011: Fase C adiciona adapter + card, **sem tocar builder/UI de dose** |
| formatDoseUnit | `doseUnit.js:8` "sempre 'unidade(s)'" (ADR-046) | FR-015 revisa p/ respeitar unidade (UI/ml/mg) |
| `biomarkers_log` | **não existe** (MCP) | net-new (Fase C) |
| `consume_stock_fifo` | assinatura `(p_user_id,p_medicine_id,p_quantity,p_medicine_log_id)`; branch líquido via `units_per_ml` (022) | FR-013 estende branch UI: `ml = p_quantity/units_per_ml` (U-100=100) |
| Fast-logging mobile | **não localizado** por grep (FAB/BottomSheet) | ⚠️ UNVERIFIED — C1 da Fase C confirma o caminho real |

---

## Constitution Check

| Princípio | Status | Nota |
|-----------|--------|------|
| I — Health Data Safety | ✅ | glicemia é dado clínico sensível → RLS `user_id=auth.uid()` em `biomarkers_log`; testes com fixtures. **SaMD: zero cálculo de dose** (ADR-062) |
| II — Mobile-First | ✅ | fast-logging fricção-zero; timeline bounded; Zero Cognitive Noise (densidade T2 baixa) |
| III — Server-Agg | ✅ | export clínico (Fase E) agrega server-side (R-249) |
| IV — Timezone | ✅ | `measured_at`/`scheduled_for` instantes absolutos; tz do perfil ponta-a-ponta (G1 fechado) |
| V — Contract/ADR | ✅ | ADR-058 (accepted) + ADR-059..062 (este Planning); `consume_stock_fifo` mantém assinatura (CON), `biomarkers_log` nova CON |
| VI — SQP | ✅ | por fase: A=Backend(migração) · B/C/D=Web+Mobile+Core (minor, store-note) · E=Web (minor) |

---

## Arquitetura / Approach por fase

### Fase A — Forma injetável + validade biológica (TTL) — ADR-059
**Pré-req:** 022 mergeada (traz `presentation`/`units_per_ml`).
- Migração: `medicines.shelf_life_days INTEGER NULL`; `stock.opened_at TIMESTAMPTZ NULL`.
- `opened_at` **inferido na 1ª tomada** que debita o lote: setar dentro de `consume_stock_fifo`
  (ou no caminho de registro) quando `opened_at IS NULL` no lote consumido — best-effort (R-245).
- Alerta TTL = **computado** (`opened_at + shelf_life_days*interval ≤ now`), helper puro no core;
  eixo paralelo ao status 4-tiers de volume (ADR-018), render dedicado (relógio).
- `presentation` ganha uso real: forms permitem `injecao`/`pomada` (UI dedicada — escopo 012).

### Fase B — GLP-1 (mg, semanal, titulação) — ADR-061
- **Auditar titulação** (FR-005): rodar `titrationUtils` + wizard num protocolo novo, mapear
  regressões pós-refactor, corrigir. Sem reescrever o modelo.
- **Tolerância não-diária sem cap** (FR-007/ADR-061): `computeTolerances` ganha ramo
  frequency-aware — para `semanal`/`dias_alternados`, intervalo = período entre ocorrências
  (semanal=10080min, alternados=2880min); tolerância = `floor(intervalo/2)` **sem `MAX_TOLERANCE`**.
  Diário inalterado (mantém cap 120). Requer passar a `frequency` ao gerador.
- `dose_instances.expected_dose` congela a etapa de titulação vigente (reusa gerador, FP-1).
- Marcar crítico = flag `critical_alarm` (spec 010) — sem reimplementar.

### Fase C — `biomarkers_log` + fast-logging + timeline híbrida — ADR-060
- Migração: tabela `biomarkers_log` (`id`,`user_id`,`type`,`value`,`unit`,`measured_at`,`context`,
  `source`,`notes`,`created_at`) + grants + RLS (`user_id=auth.uid()`), enums PT (R-021).
- `biomarkerLogSchema` (core) sincronizado com CHECK (R-082).
- Adapter `biomarkersToEvents` (core) → `TimelineEvent[]` `type='biomarker'` (R-252, **sem tocar**
  `timeline.js` builder). Registrar `BiomarkerEventCard` em `eventCardRegistry.js` (web) + mobile.
- Fast-logging: bottom-sheet web+mobile (caminho mobile **UNVERIFIED** → C1).
- **Sem FK rígido** com `dose_instances`; correlação só temporal. **Sem meta/alvo** (SaMD).

### Fase D — Insulina basal (UI/volume)
- Estender branch UI de `consume_stock_fifo`: `ml = p_quantity / units_per_ml` (U-100=100), via a
  coluna genérica da 022 (ADR-058) — **sem nova coluna**.
- Adesão basal = modo **binário** existente (R-248); `dose_exactness`/bolus = fora (T1).
- `formatDoseUnit` (FR-015/ADR-046 revisado): respeitar a unidade de administração (UI/ml/mg),
  parar de cravar "unidade(s)".

### Fase E — Export clínico
- Relatório PDF cruza doses × `biomarkers_log` por período/dia, agregação **server-side** (R-249),
  **descritivo** (sem recomendação — SaMD).

---

## Data-Migration Scenarios

| Migração | Fase | Rows existentes | Verificação |
|----------|------|-----------------|-------------|
| `medicines.shelf_life_days` (NULL) | A | nascem NULL (TTL inativo) | query `shelf_life_days IS NULL` = 100% |
| `stock.opened_at` (NULL) | A | nascem NULL (lote "fechado"); inferido na 1ª tomada | nenhum lote vira "aberto" retroativo |
| `biomarkers_log` (CREATE) | C | tabela nova, vazia | grants + RLS confirmados |
| `consume_stock_fifo` branch UI | D | RPC `CREATE OR REPLACE`; sólidos/gotas intactos | testes regressão gotas/ml/sólido |
| Injetáveis legados | A | se `dosage_unit='ui'` em prod → revisar `presentation` manual | documentado, não silencioso |

---

## Target Files (canônicos — verificar single-result em C1 de cada fase)

| Path | Fase | Purpose | Evidence |
|------|------|---------|----------|
| `docs/migrations/2026XXXX_diabetes_a_injectable_ttl.sql` | A | [NEW] `shelf_life_days` + `stock.opened_at` | migration |
| `packages/core/src/utils/doseInstanceGenerator.js` | B | `computeTolerances` frequency-aware (não-diário sem cap) | `:76` verificado |
| `packages/core/src/utils/titrationUtils.js` | B | auditar/corrigir | verificado |
| `apps/web/src/features/protocols/services/titrationService.js` | B | auditar/corrigir | verificado |
| `docs/migrations/2026XXXX_diabetes_c_biomarkers.sql` | C | [NEW] `biomarkers_log` + grants + RLS | migration |
| `packages/core/src/schemas/biomarkerLogSchema.js` | C | [NEW] schema Zod (enums PT) | NEW |
| `packages/core/src/services/timelineService.js` | C | adicionar `biomarkersToEvents` (adapter) | `:118` verificado |
| `apps/web/src/views/redesign/history/eventCardRegistry.js` | C | registrar `biomarker` | verificado |
| `apps/web/src/views/redesign/history/BiomarkerEventCard.jsx` | C | [NEW] card | NEW |
| Fast-logging mobile (sheet/FAB) | C | **UNVERIFIED** — C1 confirma | ⚠️ |
| `packages/core/src/utils/doseUnit.js` | D | `formatDoseUnit` por unidade (revisa ADR-046) | `:8` verificado |
| `docs/migrations/2026XXXX_diabetes_d_consume_ui.sql` (RPC) | D | branch UI `ml=p_quantity/units_per_ml` | RPC 022 |
| Export PDF (Fase E) | E | cruzar dose×biomarker server-side | a mapear em C1/E |

---

## Contracts and ADRs

- **ADR-058** (accepted) — `units_per_ml` + `presentation` (origem 022; consumidos aqui).
- **ADR-059** (proposed) — TTL biológico: `stock.opened_at` (inferido 1ª tomada) + `medicines.shelf_life_days`; eixo paralelo a ADR-018.
- **ADR-060** (proposed) — `biomarkers_log` genérico + adapter timeline (R-252); sem FK rígido; sem meta (SaMD).
- **ADR-061** (proposed) — tolerância não-diária derivada do período da frequência, sem cap; diário mantém 120.
- **ADR-062** (proposed) — fronteira SaMD: registro passivo, zero cálculo/sugestão de dose (ANVISA RDC 657/751).
- **CON (novo)** — `biomarkers_log` shape + `biomarkerLogSchema` (catalogar em C5).
- **CON** — `consume_stock_fifo` mantém assinatura (mudança aditiva no branch UI — não-breaking).

---

## Risks + Quality Gates

| Risco | Mitigação |
|-------|-----------|
| Titulação regredida (FR-005) | auditoria dedicada na Fase B antes de confiar no fluxo GLP-1 |
| Tolerância sem cap afrouxar adesão | mudança **só** não-diário; diário mantém 120 (testes de regressão de adesão) |
| `opened_at` inferido em caminho errado | setar no consumo de lote, best-effort (R-245); teste cross-superfície (web/bot/mobile) |
| Fast-logging mobile path desconhecido | C1 da Fase C resolve antes de codar |
| SaMD drift | ADR-062 + revisão: nenhuma fórmula de bolus/carbo; sem meta glicêmica |
| `biomarkers_log` sem RLS | template CLAUDE.md (grants + RLS + REVOKE anon) |

**Gates por fase:** `rtk npm run validate:agent` (lint 0 + crítica) + smoke PO (mobile) + Gemini review + aprovação humana (R-060). Nunca auto-merge.

> **Sequenciamento duro:** 022 mergeada antes do C-coding desta spec. Fases internas A→B→C→D→E
> (B e C podem paralelizar após A; D depende de C; E depende de C+D).
