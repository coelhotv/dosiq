# Implementation Plan: Medicamentos Líquidos (Épico)

**Feature Directory**: `plans/specs/022-liquid-medications`
**Spec**: `spec.md`
**Revised**: 2026-06-02
**Tier**: 2

---

## Technical Context

Épico em 3 camadas, entregue em 3 PRs sequenciais (Fases A→B→C em `tasks.md`):
- **Fase A** — Supabase/PostgreSQL: enum, colunas, migração de dados, RPC `consume_stock_fifo`.
- **Fase B** — Core (`packages/core`): schemas Zod, `stockService` (desmembramento via RPC), `formatDose`.
- **Fase C** — UI (PWA React + Mobile RN, **JS**) + Bot Telegram.

Líquido é **derivado da unidade** (`dosage_unit LIKE '%/ml'`), nunca de booleano. Estoque fluido vive em `stock.quantity` (`numeric`, ml restantes); `original_quantity` = volume nominal do frasco. Fração de frasco = `quantity / original_quantity`.

**Schema real verificado (prod):** `stock` tem `quantity numeric`, `original_quantity numeric`, `unit_price numeric(12,4)`, `purchase_id uuid` (FK → `purchases`), `entry_type text`. Colunas de dose (`medicine_logs.quantity_taken`, `dose_instances.expected_dose`, `protocols.dosage_per_intake`) **já são `numeric`** — frações cabem sem migração de coluna. `consume_stock_fifo` **já existe** com a assinatura `(p_user_id, p_medicine_id, p_quantity, p_medicine_log_id)` (callers: `server/services/medicineLogService.js`, `server/bot/callbacks/doseActions.js`).

**Core verificado:**
- `DOSAGE_UNITS = ['mg','mcg','g','ml','ui','un','gotas']` (`medicineSchema.js:9`).
- `protocols.dosage_per_intake` já `.number().positive().max(1000)` decimal (`protocolSchema.js:102`) → **não** mexer no teto aqui.
- Cap-100 real: `logSchema.quantity_taken.max(100)` (`logSchema.js:36`) + `adherencePatternSchema:13`, `costAnalysisSchema:79`, `reminderOptimizerSchema:19`.
- `create_purchase_with_stock(p_medicine_id, p_quantity, p_unit_price, p_purchase_date, p_expiration_date, p_pharmacy, p_laboratory, p_notes)` (caller: `server/bot/commands/adicionar_estoque.js:128`); `stockService.add → purchaseRepo.createPurchase` (`stockService.js:24`).
- `doseUnit.js` já existe com `formatDoseUnit`, `pluralizeDoseUnit`, `formatNumberPtBR`, `formatActiveIngredient{Short,Hint,Formula}`.

> **Precisão:** `stock.quantity`/`original_quantity` são `numeric` **sem escala fixa** (não `numeric(10,2)`). 2 casas garantidas por `ROUND(.,2)` na RPC + Zod, não pela coluna. Não alterar o tipo (risco em tabela viva).

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| smart-data-design | ✅ | `numeric` + `ROUND(.,2)`; sem coluna redundante; Zod bloqueia estados inconsistentes. |
| backwards-compatibility | ✅ | Nenhuma coluna física nova em `stock`; desmembramento via `create_purchase_with_stock`; sólidos inalterados; migração idempotente. |
| single-source-of-truth | ✅ | `medicines.dosage_unit` (termina em `/ml`) define líquido implicitamente. |
| dry-principles | ✅ | `formatDose` **estende** `doseUnit.js` (reusa `formatNumberPtBR`) — sem helper paralelo. |
| accessibility (idoso, R-137/138) | ✅ | Labels claras, copy explicativa, toques amplos; dois inputs (frascos/ml) agrupados. |

---

## Fase A — DB/Backend (SQL)

Arquivo: `docs/migrations/20260602_liquid_meds_db.sql`. Ordem: (1) enum, (2) colunas + check, (3) migração de dados, (4) RPC.

