# Implementation Plan: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`
**Spec**: `spec.md`
**Revised**: 2026-06-02
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Technical Context

Schemas Zod no core (`packages/core/src/schemas/`), lógica de desmembramento no `stockService` (web + mobile, ambos **`.js`**) **via RPC `create_purchase_with_stock`**, e extensão do helper existente `doseUnit.js` com `formatDose`.

**Verificado no código real:**
- `DOSAGE_UNITS = ['mg','mcg','g','ml','ui','un','gotas']` (`medicineSchema.js:9`).
- `protocols.dosage_per_intake` já é `.number().positive().max(1000)` decimal (`protocolSchema.js:102`) → **não** precisa mexer no teto aqui.
- Cap-100 real: `logSchema.quantity_taken.max(100)` (`logSchema.js:36`) + `adherencePatternSchema:13`, `costAnalysisSchema:79`, `reminderOptimizerSchema:19`.
- `create_purchase_with_stock(p_medicine_id, p_quantity, p_unit_price, p_purchase_date, p_expiration_date, p_pharmacy, p_laboratory, p_notes)` (caller real: `server/bot/commands/adicionar_estoque.js:128`). `stockService.add → purchaseRepo.createPurchase` (`stockService.js:24`).
- `doseUnit.js` **já existe** com `formatDoseUnit`, `pluralizeDoseUnit`, `formatNumberPtBR`, `formatActiveIngredient{Short,Hint,Formula}`.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| smart-data-design | ✅ | Zod tipa decimais; bloqueia estados inconsistentes (líquido sem `drops_per_ml`/`intake_unit`). |
| dry-principles | ✅ | `formatDose` **estende** `doseUnit.js`, reusa `formatNumberPtBR`/`pluralizeDoseUnit` — sem helper paralelo. |
| backwards-compatibility | ✅ | Desmembramento via `create_purchase_with_stock` (modelo `purchases` intacto); sólidos inalterados. |

---

## Architecture & Implementation

### 1. Zod — `medicineSchema.js`
```javascript
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ml', 'ui', 'un', 'gotas', 'mg/ml', 'ui/ml']

const medicineSchema = z.object({
  // ...campos existentes...
  dosage_unit: z.enum(DOSAGE_UNITS),
  dosage_per_pill: z.number().positive('Concentração deve ser maior que zero').nullable().optional(),
  drops_per_ml: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.dosage_unit?.endsWith('/ml')) {
    // Líquido exige fator de gotas; concentração é recomendada mas pode faltar em legados migrados (NULL).
    if (data.drops_per_ml == null) {
      ctx.addIssue({ code: 'custom', path: ['drops_per_ml'],
        message: 'Gotas por ml é obrigatório para medicamentos líquidos (padrão 20).' })
    }
  }
})
```
> Concentração (`dosage_per_pill`) **não** é exigida: legados migrados (`ml`/`gotas`→`mg/ml`) têm `NULL` e precisam continuar salváveis. A massa ativa só é exibida quando preenchida.

### 2. Zod — `protocolSchema.js`
```javascript
export const INTAKE_UNITS = ['gotas', 'ml', 'UI']

const protocolSchema = z.object({
  // ...campos existentes (dosage_per_intake permanece .positive().max(1000))...
  intake_unit: z.enum(INTAKE_UNITS).nullable().optional(),
}).superRefine((data, ctx) => {
  // Cross-validação: medicamento líquido exige unidade de tomada.
  // (medicineIsLiquid resolvido pelo caller/form; aqui validamos coerência se o flag vier no payload.)
  if (data._medicineIsLiquid === true && !data.intake_unit) {
    ctx.addIssue({ code: 'custom', path: ['intake_unit'],
      message: 'Defina a unidade de tomada (gotas, ml ou UI) para medicamentos líquidos.' })
  }
})
```
> `_medicineIsLiquid` é um campo de contexto opcional injetado pelo form (derivado de `dosage_unit LIKE '%/ml'`), não persistido. Alternativa: validar no service após buscar o medicamento.

### 3. Revisão do teto R-022 (cap-100 → cap-1000)
Elevar `.max(100)` → `.max(1000)` (cobre `gotas`) com mensagem atualizada em:
- `packages/core/src/schemas/logSchema.js:36` (`quantity_taken`)
- `packages/core/src/schemas/adherencePatternSchema.js:13`
- `packages/core/src/schemas/costAnalysisSchema.js:79`
- `packages/core/src/schemas/reminderOptimizerSchema.js:19`

