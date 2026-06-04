# Tasks: Suporte a Diabéticos Tipo 2 (Épico)

**Spec**: `spec.md` · **Plan**: `plan.md` · **Tier**: 2
**Sequência:** 022 mergeada → A → (B ∥ C) → D → E. 1 PR por fase.

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

- [ ] T020 [C1] Confirmar branch líquido de `consume_stock_fifo` (pós-022) e ponto de extensão UI.
- [ ] T021 [US4] Estender RPC: `intake_unit='UI'` (insulina) → `ml = ROUND(p_quantity/units_per_ml,2)` (U-100=100). Gotas/ml/sólido intactos.
- [ ] T022 [US4] `formatDoseUnit` (`doseUnit.js:8`) por unidade de administração (UI/ml/mg) — revisa ADR-046. Atualizar callers.
- [ ] T023 [US4] Adesão basal = modo binário (R-248) — confirmar dose fixa; `dose_exactness` fora.
- [ ] T024 [P] [C4] Testes: 10 UI → 0,10 ml (U-100) por FIFO; TTL antes do volume; `formatDoseUnit` por unidade; regressão sólido/gotas.

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
