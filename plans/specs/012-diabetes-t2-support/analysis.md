# Artifact Coverage Analysis: Diabetes T2 (Épico)

**Feature Directory**: `plans/specs/012-diabetes-t2-support`
**Tier**: 2 · **Created**: 2026-06-04

> Reality Check rodado contra o **repo real** (find/grep/Read) + **prod** (MCP Supabase
> `kwqjtdsqkkbebfiaxubb`), não contra a narrativa da spec.
>
> ⚠️ **Re-sync 2026-06-08 (pós-merge 022 #652):** a tabela abaixo foi escrita PRÉ-merge da 022
> ("não em prod ainda"). Agora `presentation`, `units_per_ml` e a conversão `UI`→ml de
> `consume_stock_fifo` **estão em prod**. Linhas afetadas atualizadas; **o Planning da Fase D deve
> re-verificar o estado real via MCP** antes de codar (não confiar nesta tabela como snapshot vivo).

---

## Evidence Table (claim × repo real)

| Spec claim | Real repo / DB (file:line) | Verified? | Note |
|------------|----------------------------|-----------|------|
| `presentation`/`units_per_ml` em `medicines` | ✅ **em prod (022, #652 2026-06-08)** | ✅ | dependência dura satisfeita — consumir, não criar |
| `medicines.type` é categoria, não forma | CHECK `('medicamento','suplemento')` (MCP) | ✅ | confirma `presentation` net-new (na 022) |
| `medicines.shelf_life_days` ausente | não existe (MCP) | ✅ | net-new Fase A |
| `stock.opened_at` ausente | não existe (MCP) | ✅ | net-new Fase A |
| Tolerância não-diária = 120 fixo | `computeTolerances` `doseInstanceGenerator.js:76-94` (`!isDaily → MAX_TOLERANCE_MINUTES`) | ✅ | FR-007 net-new real: derivar do período, sem cap |
| `tolerance_minutes` cap 2h em prod | min 21 / max 120 (MCP) | ✅ | só não-diário muda |
| Titulação existe | `titration_schedule`/`current_stage_index`/`stage_started_at`/`titration_status` (MCP) + `titrationService.js`, `TitrationWizard.jsx`, core `titrationUtils.js` | ✅ | FR-005 audita, não reconstrói |
| `expected_dose` congelada | `numeric` (prod); gerador congela (FP-1) | ✅ | titulação cabe sem novo mecanismo |
| decimais 0,5 aceitos | colunas `numeric`; Zod sem `.int()` | ✅ | sem mudança |
| Timeline adapter (R-252) | `timelineService.doseInstancesToEvents:118`; `timeline.js` builder puro; comentário "biomarkers_log → adapter biomarker entra ao lado" | ✅ | FR-011: adapter+card, sem tocar builder |
| `eventCardRegistry` (web) | `apps/web/src/views/redesign/history/eventCardRegistry.js` | ✅ | registrar `biomarker` |
| formatters de dose líquida | ✅ `formatIntakeDose`/`formatDoseItem`/`formatDoseHint`/`isLiquidMedicine` em `doseUnit.js` (022) | ✅ | FR-015 = consumir (R-272); ADR-046 superado |
| `biomarkers_log` ausente | não existe (MCP) | ✅ | net-new Fase C |
| `consume_stock_fifo` UI→ml | ✅ converte `gotas` **E** `UI` via `units_per_ml` em prod (022 Fase C, migr. `20260608`) | ✅ | FR-013 = **smoke**, não toca RPC (AP-221) |
| Adesão modo binário | `R-248` (binary\|dose_exactness por protocolo) | ✅ | basal=binário; dose_exactness fora |
| Fast-logging mobile | **não localizado** por grep (FAB/BottomSheet) | ❌ UNVERIFIED | T013 (C1 Fase C) resolve ANTES de codar |

---

## Coverage (FR → task / SC → C4 / US → teste)

- FR-001..004 → T002–T007 (A) · FR-005..008 → T008–T012 (B) · FR-009/010/011/012 +
  **010b/011b/012b (design, 2026-06-09)** → T014–T019 + T017b/T018b/T018c (C) · FR-013..015 →
  T021–T024 (D) · FR-016 → T026 (E). ✅ todos cobertos. US3b (área de Medidas) → T018c.
- SC-001→T007 · SC-002→T012 · SC-003→T019 · SC-004→T024 · SC-005→T027 · SC-006→T028. ✅
- US1..5 têm Independent Test declarado na spec. ✅

---

## Cross-file consistency (spec ↔ plan ↔ tasks)

- Tolerância: spec US2.3 (só não-diário) = plan Fase B = tasks T010. ✅
- `presentation`/`units_per_ml`: spec (consome) = plan (ADR-058) = 022 (origem). ✅
- TTL `opened_at` inferido 1ª tomada: spec US1.2 = plan Fase A = tasks T003. ✅
- biomarkers sem FK/sem meta: spec FR-011 = plan Fase C = tasks T016/T019. ✅
- SaMD zero cálculo: spec Context = plan (ADR-062) = tasks T026/T030. ✅

---

## Data-migration completeness

- `shelf_life_days`/`opened_at` nullable (nascem inativos) — sem órfãos. ✅
- `biomarkers_log` CREATE com grants+RLS (template CLAUDE.md). ✅
- `consume_stock_fifo` UI→ml ✅ **já em prod (022)** — Fase D não migra; T024 vira smoke U-100/U-200. ✅
- Injetáveis legados (`dosage_unit='ui'`): revisão manual de `presentation`, documentada. ✅

---

## Findings

| Sev | Item | Ação |
|-----|------|------|
| HIGH | Fast-logging mobile path **UNVERIFIED** | **bloqueia código da Fase C** até T013 (C1) confirmar — não bloqueia o plano nem fases A/B |
| MEDIUM | ADR-059..062 ainda `proposed` | virar `accepted` antes do código da fase respectiva (constitution V) — T030 |
| MEDIUM | Caminho do export PDF clínico (Fase E) não mapeado | T025 (C1 Fase E) resolve |
| MEDIUM | `opened_at` setado em caminho de consumo correto (web/mobile/bot) | T001/T003 confirmam callers de `consume_stock_fifo` |
| LOW | superfícies de insulina carregam `intake_unit`+`units_per_ml` na query (R-267) + render via formatter (R-272) | checklist no PR da Fase D |

**Sem CRITICAL.** O HIGH (fast-logging) é confirmação-de-C1 escopada à Fase C — não bloqueia o
planejamento nem o início (A/B). Gate respeitado: nenhuma fase entra em código com path UNVERIFIED.

> **Honestidade (anti-rubber-stamp):** evidência verificada via MCP/grep/Read com file:line. O único
> ❌ (fast-logging mobile) está explícito e gateado, não mascarado como PASS.
