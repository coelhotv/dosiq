# Implementation Plan: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`
**Spec**: `spec.md`
**Revised**: 2026-06-02
**Legacy Sources**:
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`
- `docs/architecture/DOSE_INSTANCES.md`

---

## Technical Context

Fundação de banco Supabase/PostgreSQL. Líquido é **derivado da unidade de concentração** (`dosage_unit LIKE '%/ml'`), nunca de um booleano. O estoque fluido vive na coluna existente `stock.quantity` (`numeric`), que para líquidos representa **ml restantes**; `original_quantity` guarda o volume nominal do frasco. A UI deriva a fração de frasco por `quantity / original_quantity`.

**Schema real verificado (prod):** `stock` tem `quantity numeric`, `original_quantity numeric`, `unit_price numeric(12,4)`, `purchase_id uuid` (FK → `purchases`), `entry_type text`. As colunas de dose (`medicine_logs.quantity_taken`, `dose_instances.expected_dose`, `protocols.dosage_per_intake`) **já são `numeric`** — frações cabem sem migração de coluna de dose. `consume_stock_fifo` **já existe** com a assinatura `(p_user_id, p_medicine_id, p_quantity, p_medicine_log_id)` (callers: `server/services/medicineLogService.js`, `server/bot/callbacks/doseActions.js`).

> **Nota de precisão:** `stock.quantity`/`original_quantity` são `numeric` **sem escala fixa** (não `numeric(10,2)`). A precisão de 2 casas é garantida por `ROUND(..., 2)` na RPC e na validação Zod (spec 023), não pela coluna. Não alteramos o tipo da coluna (risco em tabela viva).

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| smart-data-design | ✅ | `numeric` + `ROUND(.,2)` evitam erro de ponto flutuante; sem coluna redundante. |
| backwards-compatibility | ✅ | Nenhuma coluna física nova em `stock`; reuso de `quantity`/`original_quantity`. Migração de dados idempotente e reversível conceitualmente. |
| single-source-of-truth | ✅ | `medicines.dosage_unit` (terminando em `/ml`) define líquido implicitamente. |

---

## Database Migrations (SQL)

Arquivo: `docs/migrations/20260602_liquid_meds_db.sql`. Ordem: (1) enum, (2) colunas + check, (3) migração de dados, (4) RPC.

### 1. Estender o enum de unidades de concentração
O `dosage_unit` é validado por `CHECK`/`text` (não um tipo enum nativo Postgres). Confirmar via `information_schema`/`pg_constraint` antes; se existir uma `CHECK (dosage_unit IN (...))`, recriá-la incluindo os novos valores:

```sql
-- Se houver constraint de domínio em dosage_unit, recriar incluindo mg/ml e ui/ml.
-- (Verificar o nome real via pg_constraint antes de aplicar.)
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_dosage_unit_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_dosage_unit_check
  CHECK (dosage_unit IN ('mg','mcg','g','ml','ui','un','gotas','mg/ml','ui/ml'));
```
> `'ml'`/`'gotas'` permanecem no CHECK por retrocompat até a migração de dados zerar o uso; o **form de cadastro** (spec 024) deixa de oferecê-los como concentração.

### 2. Colunas estruturais + check de saldo
```sql
ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS drops_per_ml INTEGER DEFAULT 20;

ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS intake_unit TEXT DEFAULT NULL;

ALTER TABLE public.stock
  ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (quantity >= 0);
```
> Colunas adicionadas a tabelas existentes **não** exigem novos GRANTs (a regra do CLAUDE.md vale para `CREATE TABLE`). RLS já vigente nas tabelas é preservada.

### 3. Migração de dados — líquidos legados (`ml`/`gotas` → `mg/ml`)
```sql
-- 3a. Move a unidade de tomada antiga para os protocolos do medicamento líquido legado.
UPDATE public.protocols p
SET intake_unit = m.dosage_unit         -- 'ml' ou 'gotas'
FROM public.medicines m
WHERE p.medicine_id = m.id
  AND m.dosage_unit IN ('ml','gotas')
  AND p.intake_unit IS NULL;

