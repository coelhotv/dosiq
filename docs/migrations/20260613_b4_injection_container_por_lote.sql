-- 012 Fase B4 (FR-030 / ADR-068) — injection_container migra medicine-level → LOTE.
--
-- Contexto: a B2 cravou injection_container em `medicines` (valor único, 1ª compra).
-- Errado: a apresentação é atributo do LOTE comprado (igual ao volume) — o paciente
-- pode comprar canetas e depois migrar p/ refis no mesmo tratamento (2 lotes, containers
-- diferentes). Decisão PO 2026-06-13: fonte única = lote (stock + purchases); DROP da
-- coluna em medicines (sem default duplicado). Rendimento (FR-020) calculado por lote.
--
-- Sincronizado com INJECTION_CONTAINERS (packages/core/src/schemas/medicineSchema.js)
-- e stockCreateSchema (packages/core/src/schemas/stockSchema.js) — R-271 (CHECK↔Zod exato).
--
-- ⚠️ MUTAÇÃO DE SCHEMA EM PROD (move valores + DROP COLUMN + ALTER RPC). Aplicar SÓ com
-- autorização explícita do PO. Ordem importa: migrar valores ANTES do DROP.
-- Idempotente onde possível (IF EXISTS / IF NOT EXISTS).

BEGIN;

-- ── 1. Coluna nos lotes (stock = FIFO ativo · purchases = histórico) ──
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS injection_container text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS injection_container text;

ALTER TABLE public.stock DROP CONSTRAINT IF EXISTS stock_injection_container_check;
ALTER TABLE public.stock ADD CONSTRAINT stock_injection_container_check
  CHECK (injection_container IS NULL OR injection_container = ANY (
    ARRAY['caneta'::text, 'refil'::text, 'ampola'::text, 'frasco_ampola'::text, 'seringa_preenchida'::text]));

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_injection_container_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_injection_container_check
  CHECK (injection_container IS NULL OR injection_container = ANY (
    ARRAY['caneta'::text, 'refil'::text, 'ampola'::text, 'frasco_ampola'::text, 'seringa_preenchida'::text]));

-- ── 2. Migra os valores existentes (medicine-level → todos os lotes desse medicine) ──
-- 3 medicines com valor não-nulo (verificado 2026-06-13). Copia p/ stock e purchases
-- correspondentes (mesmo medicine_id + user_id). Lotes legados sem purchase herdam
-- o valor do medicine — apresentação assumida igual à 1ª compra capturada.
UPDATE public.stock s
SET injection_container = m.injection_container
FROM public.medicines m
WHERE s.medicine_id = m.id
  AND s.user_id = m.user_id
  AND m.injection_container IS NOT NULL
  AND s.injection_container IS NULL;

UPDATE public.purchases p
SET injection_container = m.injection_container
FROM public.medicines m
WHERE p.medicine_id = m.id
  AND p.user_id = m.user_id
  AND m.injection_container IS NOT NULL
  AND p.injection_container IS NULL;

-- ── 3. RPC create_purchase_with_stock: +p_injection_container (append no fim — AP-221) ──
-- Grava nas DUAS tabelas no mesmo INSERT atômico. Mantém SECURITY DEFINER + search_path.
-- ⚠️ AP-221: adicionar um parâmetro muda a ASSINATURA → CREATE OR REPLACE criaria um
-- OVERLOAD (a 8-arg antiga sobreviveria, causando ambiguidade PostgREST PGRST203).
-- Dropa a 8-arg explicitamente ANTES de criar a 9-arg.
DROP FUNCTION IF EXISTS public.create_purchase_with_stock(
  uuid, numeric, numeric, date, date, text, text, text
);

CREATE OR REPLACE FUNCTION public.create_purchase_with_stock(
  p_medicine_id uuid,
  p_quantity numeric,
  p_unit_price numeric DEFAULT 0,
  p_purchase_date date DEFAULT CURRENT_DATE,
  p_expiration_date date DEFAULT NULL::date,
  p_pharmacy text DEFAULT NULL::text,
  p_laboratory text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_injection_container text DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_purchase public.purchases%ROWTYPE;
  v_stock public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade da compra deve ser maior que zero';
  END IF;

  IF COALESCE(p_unit_price, 0) < 0 THEN
    RAISE EXCEPTION 'Preço unitário não pode ser negativo';
  END IF;

  IF p_expiration_date IS NOT NULL AND p_expiration_date <= p_purchase_date THEN
    RAISE EXCEPTION 'Data de validade deve ser posterior à data da compra';
  END IF;

  IF p_injection_container IS NOT NULL AND p_injection_container <> ALL (
    ARRAY['caneta', 'refil', 'ampola', 'frasco_ampola', 'seringa_preenchida']
  ) THEN
    RAISE EXCEPTION 'Apresentação de injetável inválida: %', p_injection_container;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medicines
    WHERE id = p_medicine_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Medicamento não encontrado para o usuário autenticado';
  END IF;

  INSERT INTO public.purchases (
    user_id,
    medicine_id,
    quantity_bought,
    unit_price,
    purchase_date,
    expiration_date,
    pharmacy,
    laboratory,
    notes,
    injection_container
  )
  VALUES (
    v_user_id,
    p_medicine_id,
    p_quantity,
    COALESCE(p_unit_price, 0),
    COALESCE(p_purchase_date, CURRENT_DATE),
    p_expiration_date,
    NULLIF(TRIM(p_pharmacy), ''),
    NULLIF(TRIM(p_laboratory), ''),
    NULLIF(TRIM(p_notes), ''),
    p_injection_container
  )
  RETURNING * INTO v_purchase;

  INSERT INTO public.stock (
    medicine_id,
    quantity,
    purchase_date,
    expiration_date,
    unit_price,
    notes,
    user_id,
    purchase_id,
    original_quantity,
    entry_type,
    injection_container
  )
  VALUES (
    p_medicine_id,
    p_quantity,
    v_purchase.purchase_date,
    v_purchase.expiration_date,
    v_purchase.unit_price,
    v_purchase.notes,
    v_user_id,
    v_purchase.id,
    p_quantity,
    'purchase',
    p_injection_container
  )
  RETURNING * INTO v_stock;

  RETURN jsonb_build_object(
    'purchase', to_jsonb(v_purchase),
    'stock', to_jsonb(v_stock)
  );
END;
$function$;

-- ── 4. DROP da coluna medicine-level (fonte única agora é o lote) ──
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_injection_container_check;
ALTER TABLE public.medicines DROP COLUMN IF EXISTS injection_container;

COMMIT;

-- Verificação pós-migração (rodar separado após COMMIT):
--   SELECT count(*) FILTER (WHERE injection_container IS NOT NULL) AS stock_c FROM public.stock;
--   SELECT count(*) FILTER (WHERE injection_container IS NOT NULL) AS purch_c FROM public.purchases;
--   -- esperado: >= 3 lotes/compras com container (os 3 medicines migrados e seus lotes)
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='medicines' AND column_name='injection_container'; -- esperado: 0 linhas
