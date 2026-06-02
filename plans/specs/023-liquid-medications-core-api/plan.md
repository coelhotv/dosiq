# Implementation Plan: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`  
**Spec**: `spec.md`  
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Technical Context

Este plano implementa os Schemas de validação Zod no core, a lógica transacional do middle-tier (`stockService`) para fazer o desmembramento de frascos em inserts individuais FIFO, e o helper puro de formatação de doses (`formatDose`) em português brasileiro.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| smart-data-design | ✅ | Zod schemas exigindo tipagem correta de decimais e bloqueio de estados inconsistentes. |
| dry-principles | ✅ | Helpers de formatação puros centralizados em `@dosiq/core/utils/` e reusados na Web, Mobile e Telegram. |

---

## Architecture & Implementation Details

### 1. Zod Validation (Core Schemas)

#### `src/schemas/medicineSchema.js`
Atualizamos o validador do cadastro do medicamento:
```javascript
const medicineSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  laboratory: z.string().optional(),
  active_ingredient: z.string().optional(),
  dosage_unit: z.enum(['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'ui']),
  dosage_per_pill: z.number().positive("Concentração deve ser maior que zero").optional(),
  drops_per_ml: z.number().int().positive().default(20).optional(),
}).refine(data => {
  // Se for proporção líquida, exige o drops_per_ml e dosage_per_pill (concentração)
  if (data.dosage_unit.endsWith('/ml')) {
    return data.dosage_per_pill !== undefined;
  }
  return true;
}, {
  message: "Concentração ativa é obrigatória para medicamentos líquidos",
  path: ["dosage_per_pill"]
});
```

#### `src/schemas/protocolSchema.js`
Atualizamos o validador do protocolo para permitir decimais na tomada de líquidos:
```javascript
const protocolSchema = z.object({
  medicine_id: z.string().uuid(),
  dosage_per_intake: z.number().positive("A dosagem deve ser maior que zero"),
  intake_unit: z.enum(['gotas', 'ml', 'UI']).optional(),
});
```

---

### 2. Desmembramento de Compras e Cálculo de Custo por mL no `stockService`
Na API do core (`apps/web/src/features/stock/services/stockService.js` e equivalentes mobile), a inserção de estoque para medicamentos líquidos é interceptada. 

Quando o usuário cadastra `N frascos` de `V ml` pelo preço total `P`:
1. Calculamos o preço de cada frasco individual: `price_per_bottle = P / N` (arredondado para 2 casas decimais).
2. Para evitar perdas de centavos no total da compra por dízimas na divisão de frascos, acumulamos a diferença na última linha:
   - `compensated_price_per_bottle = P - (price_per_bottle * (N - 1))`
3. O preço unitário por ml (que será salvo no banco em `unit_price`) é derivado para cada lote de forma que o cálculo de custo médio mensal do tratamento seja mantido com precisão exata:
   - Para frascos padrão: `unit_price_per_ml = ROUND(price_per_bottle / V, 4)`
   - Para o último frasco: `compensated_unit_price_per_ml = ROUND(compensated_price_per_bottle / V, 4)`
4. Disparamos `N` inserts para a tabela `stock` no Supabase:
   - Para os primeiros $N-1$ frascos: `original_quantity = V`, `quantity = V`, `unit_price = unit_price_per_ml`
   - Para o último frasco: `original_quantity = V`, `quantity = V`, `unit_price = compensated_unit_price_per_ml`

```javascript
// Exemplo conceitual da lógica de desmembramento com custo por ml no stockService
async function createPurchaseWithStock({ medicineId, numBottles, volumePerBottle, totalPrice, expirationDate, userId }) {
  const isLiquid = await checkIfLiquid(medicineId);
  
  if (isLiquid) {
    const pricePerBottle = parseFloat((totalPrice / numBottles).toFixed(2));
    const compensatedPricePerBottle = parseFloat((totalPrice - (pricePerBottle * (numBottles - 1))).toFixed(2));
    
    const unitPricePerMl = parseFloat((pricePerBottle / volumePerBottle).toFixed(4));
    const compensatedUnitPricePerMl = parseFloat((compensatedPricePerBottle / volumePerBottle).toFixed(4));
    
    const stockLines = [];
    for (let i = 0; i < numBottles; i++) {
      stockLines.push({
        medicine_id: medicineId,
        user_id: userId,
        original_quantity: volumePerBottle,
        quantity: volumePerBottle,
        unit_price: (i === numBottles - 1) ? compensatedUnitPricePerMl : unitPricePerMl,
        expiration_date: expirationDate,
        entry_type: 'purchase'
      });
    }
    
    // Insere múltiplos frascos independentes com custo/ml no Supabase em lote
    const { data, error } = await supabase.from('stock').insert(stockLines);
    return { data, error };
  } else {
    // Comportamento discreto legado para comprimidos (1 linha de estoque)
  }
}
```

---

### 3. Helper de Exibição Puro `formatDose`
Helper puro centralizado em `packages/core/src/utils/doseUnit.js` para renderização amigável de dosagens em português brasileiro:

```javascript
export function formatDose(value, unit) {
  if (value === undefined || value === null) return '';
  
  // Substitui ponto por vírgula decimal para português
  const formattedValue = value.toString().replace('.', ',');
  
  if (unit === 'ml') {
    return `${formattedValue} ml`;
  }
  if (unit === 'gotas') {
    return value === 1 ? `${formattedValue} gota` : `${formattedValue} gotas`;
  }
  if (unit === 'UI') {
    return `${formattedValue} UI`;
  }
  
  // Fallback padrão (comprimidos, etc.)
  return `${formattedValue} ${unit || ''}`.trim();
}
```

---

## Target Files

| Path | Purpose | Source Evidence |
|------|---------|-----------------|
| `src/schemas/medicineSchema.js` | Modificar o validador Zod do cadastro do medicamento para líquidos. | Core Validation |
| `src/schemas/protocolSchema.js` | Modificar o validador Zod do protocolo. | Core Validation |
| `packages/core/src/utils/doseUnit.js` | [NEW] Helper universal de formatação de strings de dosagem. | Pure Helper |
| `apps/web/src/features/stock/services/stockService.js` | Integrar a lógica de desmembramento de frascos e compensação financeira centava. | Core Stock Service |
| `apps/mobile/src/features/stock/services/stockService.ts` | Sincronizar lógica de desmembramento no serviço mobile. | Core Stock Service |
