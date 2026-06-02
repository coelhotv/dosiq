# Tasks: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`
**Input**: `spec.md`, `plan.md`
**Status**: Dev Ready

---

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Confirmar specs 022 e 023 mergeadas/aplicadas (enum, `intake_unit`, `formatDose`, desmembramento).
- [ ] T002 [C1] Verificar o caminho real do cadastro de **estoque no mobile** (não há `StockForm` mobile) e se o **wizard de onboarding** reusa `MedicineForm` (props de onboarding). Registrar antes de codar.

---

## Phase 2: Implementation (Web & Mobile Forms)

- [ ] T003 [US1] `MedicineForm.jsx` (+ `MedicineFormDosageInfo.jsx`): dropdown `['mg','mcg','g','ui','un','mg/ml','ui/ml']`, label "Concentração", badge `💧` + campo `Gotas por ml` para `/ml`.
- [ ] T004 [US1] `MedicineFormScreen.jsx` (mobile): mesma lógica.
- [ ] T005 [US1] Garantir que o passo de medicamento do **wizard** expõe as novas unidades (reuso do `MedicineForm` ou ajuste do passo, conforme T002).
- [ ] T006 [US1] `ProtocolFormDosesSection.jsx` (web) + `ProtocolFormBody.jsx` (mobile): select `intake_unit` condicional + hint para líquidos.
- [ ] T007 [US2] `StockForm.jsx` (+ `StockFormPurchaseDetails.jsx`): inputs `frascos`/`ml cada` + `Preço Total da Compra`; payload de desmembramento. (Mobile conforme T002.)

---

## Phase 3: Implementation (Banner + Telegram)

- [ ] T008 [US3] `StockAlertInline.jsx`: helper `nextDoseMl` (converte gotas→ml via `drops_per_ml`) + banner quando `stock.quantity < doseMl`.
- [ ] T009 [US4] `api/notify.js`: lembrete formatado com `formatDose(expected_dose, intake_unit)`.
- [ ] T010 [US4] `server/bot/callbacks/doseActions.js`: callback `✅ Tomei` passa a dose na unidade de tomada a `consume_stock_fifo`; estoque zerado → resposta best-effort (R-245/246).

---

## Phase 4: Validation (Quality Gates)

- [ ] T011 [P] [C4] Teste/smoke: dropdown de concentração lista `mg/ml`/`ui/ml` e oculta `ml`/`gotas` (web, mobile e wizard).
- [ ] T012 [P] [C4] Teste: banner dispara só quando a dose **convertida para ml** supera o saldo (caso 40 gotas/20 = 2ml > 1.5; caso 15 gotas = 0.75 não dispara).
- [ ] T013 [P] [C4] Teste: bot formata `formatDose` e o callback debita o volume correto; estoque zerado não trava.
- [ ] T014 [C4] Validar responsividade mobile + a11y (R-137/138) dos novos campos.
- [ ] T015 [C4] Rodar `rtk npm run validate:agent` (linter zero + suíte crítica) + smoke PO antes do PR (R-234).

---

## Phase 5: DEVFLOW Record

- [ ] T016 [C5] SQP (R-221): Web/PWA + Mobile; impacto Minor; CHANGELOG [Unreleased] (web+mobile) + store-note mobile ("cadastre xaropes e gotas em ml/gotas").
- [ ] T017 [C5] Abrir PR; aguardar Gemini + smoke PO + aprovação humana (R-060).

## Dependencies
T001/T002 antes de tudo. T003–T007 (forms) independentes entre arquivos. T008–T010 dependem de `formatDose`/`intake_unit` (023).

## Parallel Opportunities
T003/T004/T006/T007 `[P]` (arquivos distintos). T011–T013 `[P]`.
