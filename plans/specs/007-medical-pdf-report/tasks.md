# Tasks: Relatório Médico em PDF (Mobile + Web)

**Feature Directory**: `plans/specs/007-medical-pdf-report`
**Input**: `spec.md`, `plan.md` · **Status**: Dev Ready · **Tier**: 1

---

## Phase 0 — Reality Gates (C1)
- [ ] T001 [C1] Build nativa (`expo-print`/`expo-sharing` exigem; não Expo Go).
- [ ] T002 [C1] **GATE**: ler `apps/web/src/features/reports/services/pdfGeneratorService.js` — usar como referência de layout. Escopo web = **manter**, não reescrever. (NÃO existe `features/history/webPdfService.js`.)
- [ ] T003 [C1] Confirmar agregação de adesão reusável em `@dosiq/core/utils/adherenceLogic.js`.

## Phase 1 — Mobile
- [ ] T004 [US1] `apps/mobile/src/features/reports/services/pdfGeneratorService.js` [NEW]: HTML inline (espelha layout web) + `Print.printToFileAsync`.
- [ ] T005 [US2] `ExportPdfButton.jsx` [NEW]: aciona gerar + `Sharing.shareAsync`.
- [ ] T006 [US1] Instalar `expo-print` + `expo-sharing` (app.config.js se preciso).

## Phase 2 — Web (manter)
- [ ] T007 [FR-004] Garantir lazy-load `jsPDF`/`jspdf-autotable` (AP-B03) sem regressão de bundle. Sem reescrita.

## Phase 3 — Validation (C4)
- [ ] T008 [P] [C4] Teste: PDF mobile gera <1.5s; layout consistente com web; volume 90d não estoura memória.
- [ ] T009 [C4] `rtk lint` + `rtk npm run validate:agent`; medir bundle web (sem incremento).
- [ ] T010 [C4] Smoke PO: gerar + compartilhar no device.

## Phase 4 — Record (C5)
- [ ] T011 [C5] SQP R-221 (minor mobile+web), bump + CHANGELOG + store-note.
- [ ] T012 [C5] events/journal/state; PR; Gemini + aprovação humana.

## Traceability
FR-001→T004 · FR-002→T004/T003 · FR-003→T005 · FR-004→T007.
