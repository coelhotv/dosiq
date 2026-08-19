-- 20260818_skip_dose_atomic_and_status_privilege.sql — spec 067 Slice B (T041/T042/T049/T050)
--
-- OBJETIVO (ADR-092): a guarda de janela vira PRIVILÉGIO, não convenção.
--   1. `skip_dose_atomic` — o skip passa a declarar o instante a que se refere e a ser recusado
--      fora da janela da instância (FR-010 restrita ao skip por Decisão 12, FR-011/FR-012).
--      Posse verificada DENTRO da função (FR-028) — fecha o IDOR pré-existente do bot, que roda
--      `service_role` (sem `auth.uid()`) e filtrava só por `protocol_id` vindo do `callback_data`.
--   2. `set_protocol_dose_state_atomic` — pausar/retomar tratamento (FR-030). NÃO passa pela
--      guarda de janela: é estado do tratamento, não fato clínico da paciente (Decisão 4).
--   3. `REVOKE UPDATE (status)` de `authenticated` (FR-029). Depois disto, `dose_instances.status`
--      só muda por função `SECURITY DEFINER`.
--
-- ⚠️ ORDEM DE APLICAÇÃO (Decisões 15/16 do PO, 2026-08-18) — as partes 1+2 e a parte 3 são
--    aplicadas em MOMENTOS DIFERENTES, de propósito:
--
--      partes 1+2 (as RPCs)  → aplicadas ANTES do PR do B1 (aditivas: nada que roda hoje usa).
--      parte 3 (o REVOKE)    → NÃO aplicar junto. Só depois de (a) merge + deploy da web E
--                              (b) a versão nova do app ser MAJORITÁRIA nas lojas.
--
--    Motivo: as RPCs substitutas só existem no código novo. Aplicar o REVOKE antes derruba
--    pausar/retomar tratamento e pular dose em TODO cliente já publicado (42501) — e o binário
--    das lojas não atualiza na hora. Enquanto a parte 3 não for aplicada, a guarda existe mas
--    ainda é contornável por quem escreve fora da RPC: ela vira PRIVILÉGIO só no B2.
--    Gate do B2 = PO-SEC-2.
--
-- Decisões do PO que definem o escopo (2026-08-18, C1.5 do Slice B):
--   Decisão 12 — `register_dose_atomic` fica INTOCADO. Aplicar a janela ao `p_taken_at` recusaria
--                registro tardio legítimo (dose `missed` das 13:30 registrada às 18:00), regressão
--                clínica pior que o buraco. A janela do `taken` segue só na guarda de client (A2).
--   Decisão 13 — `update_dose_log_atomic` fora do escopo (edição de histórico é ato deliberado).
--   Decisão 14 — assinatura em LOTE (`p_dose_instance_ids uuid[]`): preserva a atomicidade do
--                `UPDATE ... .in(ids)` que o skip agrupado tem hoje. Array de ids não é parâmetro
--                de janela ⇒ FR-033 intacta (nenhum `p_tolerance`/`p_early_window`/`p_now`).
--
-- ⚠️ C1.5/F-B1 — o writer de pausa que a FR-030 nomeia NÃO é o que roda em produção:
--   `createProtocolRepository.ts:63` chama `markAllFutureSkippedPaused`, não `markSkippedPaused`.
--   As TRÊS funções do repositório migram (`pause_all`, `pause_until`, `resume`).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                  |
-- |----------------------------------------|------------------------------------------------------|
-- | `p_dose_instance_ids` NULL ou '{}'     | RAISE 'Nenhuma dose informada' — nunca sucesso vazio (R-305). |
-- | instância de OUTRO dono                | filtro `user_id = p_user_id` na leitura ⇒ some do conjunto ⇒ contagem diverge ⇒ RAISE. Vale inclusive p/ `service_role` (bot), que não tem `auth.uid()`. |
-- | chamada `anon`                         | gate explícito no corpo (copiado de `register_dose_atomic`) + ausência de GRANT EXECUTE. |
-- | `p_skipped_at` no futuro               | RAISE — o instante declarado é limitado por `now()` do servidor (FR-033). |
-- | `p_skipped_at` NULL                    | DEFAULT `now()`; `COALESCE` no corpo cobre NULL explícito. |
-- | janela: adiantado / vencido            | RAISE nomeada com o horário previsto (FR-013 — a mensagem é o que a paciente lê). |
-- | dose já resolvida (`taken`/`skipped_*`)| sai do `IN ('pending','missed')` ⇒ contagem diverge ⇒ RAISE. 0 linhas NUNCA vira 200 mudo (R-305). |
-- | lote parcial (1 ok + 1 recusada)       | tudo numa transação e a checagem é ANTES do UPDATE ⇒ all-or-nothing. |
-- | id repetido no array                   | `SELECT DISTINCT` na CTE ⇒ contagem estável. |
-- | `early_window_minutes` ausente         | IMPOSSÍVEL: coluna `NOT NULL DEFAULT 120` (A2). O fail-closed em 120 vive no client. |
-- | pausa: protocolo de outro dono         | `user_id = p_user_id` no UPDATE; 0 linhas é LEGÍTIMO aqui (protocolo sem futuro pendente) ⇒ retorna contagem, não levanta. |
-- | pausa tocando o passado                | `scheduled_for > now()` preservado verbatim do repositório. |
-- | REVOKE derruba Live Activity           | NÃO: revogação por COLUNA — `la_push_token`/`la_push_state`/`snoozed_until` e as demais 13 colunas seguem com UPDATE. Guard: PATCH de `la_push_token` ⇒ 200 (PO-SEC-2). |
-- | REVOKE derruba o sweep de `missed`     | NÃO: `markMissedDueInstances` roda no bot com `service_role` (`server/bot/doseInstanceScheduler.ts:142`), fora do papel revogado. |
-- | REVOKE derruba `register_dose_atomic`  | NÃO: `SECURITY DEFINER` executa como owner, não como `authenticated`. |
-- | rollback                               | `GRANT UPDATE ON public.dose_instances TO authenticated` + `DROP FUNCTION` das duas RPCs. |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Aplicar via Supabase MCP (apply_migration), após BEGIN..ROLLBACK do
-- `20260818_skip_dose_atomic_and_status_privilege.test.sql`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. skip_dose_atomic — o skip declara o instante e passa pela janela
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.skip_dose_atomic(
  p_user_id uuid,
  p_dose_instance_ids uuid[],
  p_skipped_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_at         timestamptz := COALESCE(p_skipped_at, now());
  v_requested  integer;
  v_eligible   integer;
  v_offender   record;
BEGIN
  -- Defesa em profundidade (mesmo gate de `register_dose_atomic`): `anon` barrado
  -- EXPLICITAMENTE; `authenticated` só age sobre si. `service_role` (bot) não tem
  -- `auth.uid()` — para ele a posse é provada pelo filtro `user_id = p_user_id` abaixo.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  IF p_dose_instance_ids IS NULL OR array_length(p_dose_instance_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma dose informada para pular';
  END IF;

  -- O instante declarado é entrada legítima, mas limitado por `now()` do servidor (FR-033):
  -- pular uma dose "no futuro" é a assinatura de um relógio adiantado, o vetor do incidente.
  IF v_at > now() THEN
    RAISE EXCEPTION 'Instante declarado no futuro';
  END IF;

  SELECT count(DISTINCT x) INTO v_requested FROM unnest(p_dose_instance_ids) AS x;

  -- Conjunto elegível: posse + status não resolvido. Tudo que não entrar aqui faz a
  -- contagem divergir e a transação inteira aborta (R-305: 0 linhas é FALHA, não sucesso).
  SELECT count(*) INTO v_eligible
    FROM public.dose_instances di
   WHERE di.id = ANY (p_dose_instance_ids)
     AND di.user_id = p_user_id
     AND di.status IN ('pending', 'missed');

  IF v_eligible <> v_requested THEN
    RAISE EXCEPTION 'Dose indisponível para pular (já registrada, inexistente ou de outro usuário)';
  END IF;

  -- Janela lida da PRÓPRIA LINHA (FR-033): nenhum parâmetro de janela na assinatura.
  -- Piso = `early_window_minutes` (A2), teto = `tolerance_minutes`.
  SELECT di.id,
         di.scheduled_for,
         to_char(di.scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SSZ') AS sched_utc
    INTO v_offender
    FROM public.dose_instances di
   WHERE di.id = ANY (p_dose_instance_ids)
     AND di.user_id = p_user_id
     AND (   v_at < di.scheduled_for - make_interval(mins => di.early_window_minutes)
          OR v_at > di.scheduled_for + make_interval(mins => di.tolerance_minutes))
   LIMIT 1;

  IF FOUND THEN
    -- FR-013: a mensagem é lida pela paciente. Nomeia o motivo e o horário previsto,
    -- sem SQLSTATE, nome de função ou stack (RC-SEC/S-8).
    RAISE EXCEPTION 'Fora da janela da dose (horário previsto: %)', v_offender.sched_utc;
  END IF;

  UPDATE public.dose_instances di
     SET status = 'skipped_user'
   WHERE di.id = ANY (p_dose_instance_ids)
     AND di.user_id = p_user_id
     AND di.status IN ('pending', 'missed');

  GET DIAGNOSTICS v_eligible = ROW_COUNT;

  IF v_eligible <> v_requested THEN
    RAISE EXCEPTION 'Dose indisponível para pular (corrida com outro registro)';
  END IF;

  RETURN jsonb_build_object(
    'skipped', v_eligible,
    'skipped_at', to_char(v_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.skip_dose_atomic(uuid, uuid[], timestamptz) FROM PUBLIC;
-- ⚠️ AP-275 / medido no C4: `REVOKE ... FROM PUBLIC` NÃO basta. O schema `public` tem
-- ALTER DEFAULT PRIVILEGES concedendo EXECUTE a `anon` em toda função nova ⇒ a função nasce com
-- `anon=X` no `proacl`, diferente das RPCs antigas. O REVOKE explícito é o que iguala o perfil
-- (o gate `anon` no corpo é a 2ª camada, não substitui o privilégio — R-305).
REVOKE ALL ON FUNCTION public.skip_dose_atomic(uuid, uuid[], timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.skip_dose_atomic(uuid, uuid[], timestamptz)
  TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. set_protocol_dose_state_atomic — pausa/retomada (FR-030)
--    Estado do TRATAMENTO, não fato clínico ⇒ SEM guarda de janela (Decisão 4).
--    Semântica preservada verbatim de `createDoseInstanceRepository`:
--      pause_all   ← markAllFutureSkippedPaused  (pending futuras → skipped_paused)
--      pause_until ← markSkippedPaused           (idem, até `p_until`)
--      resume      ← reactivateFuturePaused      (skipped_paused futuras → pending)
--    Nunca toca o passado; nunca toca status diferente do de origem.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_protocol_dose_state_atomic(
  p_user_id uuid,
  p_protocol_id uuid,
  p_mode text,
  p_until timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  IF p_protocol_id IS NULL THEN
    RAISE EXCEPTION 'Tratamento não informado';
  END IF;

  IF p_mode = 'pause_until' AND p_until IS NULL THEN
    RAISE EXCEPTION 'Data limite não informada';
  END IF;

  IF p_mode NOT IN ('pause_all', 'pause_until', 'resume') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;

  IF p_mode = 'resume' THEN
    UPDATE public.dose_instances di
       SET status = 'pending'
     WHERE di.protocol_id = p_protocol_id
       AND di.user_id = p_user_id
       AND di.status = 'skipped_paused'
       AND di.scheduled_for > now();
  ELSE
    UPDATE public.dose_instances di
       SET status = 'skipped_paused'
     WHERE di.protocol_id = p_protocol_id
       AND di.user_id = p_user_id
       AND di.status = 'pending'
       AND di.scheduled_for > now()
       AND (p_mode = 'pause_all' OR di.scheduled_for <= p_until);
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 0 linhas é LEGÍTIMO aqui (protocolo sem futuro pendente) — ao contrário do skip,
  -- não existe promessa de "esta dose específica mudou" a ser quebrada.
  RETURN jsonb_build_object('affected', v_count, 'mode', p_mode);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_protocol_dose_state_atomic(uuid, uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_protocol_dose_state_atomic(uuid, uuid, text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_protocol_dose_state_atomic(uuid, uuid, text, timestamptz)
  TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REVOKE UPDATE (status) — a guarda vira privilégio (FR-029 / ADR-092)
--
--    PostgreSQL NÃO subtrai coluna de um GRANT de tabela: revogar `UPDATE(status)` sobre um
--    `GRANT UPDATE ON TABLE` é no-op silencioso. A forma correta é derrubar o grant de tabela
--    e reconceder coluna a coluna — 16 das 17 colunas, todas menos `status`.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE UPDATE ON public.dose_instances FROM authenticated;

GRANT UPDATE (
  id,
  user_id,
  protocol_id,
  medicine_id,
  medicine_log_id,
  scheduled_for,
  expected_dose,
  tolerance_minutes,
  early_window_minutes,
  critical_alarm,
  snoozed_until,
  notified_at,
  created_at,
  la_push_token,
  la_push_state,
  la_push_started_at
) ON public.dose_instances TO authenticated;