### A.1 — Estender enum de unidades de concentração
`dosage_unit` é validado por `CHECK`/`text` (não enum nativo). Confirmar via `pg_constraint`/`information_schema` antes; se houver `CHECK (dosage_unit IN (...))`, recriar com os novos valores:

```sql
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_dosage_unit_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_dosage_unit_check
  CHECK (dosage_unit IN ('mg','mcg','g','ml','ui','un','gotas','mg/ml','ui/ml'));
```
> `'ml'`/`'gotas'` permanecem no CHECK por retrocompat até a migração de dados zerar o uso; o **form** (Fase C) deixa de oferecê-los como concentração.

### A.2 — Colunas estruturais + check de saldo
```sql
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS drops_per_ml INTEGER DEFAULT 20;
ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS intake_unit TEXT DEFAULT NULL;
ALTER TABLE public.stock ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (quantity >= 0);
```
> Colunas em tabelas existentes **não** exigem novos GRANTs (regra do CLAUDE.md vale p/ `CREATE TABLE`). RLS vigente preservada.

### A.3 — Migração de dados (`ml`/`gotas` → `mg/ml`)
```sql
-- 3a. Move a unidade de tomada antiga p/ os protocolos do medicamento líquido legado.
UPDATE public.protocols p
SET intake_unit = m.dosage_unit         -- 'ml' ou 'gotas'
FROM public.medicines m
WHERE p.medicine_id = m.id
  AND m.dosage_unit IN ('ml','gotas')
  AND p.intake_unit IS NULL;

-- 3b. Converte a unidade do medicamento p/ o modelo de concentração.
UPDATE public.medicines
SET dosage_unit  = 'mg/ml',
    drops_per_ml = COALESCE(drops_per_ml, 20)
WHERE dosage_unit IN ('ml','gotas');
```
> Idempotente: rodar 2× = no-op. `dosage_per_pill` deixado como está (NULL p/ legados; massa ativa só exibida quando preenchida). `'ui'` líquido legado (raríssimo) **não** convertido automaticamente (ambíguo vs. sólido `ui`); revisão manual — documentado, não silencioso.

### A.4 — RPC `consume_stock_fifo` (sobrecarga líquida — mantém assinatura)
Ver `contracts/consume_stock_fifo.md` para a assinatura/contrato. Corpo:

