# Tasks: Suporte a Diabéticos Tipo 2 (Épico)

**Spec**: `spec.md` · **Plan**: `plan.md` · **Tier**: 2
**Sequência:** ✅ 022 mergeada (#652, 2026-06-08) → A → (B ∥ C) → D → E. 1 PR por fase.
> **Nota 2026-06-08:** Fase D teve o núcleo (conversão UI→ml em `consume_stock_fifo`) **entregue
> antecipadamente pela 022 Fase C**. T020/T021/T024 viraram verificação/smoke; nenhuma migração de
> RPC na Fase D. Formatters de dose (R-272) e read-path (R-267) reusam 022.

---

## Phase A — Forma injetável + TTL biológico (PR 1) — ADR-059

- [ ] T001 [C1] Confirmar 022 mergeada (colunas `presentation`/`units_per_ml` em prod). Verificar caminho de registro de tomada que debita lote (`consume_stock_fifo` callers).
- [ ] T002 [US1] Migração `docs/migrations/2026XXXX_diabetes_a_injectable_ttl.sql`: `medicines.shelf_life_days INTEGER NULL`; `stock.opened_at TIMESTAMPTZ NULL`.
- [ ] T003 [US1] Inferir `stock.opened_at` na 1ª tomada que debita o lote (`opened_at IS NULL` → setar `now()`), best-effort (R-245). Cross-superfície (web/mobile/bot).
- [ ] T004 [US1] Helper puro core: `isBiologicallyExpired(stock, medicine)` = `opened_at + shelf_life_days ≤ now`. Eixo paralelo ao status volume (ADR-018).
- [ ] T005 [US1] UI alerta validade biológica (relógio) — web + mobile; distinto do alerta de volume.
- [ ] T006 [US1] `medicineSchema`: `shelf_life_days` (int positivo nullable); form expõe `presentation` (`injecao`/`pomada`) + `shelf_life_days` p/ injetáveis.
- [ ] T007 [P] [C4] Testes: `opened_at` inferido 1× (não re-seta); TTL expira por tempo independente do volume; injetável sem `shelf_life_days` → eixo inativo.

## Phase B — GLP-1 (mg, semanal, titulação) (PR 2) — ADR-061

- [ ] T008 [C1] **Auditar titulação existente**: criar protocolo GLP-1 `semanal` com `titration_schedule`; exercitar wizard/timeline/badge; mapear regressões pós-refactor. Registrar achados.
- [ ] T009 [US2] Corrigir regressões de titulação encontradas em T008 (`titrationUtils`/`titrationService`/UI).
- [ ] T010 [US2] `computeTolerances` (`doseInstanceGenerator.js:76`) frequency-aware: não-diário (`semanal`/`dias_alternados`) → `floor(período/2)` **sem `MAX_TOLERANCE`**; diário inalterado (cap 120). Passar `frequency` ao gerador.
- [ ] T011 [US2] Gerador congela `expected_dose` da etapa de titulação vigente na data (reusa FP-1) — confirmar p/ `semanal`.
- [ ] T012 [P] [C4] Testes: tolerância semanal > 120 (perdão 72h coberto); diário 1×/dia mantém 120; `expected_dose` correto por etapa; sweep `pending→missed` só após janela.

## Phase C — biomarkers_log + fast-logging + timeline híbrida (PR 3) — ADR-060

- [ ] T013 [C1] Confirmar caminho real do **fast-logging mobile** (FAB/bottom-sheet) — UNVERIFIED no plan. Registrar antes de codar.
- [ ] T014 [US3] Migração `docs/migrations/2026XXXX_diabetes_c_biomarkers.sql`: `biomarkers_log` (`id,user_id,type,value,unit,measured_at,context,source,notes,created_at`) + GRANTs + RLS (`user_id=auth.uid()`) + REVOKE anon. Enums PT (R-021).
- [ ] T015 [US3] `biomarkerLogSchema.js` (core) — sincronizado com CHECK (R-082); `safeParse`; `.nullable().optional()`.
- [ ] T016 [US3] Adapter `biomarkersToEvents` em `timelineService.js` → `TimelineEvent[]` `type='biomarker'` (R-252; **não tocar** `timeline.js`).
- [ ] T017 [US3] `BiomarkerEventCard.jsx` + registrar `biomarker` em `eventCardRegistry.js` (web) + equivalente mobile.
- [ ] T018 [US3] Fast-logging UI (web + mobile, conforme T013): glicemia mg/dL + contexto manual; reusa bottom-sheet/`FormSelect` (AP-180).
- [ ] T019 [P] [C4] Testes: biomarcador cria linha; aparece na timeline por instante (sem tocar builder); sem FK dose; sem meta; RLS isola por user.

## Phase D — Insulina basal (UI/volume) (PR 4)

- [ ] T020 [C1] Verificar em prod (MCP): `consume_stock_fifo` já converte `UI`→ml (`lower(intake_unit) IN ('gotas','ui')`, migr. `20260608`). ✅ **núcleo entregue por 022** — Fase D **não cria migração nem altera a RPC** (AP-221).
- [ ] T021 [US4] Smoke insulina U-100: tomada `10 UI` → debita `0,10 ml` por FIFO. Cobrir U-200 (`units_per_ml=200`) se aplicável. Confirmar densidade capturada no tratamento (form de protocolo, `intake_unit='UI'`).
- [ ] T022 [US4] Auditar superfícies de dose de insulina (dashboard/histórico/timeline/estoque/emergência/consulta): query traz `intake_unit`+`units_per_ml` (R-267) e render via `formatIntakeDose`/`formatDoseItem`/`formatDoseHint` (R-272, **reusa 022**) — nunca `dosage_unit` cru. Inputs numéricos normalizam vírgula PT-BR (R-270).
- [ ] T023 [US4] Adesão basal = modo binário (R-248) — confirmar dose fixa; `dose_exactness` fora.
- [ ] T024 [P] [C4] Testes/smoke: 10 UI → 0,10 ml (U-100) por FIFO (verificação, não nova impl.); TTL antes do volume; render via formatter (R-272); regressão sólido/gotas/ml intacta.

## Phase E — Export clínico (PR 5)

- [ ] T025 [C1] Mapear o caminho real do relatório PDF clínico (Spec 007 base).
- [ ] T026 [US5] Relatório cruza dose × `biomarkers_log` por período/dia, server-side (R-249), descritivo (sem recomendação — SaMD).
- [ ] T027 [P] [C4] Testes: agregação server-side; PDF sem cálculo de dose.

## Quality Gates & Record (cada PR)

- [ ] T028 [C4] `rtk npm run validate:agent` + smoke PO (mobile) antes do PR (R-234).
- [ ] T029 [C5] SQP (R-221): A=Backend/infra · B/C/D=Web+Mobile+Core (minor, store-note diabetes) · E=Web (minor). CHANGELOG [Unreleased] por plataforma.
- [ ] T030 [C5] ADR-059..062 → accepted antes do código da fase respectiva; catalogar CON `biomarkers_log`. PR por fase; Gemini + smoke PO + aprovação humana (R-060). Nunca auto-merge.

## Dependencies
022 mergeada → A. B e C paralelizáveis após A. D depende de C. E depende de C+D.

## Traceability
FR-001..004 → A (T002–T007) · FR-005..008 → B (T008–T012) · FR-009..012 → C (T014–T019) · FR-013..015 → D (T021–T024) · FR-016 → E (T026).

## Orquestração (model tiering — ver plan.md §Orquestração & Model Tiering)
Pré-spawn obrigatório: **AP-169 Branch Sync Ritual** (`git fetch` + sync) em qualquer task que toque `packages/*` ou `apps/*/src/features/*`. Sub-agentes nunca commitam main (R-060). cavecrew-reviewer ≠ gate (revisor = Gemini). Haiku só folha trivial — nunca math de dose/UI→ml/tolerância/RLS.

| Task | Agente / modelo |
|------|-----------------|
| T001 / T008 / T013 / T020 / T025 [C1] | cavecrew-investigator (haiku/sonnet) |
| T002 / T014 (migração SQL, RLS/grants) | sonnet |
| T004 / T015 / T016 (helper/schema/adapter bounded) | cavecrew-builder ou sonnet |
| T005 / T006 / T017 / T018 / T022 / T023 / T026 (UI/render/export) | sonnet (+ui-design-brain); main valida SaMD/R-267/R-272 |
| T007 / T012 / T019 / T024 [P] (testes) | sonnet (paraleliza) |
| **T003 / T010** (write-path AP-193 / tolerância clínica) | **main / opus** — não delegar |
| T021 / T024 (smoke insulina) | humano (PO) |
| T028 / T029 / T030 [C4/C5] (gates/SQP/record) | **main / opus** |
