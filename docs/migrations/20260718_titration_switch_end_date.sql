-- ═══════════════════════════════════════════════════════════════════════════════
-- 20260718 · confirm_titration_switch — ENCERRAR a etapa anterior, não pausá-la
--
-- Contexto: revisão do PO durante o smoke do 029 F5.
--
-- O QUE MUDA
--   No `medicine_switch`, o executor da etapa que sai passa a receber `end_date` (dia LOCAL do
--   dono) além de `active=false` + `paused_at`. O executor que entra passa a ter `end_date`
--   LIMPO na reativação.
--
-- POR QUE
--   "Pausado" anuncia retomável. A aba Pausados oferece Retomar, que é um toggle genérico de
--   `active` sem consciência de titulação: retomar a etapa antiga com a nova já ativa colocaria
--   DOIS executores da mesma escada gerando doses em paralelo — lembrete de duas concentrações
--   do mesmo medicamento. A etapa não pausou, ela terminou.
--
-- ALCANCE REAL EM PRODUÇÃO
--   Até o F5 esta RPC não tinha nenhum chamador no cliente (só o tipo em database.types.ts), e
--   o caminho de dano nunca foi alcançável. É o F5 que o abriria — por isso a correção vem junto.
--
-- CONTRATO
--   Assinatura, retorno e reasons INALTERADOS. CON-032 §Escrita segue válido; muda só o efeito
--   colateral sobre `protocols` (documentado no contrato).
--
-- NOTA DE CLASSIFICAÇÃO (não é bug — é a semântica de `end_date`)
--   `resolveTreatmentStatus` usa `end_date < hoje` (estrito): com `end_date = hoje`, o tratamento
--   aparece como FINALIZADO só a partir de AMANHÃ; no dia da troca ele ainda lista em Pausados.
--   Isso é correto — `end_date` é o ÚLTIMO DIA de vigência, e um tratamento que termina hoje
--   ainda valeu hoje. Trocar para `<=` mataria a última dose de TODO tratamento com data de fim.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.confirm_titration_switch(uuid);

