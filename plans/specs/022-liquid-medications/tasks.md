# Tasks: Medicamentos Líquidos (Épico)

**Feature Directory**: `plans/specs/022-liquid-medications`
**Input**: `spec.md`, `plan.md`
**Status**: Dev Ready
**Tier**: 2

> Staging de PR: cada Fase (A/B/C) = **1 PR sequencial**. A entrega B depende de A aplicada; C depende de B.

---

## Phase A — DB/Backend (PR 1)

- [ ] T001 [C1] Verificar `pg_constraint`/`information_schema` o nome real da constraint de `dosage_unit` (ou se é `text` livre). Registrar antes de codar.
- [ ] T002 [US1] Migração `docs/migrations/20260602_liquid_meds_db.sql` — A.1 enum (`mg/ml`,`ui/ml`).
- [ ] T003 [US1] Mesma migração — A.2 colunas (`medicines.units_per_ml`, `medicines.presentation` + CHECK `medicines_presentation_check`, `protocols.intake_unit`) + `CHECK (stock.quantity >= 0)`. Coordenação 012 (ADR-058).
- [ ] T004 [US2] Mesma migração — A.3 migração de dados (`ml`/`gotas` → `mg/ml` + `protocols.intake_unit` + `presentation='liquido'`; backfill `presentation='comprimido'` p/ remanescentes), idempotente.
- [ ] T005 [US3] Mesma migração — A.4 RPC `consume_stock_fifo` (ramo líquido + linear sólido + hardening SECURITY DEFINER). Ver `contracts/consume_stock_fifo.md`.
- [ ] T006 [P] [C4] Teste integração SQL (Supabase local): líquido ml, líquido gotas, sólido, multilote FIFO, idempotência da migração, regressão `restore_stock_for_log`.
- [ ] T007 [C4] Validar contagem pré/pós: `SELECT count(*) FROM medicines WHERE dosage_unit IN ('ml','gotas')` → 0.

## Phase B — Core/Validações/Serviços (PR 2)

- [ ] T008 [C1] Confirmar Fase A aplicada (enum + colunas em prod/staging). Confirmar `apps/web/src/schemas/*` reexporta core (AP-199).
- [ ] T009 [US4] `medicineSchema.js`: enum `+ mg/ml,ui/ml`, `units_per_ml`/`dosage_per_pill` nullable, `presentation` (`PRESENTATIONS` enum PT, default `comprimido`), superRefine líquido.
- [ ] T010 [US4] `protocolSchema.js`: `intake_unit` enum + cross-validação (`_medicineIsLiquid`).
- [ ] T011 [US4] Cap-100 → 1000 em `logSchema.js:36`, `adherencePatternSchema.js:13`, `costAnalysisSchema.js:79`, `reminderOptimizerSchema.js:19`. Documentar revisão R-022.
- [ ] T012 [US5] `stockService.createPurchase` web + mobile: desmembramento N× `create_purchase_with_stock` + compensação de centavos. Ver `contracts/create_purchase_with_stock.md`.
- [ ] T013 [US9] `doseUnit.js`: adicionar `formatDose` (estende; reusa `formatNumberPtBR`). Ver `contracts/formatDose.md`.
- [ ] T014 [P] [C4] Testes unitários: `formatDose` (gotas/ml/UI/singular), desmembramento (incl. centavos), schemas (válido/inválido, sólido/líquido).

## Phase C — UI/UX + Telegram (PR 3)

- [ ] T015 [C1] Verificar caminho real do estoque **mobile** (não há `StockForm` mobile) e se o **wizard** reusa `MedicineForm`. Registrar antes de codar.
- [ ] T016 [US6] `MedicineForm.jsx` (+ `MedicineFormDosageInfo.jsx`) + `MedicineFormScreen.jsx` (mobile): dropdown novo, badge `💧`, campo `Gotas por ml` (→ `units_per_ml`), setar `presentation='liquido'` ao escolher `/ml` (UI dedicada de forma p/ injecao/pomada é escopo da 012).
- [ ] T017 [US6] Garantir que o passo de medicamento do **wizard** expõe as novas unidades (reuso ou ajuste, conforme T015).
- [ ] T018 [US6] `ProtocolFormDosesSection.jsx` (web) + `ProtocolFormBody.jsx` (mobile): select `intake_unit` condicional + hint.
- [ ] T019 [US7] `StockForm.jsx` (+ `StockFormPurchaseDetails.jsx`): inputs frascos/ml + `Preço Total`; payload de desmembramento. Mobile conforme T015.
- [ ] T020 [US8] `StockAlertInline.jsx`: `nextDoseMl` (gotas→ml via `units_per_ml`) + banner quando `stock.quantity < doseMl`.
- [ ] T021 [US9] `api/notify.js`: lembrete `formatDose(expected_dose, intake_unit)`.
- [ ] T022 [US9] `server/bot/callbacks/doseActions.js`: callback `✅ Tomei` debita na unidade de tomada via `consume_stock_fifo`; estoque zerado → best-effort (R-245/246).
- [ ] T023 [P] [C4] Testes/smoke: dropdown (web/mobile/wizard); banner (40 gotas/20=2ml dispara; 15 gotas=0.75 não); bot formata + debita; estoque zerado não trava.
- [ ] T024 [C4] Responsividade mobile + a11y (R-137/138) dos novos campos.

## Quality Gates & Record (cada PR)

- [ ] T025 [C4] `rtk npm run validate:agent` (linter zero + suíte crítica) + smoke PO antes do PR (R-234).
- [ ] T026 [C5] SQP (R-221): Fase A = Backend/infra (migração); B = Shared/Core (minor); C = Web/PWA + Mobile (minor, store-note "cadastre xaropes e gotas"). CHANGELOG [Unreleased] por plataforma.
- [ ] T027 [C5] Abrir PR por fase; aguardar Gemini + smoke PO + aprovação humana (R-060). Nunca auto-merge.

## Dependencies
Fase A → B → C (estritamente sequencial). Dentro de A: T002–T005 mesmo arquivo SQL (ordem importa). T006/T014/T023 `[P]`.

## Traceability
FR-001..002b,003..006 → Fase A (T002–T007) · FR-007..012 → Fase B (T009–T014) · FR-013..017 → Fase C (T016–T023).
