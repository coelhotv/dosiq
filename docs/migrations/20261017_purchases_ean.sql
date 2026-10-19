-- 20261017_purchases_ean.sql — spec 066 Slice D2 (M1b) · "Ler a caixa" no registro de compra
-- A compra passa a guardar o código de barras (EAN-13) da caixa lida.
--
-- MUDANÇAS (uma transação):
--   1. `purchases.ean text NULL` + CHECK `^[0-9]{13}$` (NULL = compra digitada / antiga — sem backfill).
--   2. `create_purchase_with_stock` ganha `p_ean text DEFAULT NULL` no FIM. DROP + CREATE (não CREATE OR
--      REPLACE: assinatura nova) para NÃO deixar overload (AP-209/AP-227). Corpo idêntico ao vigente
--      (pg_get_functiondef 2026-10-17) exceto a coluna `ean` no INSERT de `purchases`.
--   3. Grants iguais aos vigentes (proacl 2026-10-17: postgres, authenticated, service_role; sem anon/PUBLIC).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                     |
-- |----------------------------------------|---------------------------------------------------------|
-- | Cliente antigo sem `p_ean` (web, bot,  | Chamada por nome; DEFAULT NULL → grava NULL. Provado por |
-- |   binários 0.33.x)                     | curl sem `p_ean` → 200.                                  |
-- | `p_ean = ''`                           | NULLIF(TRIM) → NULL; não viola o CHECK.                  |
-- | `p_ean` com 12 dígitos / letras        | CHECK rejeita (23514) e a compra inteira volta (txn).    |
-- | Linhas existentes                      | NULL passa no CHECK; sem backfill (não vieram de caixa). |
-- | Overload residual                      | DROP explícito da assinatura de 9 args antes do CREATE.  |
-- | Grants                                 | DROP apaga ACL → REVOKE PUBLIC + GRANT explícitos abaixo.|
-- | Cache do PostgREST                     | NOTIFY pgrst, 'reload schema' no fim.                    |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- REVERSÃO (comentada): DROP da assinatura de 10 args, recriar a de 9 (corpo sem `ean`), mesmos grants,
--   `ALTER TABLE public.purchases DROP COLUMN ean;`.

BEGIN;

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS ean text NULL;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_ean_check CHECK (ean IS NULL OR ean ~ '^[0-9]{13}$');

DROP FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text, text);

CREATE FUNCTION public.create_purchase_with_stock(
  p_medicine_id uuid,
  p_quantity numeric,
  p_unit_price numeric DEFAULT 0,
  p_purchase_date date DEFAULT CURRENT_DATE,
  p_expiration_date date DEFAULT NULL::date,
  p_pharmacy text DEFAULT NULL::text,
  p_laboratory text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_injection_container text DEFAULT NULL::text,
  p_ean text DEFAULT NULL::text
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
    injection_container,
    ean
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
    p_injection_container,
    NULLIF(TRIM(p_ean), '')
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

REVOKE ALL ON FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