CREATE FUNCTION public.confirm_titration_switch(p_step_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_step             public.titration_steps%ROWTYPE;
  v_prev             public.titration_steps%ROWTYPE;
  v_status           text;
  v_transition       text;
  v_protocol_id      uuid;
  v_prev_protocol    public.protocols%ROWTYPE;
  v_paused_protocol  uuid := NULL;
  v_tz               text;
BEGIN
  IF v_user_id IS NULL THEN
    -- Defesa em profundidade: o REVOKE já barra anon, mas a função não depende disso.
    RETURN jsonb_build_object('success', false, 'reason', 'nao_autenticado');
  END IF;

  -- ══ CLAIM ATÔMICO (R-288) ══════════════════════════════════════════════════
  -- O predicado É a exclusão mútua: só UMA transação vê 'pending_confirmation'. O dono sai
  -- da ROW (user_id = auth.uid()), nunca do payload — não há como pedir a etapa de outro.
  UPDATE public.titration_steps
     SET status     = 'current',
         started_at = now(),
         updated_at = now()
   WHERE id = p_step_id
     AND user_id = v_user_id
     AND status = 'pending_confirmation'
  RETURNING * INTO v_step;

  IF NOT FOUND THEN
    -- Claim vazio: alguém chegou antes (double-tap / 2 devices) ou é retry do mesmo comando.
    -- AP-277: SELECT INTO sem linha atribui NULL — por isso o IS NULL explícito abaixo.
    SELECT status INTO v_status
      FROM public.titration_steps
     WHERE id = p_step_id AND user_id = v_user_id;

    IF v_status IS NULL THEN
      -- Não existe OU não é do usuário: mesma resposta (não vaza existência — IDOR).
      RETURN jsonb_build_object('success', false, 'reason', 'nao_pendente');
    ELSIF v_status = 'current' THEN
      -- Já confirmada por este mesmo comando (retry/double-tap): no-op honesto, não erro.
      RETURN jsonb_build_object('success', true, 'already_confirmed', true, 'step_id', p_step_id);
    ELSIF v_status = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'step_obsoleto');
    ELSE
      RETURN jsonb_build_object('success', false, 'reason', 'nao_pendente');
    END IF;
  END IF;

  -- ══ ETAPA ANTERIOR ═════════════════════════════════════════════════════════
  -- A vigente é a de maior position ANTES desta (a escada é ordenada por position).
  SELECT * INTO v_prev
    FROM public.titration_steps
   WHERE titration_id = v_step.titration_id
     AND user_id = v_user_id
     AND position < v_step.position
     AND status = 'current'
   ORDER BY position DESC
   LIMIT 1;

  -- Tipo DERIVADO na execução (ADR-080 §2 / trace §A4), nunca congelado no push:
  -- mesmo medicine_id ⇒ dose_change (não pausa nada, só ajusta a dose do protocol vigente).
  IF v_prev.id IS NOT NULL AND v_prev.medicine_id = v_step.medicine_id THEN
    v_transition := 'dose_change';
  ELSE
    v_transition := 'medicine_switch';
  END IF;

  -- Encerra a etapa anterior (histórico da escada).
  IF v_prev.id IS NOT NULL THEN
    UPDATE public.titration_steps
       SET status = 'completed', ended_at = now(), updated_at = now()
     WHERE id = v_prev.id AND user_id = v_user_id;
  END IF;

  -- ══ EXECUTORES (protocols) ═════════════════════════════════════════════════
  IF v_transition = 'dose_change' THEN
    -- Mesmo medicamento: o executor não muda, só a dose por tomada.
    v_protocol_id := v_prev.protocol_id;
    IF v_protocol_id IS NOT NULL THEN
      UPDATE public.protocols
         SET dosage_per_intake = v_step.dose,
             intake_unit       = NULLIF(v_step.intake_unit, 'cp')  -- fronteira N2→N1 (ver preflight)
       WHERE id = v_protocol_id AND user_id = v_user_id;
    END IF;
  ELSE
    -- Troca de medicamento: ENCERRA o anterior (desativando-o) e ativa/cria o próximo.
    --
    -- 🔴 ENCERRAR, não pausar (revisão do PO no smoke do F5, 2026-07-18). A etapa anterior NÃO
    -- está em pausa: ela TERMINOU e outra começou. A versão original só marcava
    -- `active=false, paused_at`, e "pausado" anuncia retomável — o tratamento caía na aba
    -- Pausados com o botão Retomar, que é um toggle genérico de `active` sem consciência de
    -- titulação. Retomar ali reativava a etapa antiga com a nova JÁ ativa: dois executores da
    -- mesma escada gerando `dose_instances` em paralelo, e o usuário recebendo lembrete das duas
    -- concentrações do mesmo medicamento. Até o F5 a RPC não tinha chamador no cliente, então o
    -- caminho nunca foi alcançável em produção.
    --
    -- A ordem é deliberada (pedido do PO): desativa E pausa primeiro, DEPOIS crava o fim — o
    -- tratamento é encerrado já inativo, nunca encerrado-porém-ativo em nenhum instante.
    -- `paused_at` permanece porque é o carimbo de quando parou de executar; `end_date` é a data
    -- em que o tratamento acabou. São fatos diferentes.

    -- Fuso do dono ANTES da escrita: `end_date` é DATE e precisa ser o dia LOCAL (R-253/R-254).
    -- Com `now()::date` cru, uma troca às 22h em GMT-3 gravaria o dia SEGUINTE (UTC), e o
    -- tratamento apareceria encerrado num dia em que ainda executou.
    SELECT timezone INTO v_tz FROM public.user_settings WHERE user_id = v_user_id;
    v_tz := COALESCE(v_tz, 'America/Sao_Paulo'); -- fallback idêntico ao resolveUserTz (R-254)

    IF v_prev.protocol_id IS NOT NULL THEN
      UPDATE public.protocols
         SET active    = false,
             paused_at = now(),
             end_date  = (now() AT TIME ZONE v_tz)::date
       WHERE id = v_prev.protocol_id AND user_id = v_user_id
      RETURNING * INTO v_prev_protocol;
      v_paused_protocol := v_prev_protocol.id;

      -- PAR OBRIGATÓRIO da pausa (espelha syncInstancesOnWrite do core): sem isto o
      -- usuário seguiria recebendo lembrete do medicamento ANTIGO. Nunca toca o passado.
      IF v_paused_protocol IS NOT NULL THEN
        UPDATE public.dose_instances
           SET status = 'skipped_paused'
         WHERE protocol_id = v_paused_protocol
           AND status = 'pending'
           AND scheduled_for > now();
      END IF;
    END IF;

    IF v_step.protocol_id IS NOT NULL THEN
      -- Executor da etapa já existe (escada cadastrada com protocolos, ou re-ativação).
      UPDATE public.protocols
         SET active            = true,
             paused_at         = NULL,
             -- Limpar o fim junto: este executor pode ter sido ENCERRADO por uma troca anterior
             -- (escada que volta a uma concentração já usada). Sem isto ele reativaria já
             -- finalizado — `resolveTreatmentStatus` faz FINALIZADO vencer sobre `active`.
             end_date          = NULL,
             dosage_per_intake = v_step.dose,
             intake_unit       = NULLIF(v_step.intake_unit, 'cp')  -- fronteira N2→N1 (ver preflight)
       WHERE id = v_step.protocol_id AND user_id = v_user_id;

      -- Espelha reactivateFuturePaused: o upsert idempotente do gerador não reverteria.
      UPDATE public.dose_instances
         SET status = 'pending'
       WHERE protocol_id = v_step.protocol_id
         AND status = 'skipped_paused'
         AND scheduled_for > now();

      v_protocol_id := v_step.protocol_id;
    ELSE
      -- Nasce o executor da etapa, herdando o AGENDAMENTO do anterior (Decisões §3.3:
      -- "Lembretes — Quinta · 22:00 · 0,5 mg" — o horário do usuário não muda na troca).
      SELECT timezone INTO v_tz FROM public.user_settings WHERE user_id = v_user_id;
      v_tz := COALESCE(v_tz, 'America/Sao_Paulo'); -- fallback idêntico ao resolveUserTz (R-254)

      INSERT INTO public.protocols (
        user_id, medicine_id, name, dosage_per_intake, intake_unit,
        frequency, weekdays, time_schedule, start_date, active,
        treatment_plan_id, critical_alarm
      )
      SELECT
        v_user_id,
        v_step.medicine_id,
        COALESCE(v_prev_protocol.name, m.name),
        v_step.dose,
        NULLIF(v_step.intake_unit, 'cp'),          -- fronteira N2→N1 (ver preflight)
        COALESCE(v_prev_protocol.frequency, 'diário'),  -- CHECK exige o acento (dado real de prod)
        v_prev_protocol.weekdays,
        COALESCE(v_prev_protocol.time_schedule, '[]'::jsonb),
        (now() AT TIME ZONE v_tz)::date,
        true,
        v_prev_protocol.treatment_plan_id,
        COALESCE(v_prev_protocol.critical_alarm, false)
      FROM public.medicines m
      WHERE m.id = v_step.medicine_id
      RETURNING id INTO v_protocol_id;
    END IF;

    UPDATE public.titration_steps
       SET protocol_id = v_protocol_id, updated_at = now()
     WHERE id = v_step.id AND user_id = v_user_id;
  END IF;

  -- ══ AUDITORIA (CON-031 aditivo) ════════════════════════════════════════════
  -- dose_instance_id NULL: a transição é do tratamento, não de uma ocorrência de dose.
  INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor, detail)
  VALUES (
    v_user_id, NULL, 'titration_transitioned', 'server', 'user',
    jsonb_build_object(
      'titration_id',        v_step.titration_id,
      'step_id',             v_step.id,
      'position',            v_step.position,
      'transition',          v_transition,
      'medicine_id',         v_step.medicine_id,
      'dose',                v_step.dose,
      'intake_unit',         v_step.intake_unit,
      'protocol_activated',  v_protocol_id,
      'protocol_paused',     v_paused_protocol,
      'previous_step_id',    v_prev.id
    )
  );

  RETURN jsonb_build_object(
    'success',            true,
    'already_confirmed',  false,
    'transition',         v_transition,
    'step_id',            v_step.id,
    'protocol_activated', v_protocol_id,
    'protocol_paused',    v_paused_protocol
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_titration_switch(uuid) IS
  'Confirma a etapa pendente da Evolução do tratamento (spec 029 / ADR-080 / F3). Claim atômico '
  'WHERE status=pending_confirmation (R-288): idempotente por estado sob retry/double-tap. Dono '
  'derivado da row (auth.uid()), nunca do payload. Tipo de transição DERIVADO por medicine_id '
  'adjacente. Estoque intocado (PO-4/F5). No medicine_switch o executor que SAI é ENCERRADO '
  '(active=false + paused_at + end_date local) e o que ENTRA tem end_date limpo. A geração das '
  'instâncias do protocol novo é best-effort fora da txn (R-245: cron diário + ensureInstancesUpTo).';

-- AP-278: REVOKE antes de qualquer GRANT. anon NUNCA executa RPC privilegiada que muta dado —
-- proteção por controle de acesso, não por acidente (auth.uid() NULL abortando lá dentro).
REVOKE EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) TO authenticated;
