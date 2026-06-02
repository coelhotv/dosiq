# Implementation Plan: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`  
**Spec**: `spec.md`  
**Legacy Sources**:
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`
- `docs/architecture/DOSE_INSTANCES.md`

---

## Technical Context

Este plano implementa a fundação de banco de dados do Supabase/PostgreSQL. Rastrearemos o estoque fluido de medicamentos líquidos diretamente na coluna `quantity` existente da tabela `stock`, que passará a representar o **volume contínuo em mililitros (`ml`)** para líquidos. 

A coluna `original_quantity` (que já existe na tabela `stock`) armazenará o volume original nominal do frasco no momento do cadastro. A interface utilizará a divisão matemática $\frac{quantity}{original\_quantity}$ para expor frações de frascos restantes de forma imediata e elegante, sem quebras no modelo legado.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| smart-data-design | ✅ | Uso de decimais exatos (`numeric`) em `stock.quantity` para evitar erros acumulados de arredondamento. |
| backwards-compatibility | ✅ | Nenhuma coluna física nova na tabela `stock`. Uso inteligente de `quantity` e `original_quantity` existentes. |
| single-source-of-truth | ✅ | `medicines.dosage_unit` define de forma implícita e automática se o medicamento é líquido. |

---

## Database Migrations (SQL)

### 1. Migração Estrutural de Tabelas
```sql
-- 1. Adiciona gotas por ml no cadastro de medicamentos
ALTER TABLE public.medicines
ADD COLUMN drops_per_ml INTEGER DEFAULT 20;

-- 2. Adiciona unidade da dose tomada no protocolo
ALTER TABLE public.protocols
ADD COLUMN intake_unit TEXT DEFAULT NULL;

-- 3. Adiciona check constraint para impedir underflow (estoque negativo) na tabela stock
ALTER TABLE public.stock
ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (quantity >= 0);
```

### 2. Stored Procedure FIFO `consume_stock_fifo` (Sobrecarga de Líquidos)
Reescrevemos a procedure transacional no Supabase. O parâmetro `p_quantity` representa a dose na unidade de tomada do protocolo (`intake_unit`). O banco de dados calcula a baixa física correspondente em `ml` e desconta da coluna `stock.quantity`:

```sql
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,
  p_medicine_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_is_liquid BOOLEAN;
  v_dosage_unit TEXT;
  v_drops_per_ml INTEGER;
  
  v_remaining NUMERIC;
  v_volume_to_consume_ml NUMERIC;
  
  v_total_available NUMERIC;
  v_total_consumed NUMERIC := 0;
  v_rows_consumed INTEGER := 0;
  v_to_consume NUMERIC;
  v_stock_row public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório para chamadas server-side';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade para consumo deve ser maior que zero';
  END IF;

  IF p_medicine_log_id IS NULL THEN
    RAISE EXCEPTION 'medicine_log_id é obrigatório';
  END IF;

  -- 1. Carrega parâmetros físicos do medicamento
  SELECT 
    (dosage_unit LIKE '%/ml'), 
    dosage_unit, 
    COALESCE(drops_per_ml, 20)
  INTO v_is_liquid, v_dosage_unit, v_drops_per_ml
  FROM public.medicines
  WHERE id = p_medicine_id;

  -- 2. Determina a quantidade física a deduzir de stock.quantity
  IF COALESCE(v_is_liquid, FALSE) = TRUE THEN
    -- Obter a unidade de tomada a partir do log ou protocolo
    DECLARE
      v_intake_unit TEXT;
    BEGIN
      SELECT p.intake_unit INTO v_intake_unit
      FROM public.protocols p
      JOIN public.medicine_logs l ON l.protocol_id = p.id
      WHERE l.id = p_medicine_log_id;

      -- Converte tomada do paciente para volume físico (ml)
      IF v_intake_unit = 'ml' THEN
        v_volume_to_consume_ml := p_quantity;
      ELSIF v_intake_unit = 'gotas' THEN
        v_volume_to_consume_ml := ROUND(p_quantity / v_drops_per_ml, 2);
      ELSIF v_intake_unit = 'UI' THEN
        -- Futuro: insulina. Na v1 assume escala de ml ou UI direta.
        v_volume_to_consume_ml := p_quantity;
      ELSE
        v_volume_to_consume_ml := p_quantity; -- Fallback seguro
      END IF;
    END;
    
    v_remaining := v_volume_to_consume_ml;
  ELSE
    -- Comportamento clássico para sólidos (linear cp/unidades)
    v_remaining := p_quantity;
  END IF;

  -- 3. Verifica saldo em estoque (coluna quantity)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_available
  FROM public.stock
  WHERE medicine_id = p_medicine_id
    AND user_id = v_user_id
    AND quantity > 0;

  IF v_total_available < v_remaining THEN
    RAISE EXCEPTION 'Estoque insuficiente (Restam %, solicitado %)', v_total_available, v_remaining;
  END IF;

  -- 4. Loop FIFO por validade consumindo quantity
  FOR v_stock_row IN
    SELECT *
    FROM public.stock
    WHERE medicine_id = p_medicine_id
      AND user_id = v_user_id
      AND quantity > 0
    ORDER BY expiration_date ASC NULLS LAST, purchase_date ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_consume := LEAST(v_stock_row.quantity, v_remaining);

    UPDATE public.stock
    SET quantity = quantity - v_to_consume
    WHERE id = v_stock_row.id;

    INSERT INTO public.stock_consumptions (
      user_id,
      medicine_log_id,
      medicine_id,
      stock_id,
      quantity_consumed
    )
    VALUES (
      v_user_id,
      p_medicine_log_id,
      p_medicine_id,
      v_stock_row.id,
      v_to_consume
    );

    v_remaining := v_remaining - v_to_consume;
    v_total_consumed := v_total_consumed + v_to_consume;
    v_rows_consumed := v_rows_consumed + 1;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Falha de consistência: consumo FIFO incompleto';
  END IF;

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
```

---

## Target Files

| Path | Purpose | Source Evidence |
|------|---------|-----------------|
| `docs/migrations/XXXXXXXX_liquid_meds_db.sql` | [NEW] Script consolidado de migração física de colunas e triggers no Supabase. | SQL Editor |

---

## Risks

- **Locks Concorrentes por FIFO no Supabase**:
  - *Descrição*: Tomadas simultâneas podem bloquear registros de estoque gerando lentidão.
  - *Mitigação*: Uso de índices indexados por `user_id` e `expiration_date` com locking estrito `FOR UPDATE` escopado por ID da linha no loop FIFO.