> Comentar a revisão de R-022: o cap Zod é guarda anti-erro de digitação; a **integridade física** vem do `CHECK (quantity >= 0)` + saldo FIFO (spec 022). Manter `.positive()`.

### 4. Desmembramento via `create_purchase_with_stock` (`stockService.js` web + mobile)
```javascript
// Conceitual — uma chamada de RPC por frasco (modelo purchases v4.0.0 preservado).
async function createLiquidPurchase({ medicineId, numBottles, volumePerBottle, totalPrice,
                                      purchaseDate, expirationDate, pharmacy, laboratory, notes }) {
  const pricePerBottle = round2(totalPrice / numBottles)
  const compensatedLast = round2(totalPrice - pricePerBottle * (numBottles - 1)) // fecha o total exato
  const unitPriceMl = round4(pricePerBottle / volumePerBottle)
  const compensatedUnitPriceMl = round4(compensatedLast / volumePerBottle)

  const results = []
  for (let i = 0; i < numBottles; i++) {
    const isLast = i === numBottles - 1
    const { data, error } = await supabase.rpc('create_purchase_with_stock', {
      p_medicine_id: medicineId,
      p_quantity: volumePerBottle,                 // volume nominal do frasco em ml
      p_unit_price: isLast ? compensatedUnitPriceMl : unitPriceMl,
      p_purchase_date: purchaseDate,
      p_expiration_date: expirationDate ?? null,
      p_pharmacy: pharmacy ?? null,
      p_laboratory: laboratory ?? null,
      p_notes: notes ?? null,
    })
    if (error) throw error
    results.push(data)
  }
  return results
}
```
> Cada chamada cria 1 `purchase` + 1 lote `stock` (com `purchase_id`, `original_quantity = quantity = volumePerBottle`). FIFO do banco opera frasco a frasco. **Sólidos** seguem o caminho atual (1 chamada). `round2`/`round4` = helpers locais (`Number(x.toFixed(n))`).

### 5. `formatDose` — extensão de `doseUnit.js` (NÃO novo arquivo)
```javascript
// Acrescentar em packages/core/src/utils/doseUnit.js
export function formatDose(value, unit) {
  if (value === undefined || value === null) return ''
  const v = formatNumberPtBR(value) // reuso: vírgula decimal + milhares corretos
  if (unit === 'ml') return `${v} ml`
  if (unit === 'gotas') return `${v} ${Number(value) === 1 ? 'gota' : 'gotas'}`
  if (unit === 'UI') return `${v} UI`
  return `${v} ${unit || ''}`.trim()
}
```
> Reusa `formatNumberPtBR` (evita o `.replace('.',',')` ingênuo que quebra milhares). `pluralizeDoseUnit` devolve "unidade(s)" (sólidos) — **não** serve para gotas, por isso o singular/plural de `gotas` é inline. `apps/web/src/schemas/*` faz `export *` do core, então a mudança vive **só na definição** (`packages/core/...`), sem tocar callers (AP-199).

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `packages/core/src/schemas/medicineSchema.js` | enum + `drops_per_ml`/`dosage_per_pill` + refine líquido. | core (verificado) |
| `packages/core/src/schemas/protocolSchema.js` | `intake_unit` + cross-validação. | core (verificado) |
| `packages/core/src/schemas/logSchema.js` | cap-100 → 1000 em `quantity_taken`. | `logSchema.js:36` |
| `packages/core/src/schemas/adherencePatternSchema.js` | cap-100 → 1000. | `:13` |
| `packages/core/src/schemas/costAnalysisSchema.js` | cap-100 → 1000. | `:79` |
| `packages/core/src/schemas/reminderOptimizerSchema.js` | cap-100 → 1000. | `:19` |
| `packages/core/src/utils/doseUnit.js` | adicionar `formatDose` (estende). | existe (verificado) |
| `apps/web/src/features/stock/services/stockService.js` | desmembramento via N× `create_purchase_with_stock`. | `:24` |
| `apps/mobile/src/features/stock/services/stockService.js` | mesmo, mobile (JS, não TS). | verificado |

---

## Risks

- **Cross-validação líquido↔intake_unit**: se o `protocolSchema` não tiver o medicamento no payload, validar no `protocolService` após buscar `medicines.dosage_unit`. Documentar a abordagem escolhida no PR.
- **Esquemas duplicados core↔web**: confirmar se `apps/web/src/schemas/*` reexporta do core ou duplica; aplicar a mudança na **definição** (core), não no caller (AP-199).
