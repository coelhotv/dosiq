# Contract: `consume_stock_fifo` (RPC PostgreSQL)

**Tipo**: SQL function (SECURITY DEFINER) · **Status**: 4-arg sobrecarregada p/ líquido; overload 3-arg **REMOVIDO** (D1)

## Assinatura (única após Fase A)
```sql
consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,      -- dose na unidade de tomada (líquidos); unidades (sólidos)
  p_medicine_log_id UUID
) RETURNS JSONB
```
> **Breaking interno (D1):** o overload legacy 3-arg `(p_medicine_id, p_quantity, p_medicine_log_id)` (que derivava user via `auth.uid()`) foi **DROPADO**. Único caller (`conversational.js`) migrado p/ 4-arg. Sem assinatura nova exposta a clientes além da 4-arg já existente.

## Comportamento
- **Líquido** (`dosage_unit LIKE '%/ml'`): converte `p_quantity` p/ ml via `intake_unit` + `units_per_ml` (`gotas` → `ROUND(p_quantity/units_per_ml, 2)`; `ml`/`UI` → escala direta) e deduz por FIFO de `stock.quantity`.
- **Sólido**: caminho linear inteiro (subtrai `p_quantity`).
- FIFO por `purchase_date ASC, created_at ASC, id ASC`, `FOR UPDATE` (D2: mantém ordem atual, sem FEFO).
- Filtra `entry_type != 'legacy_unrecoverable'` (G2) na disponibilidade e no loop.
- Guard de posse `medicine_logs` (log↔user↔medicine) antes de consumir (G3).
- `SET search_path = ''` + refs `public.` qualificadas (hardening).
- Grava `stock_consumptions.quantity_consumed` por lote.
- `RAISE EXCEPTION` em saldo insuficiente / inputs nulos / log não encontrado.

## Retorno
```json
{ "medicine_log_id", "medicine_id", "is_liquid", "quantity_requested", "quantity_consumed", "consumption_rows_created" }
```

## Callers (todos 4-arg após Fase A)
- `server/services/medicineLogService.js:40`
- `server/bot/callbacks/doseActions.js:98`
- `server/bot/callbacks/conversational.js:319` (migrado 3-arg → 4-arg nesta fase)

## Compatibilidade
Sólidos seguem caminho idêntico ao atual (FIFO `purchase_date`). Líquido = ramo novo derivado da unidade. `restore_stock_for_log` não requer mudança (lê `quantity_consumed` decimal). Overload 3-arg removido — sem caller remanescente (grep server/apps/api/packages).
