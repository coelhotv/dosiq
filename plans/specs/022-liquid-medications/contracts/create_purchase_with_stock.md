# Contract: `create_purchase_with_stock` (RPC PostgreSQL)

**Tipo**: SQL function existente · **Status**: reusada sem alteração (consumo novo)

## Assinatura (existente)
```sql
create_purchase_with_stock(
  p_medicine_id UUID,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_purchase_date DATE,
  p_expiration_date DATE,
  p_pharmacy TEXT,
  p_laboratory TEXT,
  p_notes TEXT
)
```
Cria 1 `purchase` + 1 lote `stock` (`original_quantity = quantity = p_quantity`, com `purchase_id`).

## Consumo novo (líquidos) — `stockService.createPurchase`
`N frascos × V ml × preço total P` ⇒ **N chamadas**, uma por frasco:
- `p_quantity = V` (volume nominal do frasco em ml)
- `p_unit_price = ROUND(price_per_bottle / V, 4)`, onde `price_per_bottle = ROUND(P / N, 2)`
- **Último frasco**: `unit_price` compensado (`ROUND(P - price_per_bottle*(N-1), 2) / V`) p/ fechar o total exato.

**Regra dura**: nunca `supabase.from('stock').insert(...)` direto. Sempre via esta RPC (modelo `purchases` v4.0.0 intacto).

## Caller existente (referência)
`server/bot/commands/adicionar_estoque.js:128`

## Compatibilidade
Sólidos: 1 chamada (caminho atual). Líquidos: N chamadas. **Não-breaking** — só novo padrão de uso.
