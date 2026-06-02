# Implementation Plan: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`
**Spec**: `spec.md`
**Revised**: 2026-06-02
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/specs/023-liquid-medications-core-api/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Technical Context

UI no PWA (React) + Mobile (React Native, **JS**) e Bot do Telegram. Consome o enum estendido, `intake_unit` e `formatDose` da spec 023 e a RPC `consume_stock_fifo` da 022.

**Paths reais verificados:**
- Web: `MedicineForm.jsx` (+ `sections/MedicineFormDosageInfo.jsx`), `ProtocolForm.jsx` (+ `sections/ProtocolFormDosesSection.jsx`), `StockForm.jsx` (+ `sections/StockFormPurchaseDetails.jsx`), `dashboard/components/StockAlertInline.jsx`.
- Mobile: `medications/screens/MedicineFormScreen.jsx`, `treatments/components/ProtocolFormBody.jsx` (+ `screens/ProtocolFormScreen.jsx`, `hooks/useProtocolFormState.js`). **Estoque mobile: caminho a confirmar em C1** (não há `StockForm.tsx`).
- Bot: `api/notify.js`, `server/bot/callbacks/doseActions.js` (já chama `consume_stock_fifo` em `:96`).
- Onboarding wizard: passo de medicamento reusa `MedicineForm` (modo onboarding) — confirmar em C1.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| visual-hierarchy | ✅ | Badges/hints discretos; selects condicionais sem ruído. |
| mobile-performance | ✅ | Sem novas libs; campos condicionais leves. |
| accessibility (idoso, R-137/138) | ✅ | Labels claras, copy explicativa, toques amplos. |

---

## UI/UX & Telegram Design

### 1. MedicineForm + Wizard (web/mobile)
- Dropdown de concentração: `['mg','mcg','g','ui','un','mg/ml','ui/ml']` (remove `ml`/`gotas` — agora são `intake_unit`). Mesma lista no **passo de medicamento do wizard**.
- `dosage_unit.endsWith('/ml')` ⇒ badge `💧 Apresentação Líquida` + campo `Gotas por ml` (mapeia `drops_per_ml`, default 20).
- Label do campo de concentração: **"Concentração"** (mapeia `dosage_per_pill`; oculta "Dose por comprimido").

### 2. ProtocolForm (web/mobile)
- Observa o medicamento selecionado; se `dosage_unit` termina em `/ml`:
  - Exibe select `intake_unit` = `['gotas','ml','UI']`.
  - Hint: *"💧 Você está configurando um medicamento líquido. Defina a dose na unidade de tomada (gotas ou ml)."*
- Sólido: select + hint ocultos (`intake_unit` fica `NULL`).

### 3. StockForm (web; mobile a confirmar)
- Líquido: cabeçalho `💧 Inventário de Líquidos`, inputs `[ N ] frascos` / `[ V ] ml cada`, campo **"Preço Total da Compra (R$)"**.
- Submit despacha `{ medicineId, numBottles, volumePerBottle, totalPrice, purchaseDate, expirationDate, ... }` ao `stockService.createPurchase` (desmembramento da spec 023).

### 4. Banner de fim de frasco (`StockAlertInline.jsx`)
```javascript
// Converte a dose da próxima ocorrência para ml ANTES de comparar com o saldo (ml).
function nextDoseMl(expectedDose, intakeUnit, dropsPerMl = 20) {
  if (intakeUnit === 'gotas') return Number((expectedDose / dropsPerMl).toFixed(2))
  return expectedDose // 'ml' e 'UI' (v1) = escala direta
}
// Dispara o banner se o saldo do frasco ativo < dose convertida.
const doseMl = nextDoseMl(instance.expected_dose, protocol.intake_unit, medicine.drops_per_ml)
if (activeStockQuantity < doseMl) { /* renderiza aviso "frasco no fim" */ }
```
> Só para líquidos (`dosage_unit LIKE '%/ml'`). Reusa `formatNumberPtBR` para exibir o saldo (ex.: "1,5 ml").

### 5. Telegram (`api/notify.js` + `server/bot/callbacks/doseActions.js`)
- Lembrete: `formatDose(expected_dose, intake_unit)` → *"🔔 Hora do seu Ibuprofeno! Tomar 2,5 ml agora."*
- Callback `✅ Tomei`: persiste o log e chama `consume_stock_fifo({ p_quantity: expected_dose, ... })` — a RPC converte gotas→ml (spec 022). Estoque zerado (erro da RPC) → resposta best-effort, sem travar (R-245/246).

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `apps/web/src/features/medications/components/MedicineForm.jsx` (+ `sections/MedicineFormDosageInfo.jsx`) | dropdown + badge + `drops_per_ml`. | verificado |
| `apps/mobile/src/features/medications/screens/MedicineFormScreen.jsx` | idem mobile (JS). | verificado |
| `apps/web/src/features/protocols/components/sections/ProtocolFormDosesSection.jsx` | select `intake_unit` condicional. | verificado |
| `apps/mobile/src/features/treatments/components/ProtocolFormBody.jsx` | idem mobile. | verificado |
| `apps/web/src/features/stock/components/StockForm.jsx` (+ `sections/StockFormPurchaseDetails.jsx`) | inputs frascos/ml + preço total. | verificado |
| `apps/web/src/features/dashboard/components/StockAlertInline.jsx` | banner com conversão de unidade. | verificado |
| `server/bot/callbacks/doseActions.js` | callback `✅ Tomei` + `formatDose`. | `:96` |
| `api/notify.js` | lembrete com `formatDose`. | verificado |
| (mobile stock UI) | a confirmar em C1. | — |

---

## Risks

- **Estoque mobile sem componente espelho**: confirmar o fluxo real (screen/hook) em C1; não assumir `StockForm` mobile.
- **Wizard**: confirmar se o passo de medicamento reusa `MedicineForm` (props de onboarding) — se sim, a mudança do dropdown propaga automaticamente; senão, ajustar o passo do wizard também.
- **a11y/idoso (R-137/138)**: dois inputs (frascos/ml) podem confundir; aplicar micro-copy e agrupamento visual.
