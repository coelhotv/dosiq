-- 20260707_stock_tracking_preference.sql — F1 (épico 044 Dose-Only Mode, T001)
--
-- OBJETIVO
--   Interruptor GLOBAL de controle de estoque por usuário (spec 044 FR-002/FR-004/FR-009,
--   plan §Decisões de arquitetura 1-3):
--     1. `user_settings` ganha `stock_tracking_enabled` (default true) e `stock_paused_at`.
--     2. As 3 RPCs atômicas de dose (CON-026) leem a preferência DENTRO da transação e
--        curto-circuitam a camada de estoque (validação E movimentação) quando off.
--
--   Default `true` = FR-009: zero backfill, zero mudança de comportamento para os usuários
--   existentes. Quem não escolher nada continua com estoque ativo.
--
-- ASSINATURAS INALTERADAS
--   `CREATE OR REPLACE` reusa a assinatura EXATA de prod (dump `pg_get_functiondef` 2026-07-11).
--   Nenhum parâmetro novo → nenhum overload (AP-227) e nenhum caller para atualizar (AP-221).
--   A preferência entra por SELECT interno, não por argumento — o client não consegue divergir
--   do backend (edge multi-device do spec; classe AP-231).
--
-- PONTOS DE ESTOQUE (dump de prod — únicos toques nas 3 RPCs):
--   register_dose_atomic   : PERFORM consume_stock_fifo(...)              ← valida saldo E move
--   update_dose_log_atomic : restore_stock_for_log(...) + consume_stock_fifo(...) — pareados,
--                            ambos guardados por `v_stock_affecting`
--   delete_dose_log_atomic : PERFORM restore_stock_for_log(...)  (serve undo E delete)
--   "Estoque insuficiente" nasce DENTRO de consume_stock_fifo → não chamar a função já mata
--   validação e movimentação de uma vez. Nada mais a desligar.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                    | Análise / mitigação                                   |
-- |-----------------------------------------|-------------------------------------------------------|
-- | linha de user_settings AUSENTE          | ⚠️ ARMADILHA: `SELECT ... INTO v` com ZERO linhas ATRIBUI NULL à variável — NÃO preserva o valor de inicialização (comportamento do PL/pgSQL, diferente de `IF NOT FOUND`). Com o COALESCE dentro do SELECT o resultado seria NULL → `IF v_stock_tracking THEN` falso → estoque DESLIGADO por omissão (fail-OPEN, o oposto do exigido). Por isso o COALESCE vem DEPOIS do SELECT, sobre a variável. Verificado empiricamente contra prod (BEGIN..ROLLBACK): sem o fix, dose com saldo 0 registrava sem erro. Estoque NUNCA desliga por omissão. |
-- | stock_tracking_enabled NULL             | Coluna é NOT NULL DEFAULT true. `COALESCE(v, true)` cobre mesmo assim (defesa em profundidade — 3-valued logic do SQL). |
-- | stock_paused_at NULL                    | Estado normal (nunca pausou). F1 só cria a coluna; a semântica de gap (≥30d) é F2/F4. Nenhuma RPC de dose lê essa coluna. |
-- | toggle mid-transaction                  | Leitura ÚNICA no topo de cada RPC → a transação inteira decide pelo MESMO valor. Impossível restaurar sem reconsumir (update) ou consumir metade. Sem lock em user_settings (nenhuma escrita depende do valor lido). |
-- | log criado com ON, deletado/editado OFF  | Estoque NÃO é restaurado/reconsumido. É a semântica de CONGELAMENTO decidida pelo PO (spec NC3: opt-out congela; doses do período congelado nunca são reconciliadas). Consciente, não regressão. |
-- | p_user_id NULL                          | Pré-existente: as RPCs já falham adiante (log não encontrado / authz). O SELECT com `user_id = NULL` não retorna linha → COALESCE devolve TRUE → comportamento idêntico ao de hoje (estoque ativo). |
-- | quantity 0 / negativa, dose→0 ml, conversão líquida ausente | Inalterados: continuam dentro de consume_stock_fifo, que só roda em modo ON. Em modo OFF esses erros deixam de ser alcançáveis (FR-004: "sem jamais bloquear por saldo"). |
-- | Concorrência (2 doses simultâneas)      | Sem mudança: os locks (FOR UPDATE em medicine_logs / stock) seguem no mesmo lugar. O SELECT em user_settings é read-only PK-indexado, não introduz ordem de lock nova → sem deadlock novo. |
-- | Rollback da migração                    | Reversível: re-aplicar os corpos do dump (seção Rollback no fim) + DROP COLUMN. |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- GRANTS/RLS: `user_settings` já existe com RLS e grants — apenas colunas novas, sem CREATE TABLE.
-- As RPCs são SECURITY DEFINER com `search_path = ''` (preservado do dump), logo enxergam
-- user_settings independentemente do RLS do chamador; o filtro é `user_id = p_user_id`, e a
-- checagem de authz (auth.uid() <> p_user_id) já acontece no topo de cada RPC.
--
-- Aplicar via Supabase MCP (apply_migration) — testado antes com BEGIN..ROLLBACK
-- (`20260707_stock_tracking_preference.test.sql`).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Preferência em user_settings
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS stock_tracking_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS stock_paused_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.user_settings.stock_tracking_enabled IS
  'Spec 044: controle de estoque ligado (default) ou modo dose-only. Lido dentro das RPCs atômicas de dose.';
