# Contract: `consume_stock_fifo` (RPC PostgreSQL)

**Tipo**: SQL function (SECURITY DEFINER) · **Status**: existente, sobrecarregada (não-breaking)

## Assinatura (preservada)
```sql
consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,      -- dose na unidade de tomada (líquidos); unidades (sólidos)
  p_medicine_log_id UUID
) RETURNS JSONB
```

## Comportamento
- **Líquido** (`dosage_unit LIKE '%/ml'`): converte `p_quantity` p/ ml via `intake_unit` + `drops_per_ml` (`gotas` → `ROUND(p_quantity/drops_per_ml, 2)`; `ml`/`UI` → escala direta) e deduz por FIFO de `stock.quantity`.
- **Sólido**: caminho linear inteiro (subtrai `p_quantity`).
- FIFO por `expiration_date ASC NULLS LAST, purchase_date, created_at, id`, `FOR UPDATE`.
- Grava `stock_consumptions.quantity_consumed` por lote.
- `RAISE EXCEPTION` em saldo insuficiente / inputs nulos.

## Retorno
```json
{ "medicine_log_id", "medicine_id", "is_liquid", "quantity_requested", "quantity_consumed", "consumption_rows_created" }
```

## Callers (não quebrar)
- `server/services/medicineLogService.js`
- `server/bot/callbacks/doseActions.js:96`

## Compatibilidade
Assinatura inalterada ⇒ **não-breaking**. Sólidos seguem caminho idêntico ao atual. `restore_stock_for_log` não requer mudança (lê `quantity_consumed` decimal).
