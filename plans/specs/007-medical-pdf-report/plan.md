# Implementation Plan: Relatório Médico em PDF (Mobile + Web)

**Feature Directory**: `plans/specs/007-medical-pdf-report`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1

---

## Technical Context

Mobile: gerar PDF via `expo-print` (HTML inline) + `expo-sharing`. Web: já existe via `jsPDF` (lazy). Dados de adesão de `@dosiq/core`.

**Paths reais verificados:**
- Web: `apps/web/src/features/reports/services/pdfGeneratorService.js` (jsPDF; `drawHeader`/`drawAdherenceSummary`) + `consultationPdfService.js`. ✅ **Manter/otimizar, não reescrever.**
- Mobile: `apps/mobile/src/features/reports/` = **[NEW]** (espelha a web).
- Cálculo de adesão: `@dosiq/core/utils/adherenceLogic.js`. ✅

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Health Data Safety | ✅ | Geração local; sem trafegar histórico por terceiros. |
| Mobile-First | ✅ | Renderizador nativo (`expo-print`). |
| dry-principles | ✅ | Reusa `adherenceLogic` + layout web como referência. |
| AP-B03 (bundle) | ✅ | Web mantém dynamic import. |
| R-221 SQP | ✅ | Minor mobile+web. |

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `apps/mobile/src/features/reports/services/pdfGeneratorService.js` | HTML inline + `expo-print`. | [NEW] |
| `apps/mobile/src/features/reports/components/ExportPdfButton.jsx` | aciona gerar + `expo-sharing`. | [NEW] |
| `apps/web/src/features/reports/services/pdfGeneratorService.js` | manter/otimizar lazy-load (AP-B03). | [MOD] existe |

> **Removido** o alvo da fonte `apps/web/src/features/history/services/webPdfService.js` (dir/arquivo inexistente; web real = `features/reports/pdfGeneratorService.js`).

---

## Architectural Approach

### Mobile (port)
1. `pdfGeneratorService.js`: monta string HTML (CSS inline WebKit/Blink) com cabeçalho + Medicamentos Ativos + Aderência (via `adherenceLogic` core) + histórico resumido. Espelha o layout do `pdfGeneratorService.js` web.
2. `Print.printToFileAsync({ html })` → path temporário.
3. `Sharing.shareAsync(uri)` → Share Sheet nativo.

### Web (manter)
`features/reports/pdfGeneratorService.js` já funcional — só garantir que `jsPDF`/`jspdf-autotable` seguem por `import()` dinâmico (AP-B03), sem regressão de bundle.

## SQP (R-221)
Mobile (novo) + Web (sem regressão). Minor. Bump `app.config.js` + CHANGELOG + store-note.

## Risks
- **Reescrever a web à toa**: escopo web = manter; só otimizar lazy se preciso.
- **Memória mobile em 90 dias**: tabelas enxutas/paginação no HTML.
- **Deps `expo-print`/`expo-sharing`**: requerem build nativa (não Expo Go).