COMMENT ON COLUMN public.user_settings.stock_paused_at IS
  'Spec 044: instante do último opt-out (congelamento). NULL = nunca pausou. Base do gap lazy de reativação (≥30d → reconciliação).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. register_dose_atomic — curto-circuita consume_stock_fifo quando off
--    (assinatura idêntica ao dump de prod)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.register_dose_atomic(
  p_user_id uuid,
  p_protocol_id uuid,
  p_medicine_id uuid,
  p_taken_at timestamp with time zone,
  p_quantity_taken numeric,
  p_notes text,
  p_dose_instance_id uuid,
  p_strict_anchor boolean DEFAULT false,
  p_injection_site text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_log_id UUID;
  v_linked_instance UUID := NULL;
  v_marked BOOLEAN := false;
  -- Spec 044: TRUE por omissão — sem linha em user_settings o estoque NUNCA desliga.
  v_stock_tracking BOOLEAN := true;
BEGIN
  -- Defesa em profundidade (review #735): bloquear `anon` EXPLICITAMENTE. O check antigo só
  -- cobria 'authenticated'; um anon caía no ELSE e passava. Hoje não é explorável (anon não tem
  -- EXECUTE nestas 3 RPCs — verificado em prod), mas grants vazam por default privileges legados
  -- (AP-275): o guard não pode depender só do grant. service_role/postgres seguem passando.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  -- Leitura única da preferência dentro da transação (plan 044 §Decisão 2).
  SELECT us.stock_tracking_enabled INTO v_stock_tracking
    FROM public.user_settings us
    WHERE us.user_id = p_user_id;
  -- COALESCE **depois** do SELECT: `SELECT INTO` sem linha atribui NULL à variável (NÃO
  -- preserva o valor de inicialização). Sem esta linha, usuário sem user_settings cairia em
  -- NULL → `IF v_stock_tracking THEN` falso → estoque desligado por omissão (fail-OPEN).
  v_stock_tracking := COALESCE(v_stock_tracking, true);

  INSERT INTO public.medicine_logs (
    user_id, protocol_id, medicine_id, taken_at, quantity_taken, notes, dose_instance_id,
    injection_site
  )
  VALUES (
    p_user_id, p_protocol_id, p_medicine_id, p_taken_at, p_quantity_taken, p_notes, NULL,
    p_injection_site
  )
  RETURNING id INTO v_log_id;

  IF v_stock_tracking THEN
    PERFORM public.consume_stock_fifo(p_user_id, p_medicine_id, p_quantity_taken, v_log_id);
  END IF;

  IF p_dose_instance_id IS NOT NULL THEN
    UPDATE public.dose_instances
    SET status = 'taken', medicine_log_id = v_log_id
    WHERE id = p_dose_instance_id
      AND user_id = p_user_id
      AND status IN ('pending', 'missed', 'skipped_user');

    GET DIAGNOSTICS v_marked = ROW_COUNT;

    IF v_marked THEN
      UPDATE public.medicine_logs SET dose_instance_id = p_dose_instance_id WHERE id = v_log_id;
      v_linked_instance := p_dose_instance_id;
    ELSIF p_strict_anchor THEN
      RAISE EXCEPTION 'Ocorrência já registrada ou indisponível';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_log_id,
    'user_id', p_user_id,
    'protocol_id', p_protocol_id,
    'medicine_id', p_medicine_id,
    'taken_at', to_char(p_taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'quantity_taken', p_quantity_taken,
    'notes', p_notes,
    'dose_instance_id', v_linked_instance,
    'injection_site', p_injection_site
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. update_dose_log_atomic — v_stock_affecting passa a exigir tracking ligado.
--    Guarda os DOIS pontos (restore + consume) de uma vez, preservando o pareamento:
--    nunca restaura sem reconsumir.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_dose_log_atomic(
  p_user_id uuid,
  p_log_id uuid,
  p_protocol_id uuid,
  p_medicine_id uuid,
  p_taken_at timestamp with time zone,
  p_quantity_taken numeric,
  p_notes text,
  p_has_protocol boolean DEFAULT false,
  p_has_notes boolean DEFAULT false,
  p_injection_site text DEFAULT NULL::text,
  p_has_injection_site boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old RECORD;
  v_next_medicine UUID;
  v_next_quantity NUMERIC;
  v_next_protocol UUID;
  v_next_taken TIMESTAMPTZ;
  v_next_notes TEXT;
  v_next_injection_site TEXT;
  v_stock_affecting BOOLEAN;
  v_new RECORD;
  v_stock_tracking BOOLEAN := true;  -- Spec 044: TRUE por omissão.
BEGIN
  -- Defesa em profundidade (review #735): bloquear `anon` EXPLICITAMENTE. O check antigo só
  -- cobria 'authenticated'; um anon caía no ELSE e passava. Hoje não é explorável (anon não tem
  -- EXECUTE nestas 3 RPCs — verificado em prod), mas grants vazam por default privileges legados
  -- (AP-275): o guard não pode depender só do grant. service_role/postgres seguem passando.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT us.stock_tracking_enabled INTO v_stock_tracking
    FROM public.user_settings us
    WHERE us.user_id = p_user_id;
  -- COALESCE **depois** do SELECT: `SELECT INTO` sem linha atribui NULL à variável (NÃO
  -- preserva o valor de inicialização). Sem esta linha, usuário sem user_settings cairia em
  -- NULL → `IF v_stock_tracking THEN` falso → estoque desligado por omissão (fail-OPEN).
  v_stock_tracking := COALESCE(v_stock_tracking, true);

  SELECT * INTO v_old FROM public.medicine_logs
    WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de tomada de dose não encontrado';
  END IF;

  v_next_medicine := COALESCE(p_medicine_id, v_old.medicine_id);
  v_next_quantity := COALESCE(p_quantity_taken, v_old.quantity_taken);
  v_next_taken    := COALESCE(p_taken_at, v_old.taken_at);
  v_next_protocol := CASE WHEN p_has_protocol THEN p_protocol_id ELSE v_old.protocol_id END;
  v_next_notes    := CASE WHEN p_has_notes THEN p_notes ELSE v_old.notes END;
  v_next_injection_site := CASE WHEN p_has_injection_site THEN p_injection_site ELSE v_old.injection_site END;

  v_stock_affecting := v_stock_tracking
                   AND ((v_next_quantity <> v_old.quantity_taken)
                     OR (v_next_medicine <> v_old.medicine_id));

  IF v_stock_affecting THEN
    PERFORM public.restore_stock_for_log(p_log_id, 'dose_update_restore');
  END IF;

  UPDATE public.medicine_logs
  SET protocol_id = v_next_protocol,
      medicine_id = v_next_medicine,
      taken_at = v_next_taken,
      quantity_taken = v_next_quantity,
      notes = v_next_notes,
      injection_site = v_next_injection_site
  WHERE id = p_log_id AND user_id = p_user_id
  RETURNING * INTO v_new;

  IF v_stock_affecting THEN
    PERFORM public.consume_stock_fifo(p_user_id, v_next_medicine, v_next_quantity, p_log_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_new.id,
    'user_id', v_new.user_id,
    'protocol_id', v_new.protocol_id,
    'medicine_id', v_new.medicine_id,
    'taken_at', to_char(v_new.taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'quantity_taken', v_new.quantity_taken,
    'notes', v_new.notes,
    'dose_instance_id', v_new.dose_instance_id,
    'injection_site', v_new.injection_site
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. delete_dose_log_atomic — serve undo E exclusão. Pula restore_stock_for_log quando off.
--    A reversão da dose_instance (taken → pending/missed) e o DELETE do log são
--    INDEPENDENTES do modo: em dose-only o log/instância continuam sendo o dado canônico.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_dose_log_atomic(
  p_user_id uuid,
  p_log_id uuid,
  p_default_tolerance_minutes integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_log RECORD;
  v_scheduled TIMESTAMPTZ;
  v_tolerance INT;
  v_new_status TEXT;
  v_stock_tracking BOOLEAN := true;  -- Spec 044: TRUE por omissão.
BEGIN
  -- Defesa em profundidade (review #735): bloquear `anon` EXPLICITAMENTE. O check antigo só
  -- cobria 'authenticated'; um anon caía no ELSE e passava. Hoje não é explorável (anon não tem
  -- EXECUTE nestas 3 RPCs — verificado em prod), mas grants vazam por default privileges legados
  -- (AP-275): o guard não pode depender só do grant. service_role/postgres seguem passando.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT us.stock_tracking_enabled INTO v_stock_tracking
    FROM public.user_settings us
    WHERE us.user_id = p_user_id;
  -- COALESCE **depois** do SELECT: `SELECT INTO` sem linha atribui NULL à variável (NÃO
  -- preserva o valor de inicialização). Sem esta linha, usuário sem user_settings cairia em
  -- NULL → `IF v_stock_tracking THEN` falso → estoque desligado por omissão (fail-OPEN).
  v_stock_tracking := COALESCE(v_stock_tracking, true);

  SELECT * INTO v_log FROM public.medicine_logs
    WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de tomada de dose não encontrado';
  END IF;

  IF v_stock_tracking THEN
    PERFORM public.restore_stock_for_log(p_log_id, 'dose_deleted_restore');
  END IF;

  IF v_log.dose_instance_id IS NOT NULL THEN
    SELECT scheduled_for, COALESCE(tolerance_minutes, p_default_tolerance_minutes)
      INTO v_scheduled, v_tolerance
      FROM public.dose_instances
      WHERE id = v_log.dose_instance_id AND user_id = p_user_id;

    IF FOUND THEN
      IF now() <= v_scheduled + (v_tolerance * INTERVAL '1 minute') THEN
        v_new_status := 'pending';
      ELSE
        v_new_status := 'missed';
      END IF;

      UPDATE public.dose_instances
      SET status = v_new_status, medicine_log_id = NULL
      WHERE id = v_log.dose_instance_id AND user_id = p_user_id AND status = 'taken';
    END IF;
  END IF;

  DELETE FROM public.medicine_logs WHERE id = p_log_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'id', v_log.id,
    'dose_instance_id', v_log.dose_instance_id,
    'success', true
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Least privilege nas RPCs de estoque/dose (review #735 — CLAUDE.md §Migrações)
--
--    O reviewer apontou o guard de authz que não bloqueava `anon`. A auditoria dos GRANTS em
--    prod (2026-07-11) mostrou que o cenário NÃO é explorável nas 3 RPCs atômicas (anon não tem
--    EXECUTE nelas) — mas encontrou um furo REAL ao lado:
--
--      restore_stock_for_log  →  anon TEM EXECUTE  (grant legado, classe AP-275)
--
--    Hoje ela se salva por acidente: resolve o dono por `auth.uid()`, que vem NULL para anon, e
--    aborta com 'Usuário não autenticado'. Mas é SECURITY DEFINER e MUTA ESTOQUE — depender de
--    um NULL acidental não é controle de acesso. Pior: a T007b (044 F2) vai fazer essa função
--    aceitar `p_user_id` para poder rodar server-side; com o grant de anon aberto, isso viraria
--    um bypass REAL (anon restaura estoque de terceiro passando o user_id na chamada).
--    Fechar o grant AGORA, antes que a F2 abra a porta.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text) FROM anon;

-- Idempotente: reafirma o least privilege das 3 atômicas (já correto em prod; protege contra
-- default privileges legados voltarem a conceder EXECUTE a anon numa recriação futura).
REVOKE EXECUTE ON FUNCTION public.register_dose_atomic(uuid, uuid, uuid, timestamptz, numeric, text, uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_dose_log_atomic(uuid, uuid, uuid, uuid, timestamptz, numeric, text, boolean, boolean, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_dose_log_atomic(uuid, uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.register_dose_atomic(uuid, uuid, uuid, timestamptz, numeric, text, uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_dose_log_atomic(uuid, uuid, uuid, uuid, timestamptz, numeric, text, boolean, boolean, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_dose_log_atomic(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação pós-aplicação
--   1. Colunas:
--      SELECT column_name, is_nullable, column_default FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='user_settings'
--        AND column_name IN ('stock_tracking_enabled','stock_paused_at');
--      (esperado: stock_tracking_enabled NO/true · stock_paused_at YES/null)
--   2. Assinaturas INALTERADAS (guard AP-227 — 1 linha por função, zero overload):
--      SELECT proname, pg_get_function_identity_arguments(oid)
--      FROM pg_proc WHERE proname IN
--        ('register_dose_atomic','update_dose_log_atomic','delete_dose_log_atomic');
--
-- Rollback
--   Re-aplicar os corpos do dump 2026-07-11 (idênticos, sem o SELECT de preferência
--   e sem os guards `v_stock_tracking`) e:
--     ALTER TABLE public.user_settings DROP COLUMN IF EXISTS stock_tracking_enabled;
--     ALTER TABLE public.user_settings DROP COLUMN IF EXISTS stock_paused_at;