```sql
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,         -- dose na unidade de tomada (líquidos); unidades (sólidos)
  p_medicine_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_liquid BOOLEAN;
  v_dosage_unit TEXT;
  v_drops_per_ml INTEGER;
  v_intake_unit TEXT;
  v_remaining NUMERIC;
  v_total_available NUMERIC;
  v_total_consumed NUMERIC := 0;
  v_rows_consumed INTEGER := 0;
  v_to_consume NUMERIC;
  v_stock_row public.stock%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id é obrigatório'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser > 0'; END IF;
  IF p_medicine_log_id IS NULL THEN RAISE EXCEPTION 'medicine_log_id é obrigatório'; END IF;

  SELECT (dosage_unit LIKE '%/ml'), dosage_unit, COALESCE(drops_per_ml, 20)
  INTO v_is_liquid, v_dosage_unit, v_drops_per_ml
  FROM public.medicines WHERE id = p_medicine_id;

  IF COALESCE(v_is_liquid, FALSE) THEN
    SELECT p.intake_unit INTO v_intake_unit
    FROM public.protocols p
    JOIN public.medicine_logs l ON l.protocol_id = p.id
    WHERE l.id = p_medicine_log_id;

    IF v_intake_unit = 'gotas' THEN
      v_remaining := ROUND(p_quantity / v_drops_per_ml, 2);
    ELSE
      v_remaining := ROUND(p_quantity, 2);  -- 'ml', 'UI' (v1 escala direta), fallback
    END IF;
  ELSE
    v_remaining := p_quantity;   -- sólidos: linear inteiro
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_available
  FROM public.stock
  WHERE medicine_id = p_medicine_id AND user_id = p_user_id AND quantity > 0;

  IF v_total_available < v_remaining THEN
    RAISE EXCEPTION 'Estoque insuficiente (restam %, solicitado %)', v_total_available, v_remaining;
  END IF;

  FOR v_stock_row IN
    SELECT * FROM public.stock
    WHERE medicine_id = p_medicine_id AND user_id = p_user_id AND quantity > 0
    ORDER BY expiration_date ASC NULLS LAST, purchase_date ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_to_consume := LEAST(v_stock_row.quantity, v_remaining);
    UPDATE public.stock SET quantity = quantity - v_to_consume WHERE id = v_stock_row.id;
    INSERT INTO public.stock_consumptions
      (user_id, medicine_log_id, medicine_id, stock_id, quantity_consumed)
    VALUES (p_user_id, p_medicine_log_id, p_medicine_id, v_stock_row.id, v_to_consume);
    v_remaining := v_remaining - v_to_consume;
    v_total_consumed := v_total_consumed + v_to_consume;
    v_rows_consumed := v_rows_consumed + 1;
  END LOOP;

  IF v_remaining > 0 THEN RAISE EXCEPTION 'Falha de consistência: FIFO incompleto'; END IF;

  RETURN jsonb_build_object(
    'medicine_log_id', p_medicine_log_id,
    'medicine_id', p_medicine_id,
    'is_liquid', v_is_liquid,
    'quantity_requested', p_quantity,
    'quantity_consumed', v_total_consumed,
    'consumption_rows_created', v_rows_consumed
  );
END;
$$;

-- SECURITY DEFINER hardening (CLAUDE.md)
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) TO authenticated, service_role;
```
> `restore_stock_for_log` (estorno) **não** muda: lê `stock_consumptions.quantity_consumed` (decimal) e devolve o mesmo valor. Coberto por teste de regressão.

---

## Fase B — Core/Validações/Serviços

### B.1 — `medicineSchema.js`
```javascript
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ui', 'un', 'mg/ml', 'ui/ml']
// NOTA: 'ml'/'gotas' saem da lista de concentração (viram intake_unit). CHECK SQL mantém legados até a migração.

const medicineSchema = z.object({
  // ...campos existentes...
  dosage_unit: z.enum(DOSAGE_UNITS),
  dosage_per_pill: z.number().positive('Concentração deve ser maior que zero').nullable().optional(),
  drops_per_ml: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.dosage_unit?.endsWith('/ml') && data.drops_per_ml == null) {
    ctx.addIssue({ code: 'custom', path: ['drops_per_ml'],
      message: 'Gotas por ml é obrigatório para medicamentos líquidos (padrão 20).' })
  }
})
```
> Concentração (`dosage_per_pill`) **não** exigida: legados migrados têm `NULL` e precisam continuar salváveis.

### B.2 — `protocolSchema.js`
```javascript
export const INTAKE_UNITS = ['gotas', 'ml', 'UI']

const protocolSchema = z.object({
  // ...campos existentes (dosage_per_intake permanece .positive().max(1000))...
  intake_unit: z.enum(INTAKE_UNITS).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data._medicineIsLiquid === true && !data.intake_unit) {
    ctx.addIssue({ code: 'custom', path: ['intake_unit'],
      message: 'Defina a unidade de tomada (gotas, ml ou UI) para medicamentos líquidos.' })
  }
})
```
> `_medicineIsLiquid` = campo de contexto opcional injetado pelo form (derivado de `dosage_unit LIKE '%/ml'`), não persistido. Alternativa: validar no service após buscar o medicamento (decidir no PR e documentar).

### B.3 — Revisão do teto R-022 (cap-100 → cap-1000)
Elevar `.max(100)` → `.max(1000)` (cobre `gotas`) com mensagem atualizada em:
- `packages/core/src/schemas/logSchema.js:36` (`quantity_taken`)
- `packages/core/src/schemas/adherencePatternSchema.js:13`
- `packages/core/src/schemas/costAnalysisSchema.js:79`
- `packages/core/src/schemas/reminderOptimizerSchema.js:19`
> Documentar a revisão de R-022: cap Zod = guarda anti-erro de digitação; integridade física = `CHECK (quantity >= 0)` + FIFO (Fase A). Manter `.positive()`.