-- 3b. Converte a unidade do medicamento para o modelo de concentração.
UPDATE public.medicines
SET dosage_unit  = 'mg/ml',
    drops_per_ml = COALESCE(drops_per_ml, 20)
WHERE dosage_unit IN ('ml','gotas');
```
> Idempotente: rodar 2× é no-op (já não há `ml`/`gotas`; `intake_unit` já preenchido). `dosage_per_pill` (concentração) é **deixado como está** — desconhecido para legados, fica `NULL`; a massa ativa só passa a ser exibida quando o usuário editar e informar a concentração. Decremento/adesão independem disso.
> `'ui'` líquido legado (raríssimo) **não** é convertido automaticamente (ambíguo vs. sólido `ui`); fica para revisão manual — documentado, não silencioso.

### 4. RPC `consume_stock_fifo` (sobrecarga líquida — mantém assinatura)
```sql
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,         -- dose na unidade de tomada (intake_unit) para líquidos; unidades para sólidos
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

  -- 1. Parâmetros físicos do medicamento (líquido = unidade termina em /ml).
  SELECT (dosage_unit LIKE '%/ml'), dosage_unit, COALESCE(drops_per_ml, 20)
  INTO v_is_liquid, v_dosage_unit, v_drops_per_ml
  FROM public.medicines WHERE id = p_medicine_id;

  -- 2. Volume físico a deduzir.
  IF COALESCE(v_is_liquid, FALSE) THEN
    SELECT p.intake_unit INTO v_intake_unit
    FROM public.protocols p
    JOIN public.medicine_logs l ON l.protocol_id = p.id
    WHERE l.id = p_medicine_log_id;

    IF v_intake_unit = 'gotas' THEN
      v_remaining := ROUND(p_quantity / v_drops_per_ml, 2);
    ELSE
      -- 'ml', 'UI' (v1: escala direta) e fallback seguro
      v_remaining := ROUND(p_quantity, 2);
    END IF;
  ELSE
    v_remaining := p_quantity;   -- sólidos: linear inteiro
  END IF;

  -- 3. Saldo disponível.
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_available
  FROM public.stock
  WHERE medicine_id = p_medicine_id AND user_id = p_user_id AND quantity > 0;

  IF v_total_available < v_remaining THEN
    RAISE EXCEPTION 'Estoque insuficiente (restam %, solicitado %)', v_total_available, v_remaining;
  END IF;

  -- 4. Loop FIFO por validade.
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

-- SECURITY DEFINER hardening (CLAUDE.md): bloquear PUBLIC/anon, search_path vazio (já no header).
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) TO authenticated, service_role;
```
> `restore_stock_for_log` (estorno em exclusão de log) **não precisa de mudança**: lê `stock_consumptions.quantity_consumed` (já `numeric`/decimal) e devolve o mesmo valor ao lote. Coberto por teste de regressão (T-validação).

---

## Target Files

| Path | Purpose | Source Evidence |
|------|---------|-----------------|
| `docs/migrations/20260602_liquid_meds_db.sql` | [NEW] enum + colunas + check + migração de dados + RPC + grants. | SQL/migrations |

---

## Risks

- **Constraint de `dosage_unit` com nome desconhecido**: verificar `pg_constraint`/`information_schema` antes de `DROP CONSTRAINT`. Se `dosage_unit` for `text` livre (sem CHECK), pular o passo 1 (só atualizar o enum do core na spec 023).
- **Locks FIFO concorrentes**: `FOR UPDATE` escopado por linha + índice por `(medicine_id, user_id)`; tomadas simultâneas serializam por lote, não global.
- **Migração em prod**: rodar em janela; idempotente. Validar contagem antes/depois (`SELECT count(*) FROM medicines WHERE dosage_unit IN ('ml','gotas')` deve ir a 0).