### B.4 — Desmembramento via `create_purchase_with_stock` (`stockService.js` web + mobile)
Ver `contracts/create_purchase_with_stock.md`.
```javascript
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
> Cada chamada = 1 `purchase` + 1 lote `stock` (`original_quantity = quantity = volumePerBottle`). FIFO opera frasco a frasco. Sólidos = 1 chamada (caminho atual). `round2`/`round4` = `Number(x.toFixed(n))` locais.

### B.5 — `formatDose` — extensão de `doseUnit.js` (NÃO arquivo novo)
Ver `contracts/formatDose.md`.
```javascript
// Acrescentar em packages/core/src/utils/doseUnit.js
export function formatDose(value, unit) {
  if (value === undefined || value === null) return ''
  const v = formatNumberPtBR(value)
  if (unit === 'ml') return `${v} ml`
  if (unit === 'gotas') return `${v} ${Number(value) === 1 ? 'gota' : 'gotas'}`
  if (unit === 'UI') return `${v} UI`
  return `${v} ${unit || ''}`.trim()
}
```
> Reusa `formatNumberPtBR` (evita `.replace('.',',')` ingênuo que quebra milhares). `pluralizeDoseUnit` ("unidade(s)") não serve p/ gotas → singular/plural inline. `apps/web/src/schemas/*` faz `export *` do core, então a mudança vive **só na definição** (`packages/core/...`), sem tocar callers (AP-199).

---

## Fase C — UI/UX + Telegram

### C.1 — MedicineForm + Wizard (web/mobile)
- Dropdown de concentração: `['mg','mcg','g','ui','un','mg/ml','ui/ml']`. Mesma lista no **passo de medicamento do wizard**.
- `dosage_unit.endsWith('/ml')` ⇒ badge `💧 Apresentação Líquida` + campo `Gotas por ml` (mapeia `drops_per_ml`, default 20).
- Label do campo de concentração: **"Concentração"** (mapeia `dosage_per_pill`; oculta "Dose por comprimido").

### C.2 — ProtocolForm (web/mobile)
- Medicamento `/ml` ⇒ select `intake_unit = ['gotas','ml','UI']` + hint *"💧 Você está configurando um medicamento líquido. Defina a dose na unidade de tomada (gotas ou ml)."*. Sólido: select + hint ocultos (`intake_unit` = `NULL`).

### C.3 — StockForm (web; mobile a confirmar em C1)
- Líquido: cabeçalho `💧 Inventário de Líquidos`, inputs `[N] frascos` / `[V] ml cada`, campo **"Preço Total da Compra (R$)"**.
- Submit despacha `{ medicineId, numBottles, volumePerBottle, totalPrice, purchaseDate, expirationDate, ... }` → `stockService.createPurchase` (B.4).

### C.4 — Banner de fim de frasco (`StockAlertInline.jsx`)
```javascript
// Converte a dose da próxima ocorrência p/ ml ANTES de comparar com o saldo (ml).
function nextDoseMl(expectedDose, intakeUnit, dropsPerMl = 20) {
  if (intakeUnit === 'gotas') return Number((expectedDose / dropsPerMl).toFixed(2))
  return expectedDose // 'ml' e 'UI' (v1) = escala direta
}
const doseMl = nextDoseMl(instance.expected_dose, protocol.intake_unit, medicine.drops_per_ml)
if (activeStockQuantity < doseMl) { /* aviso "frasco no fim" */ }
```
> Só p/ líquidos (`dosage_unit LIKE '%/ml'`). Reusa `formatNumberPtBR` p/ exibir o saldo ("1,5 ml").

### C.5 — Telegram (`api/notify.js` + `server/bot/callbacks/doseActions.js`)
- Lembrete: `formatDose(expected_dose, intake_unit)` → *"🔔 Hora do seu Ibuprofeno! Tomar 2,5 ml agora."*
- Callback `✅ Tomei`: persiste o log + `consume_stock_fifo({ p_quantity: expected_dose, ... })` (RPC converte gotas→ml). Estoque zerado (erro RPC) → resposta best-effort, sem travar (R-245/246). `doseActions.js` já chama a RPC em `:96`.

---

## Target Files

| Path | Fase | Purpose | Evidence |
|------|------|---------|----------|
| `docs/migrations/20260602_liquid_meds_db.sql` | A | [NEW] enum + colunas + check + migração + RPC + grants. | SQL/migrations |
| `packages/core/src/schemas/medicineSchema.js` | B | enum + `drops_per_ml`/`dosage_per_pill` + refine. | verificado |
| `packages/core/src/schemas/protocolSchema.js` | B | `intake_unit` + cross-validação. | verificado |
| `packages/core/src/schemas/logSchema.js` | B | cap-100 → 1000 em `quantity_taken`. | `:36` |
| `packages/core/src/schemas/adherencePatternSchema.js` | B | cap-100 → 1000. | `:13` |
| `packages/core/src/schemas/costAnalysisSchema.js` | B | cap-100 → 1000. | `:79` |
| `packages/core/src/schemas/reminderOptimizerSchema.js` | B | cap-100 → 1000. | `:19` |
| `packages/core/src/utils/doseUnit.js` | B | adicionar `formatDose` (estende). | verificado |
| `apps/web/src/features/stock/services/stockService.js` | B | desmembramento via N× RPC. | `:24` |
| `apps/mobile/src/features/stock/services/stockService.js` | B | mesmo, mobile (JS). | verificado |
| `apps/web/src/features/medications/components/MedicineForm.jsx` (+ `sections/MedicineFormDosageInfo.jsx`) | C | dropdown + badge + `drops_per_ml`. | verificado |
| `apps/mobile/src/features/medications/screens/MedicineFormScreen.jsx` | C | idem mobile (JS). | verificado |
| `apps/web/src/features/protocols/components/sections/ProtocolFormDosesSection.jsx` | C | select `intake_unit` condicional. | verificado |
| `apps/mobile/src/features/treatments/components/ProtocolFormBody.jsx` | C | idem mobile. | verificado |
| `apps/web/src/features/stock/components/StockForm.jsx` (+ `sections/StockFormPurchaseDetails.jsx`) | C | inputs frascos/ml + preço total. | verificado |
| `apps/web/src/features/dashboard/components/StockAlertInline.jsx` | C | banner com conversão de unidade. | verificado |
| `server/bot/callbacks/doseActions.js` | C | callback `✅ Tomei` + `formatDose`. | `:96` |
| `api/notify.js` | C | lembrete com `formatDose`. | verificado |
| (mobile stock UI) | C | a confirmar em C1. | — |

---

## Risks

- **Constraint `dosage_unit` com nome desconhecido**: verificar `pg_constraint` antes de `DROP CONSTRAINT`. Se `dosage_unit` for `text` livre, pular A.1 (só atualizar o enum do core na Fase B).
- **Locks FIFO concorrentes**: `FOR UPDATE` por linha + índice `(medicine_id, user_id)`; tomadas simultâneas serializam por lote.
- **Migração em prod**: janela; idempotente. Validar `SELECT count(*) FROM medicines WHERE dosage_unit IN ('ml','gotas')` → 0.
- **Cross-validação líquido↔intake_unit**: se o `protocolSchema` não tiver o medicamento no payload, validar no `protocolService` após buscar `medicines.dosage_unit`. Decidir no PR.
- **Esquemas duplicados core↔web**: aplicar na **definição** (core), não no caller (AP-199).
- **Estoque mobile sem componente espelho**: confirmar o fluxo real (screen/hook) em C1; não assumir `StockForm` mobile.
- **Wizard**: confirmar se o passo de medicamento reusa `MedicineForm` (props de onboarding); senão, ajustar o passo do wizard também.
