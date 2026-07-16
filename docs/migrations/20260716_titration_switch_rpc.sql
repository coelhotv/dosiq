-- 20260716_titration_switch_rpc.sql — 029 Slice F3 / T013 (confirmação do medicine_switch)
--
-- PROPÓSITO: dar ao usuário o comando atômico "iniciar a etapa N" da Evolução do tratamento.
-- É a única transição de posse HUMANA do épico (o `dose_change` é automático no cron, F3/T012):
-- o `medicine_switch` fica PENDENTE até a confirmação explícita (NC-2 / Decisões §3) porque
-- trocar de medicamento sem o usuário saber é risco clínico + logístico (a caneta nova pode não
-- ter chegado).
--
-- ENTREGA 3 COISAS:
--   1) BACKFILL de `titration_steps.protocol_id` — pré-requisito do cutover (T014).
--   2) `dose_critical_events.event` += 'titration_transitioned' (CON-031 aditivo, R-271).
--   3) RPC `confirm_titration_switch(p_step_id uuid)` — claim atômico + transição mecânica.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- POR QUE O BACKFILL É CRÍTICO (e não cosmético)
-- ─────────────────────────────────────────────────────────────────────────────
-- A migração de dados N1→N2 (20260716_titrations_data_migration.sql) NÃO materializou
-- `protocol_id` — as 3 etapas em prod estão com a coluna NULL. O cutover (T014) resolve a dose
-- vigente lendo as etapas FILTRADAS por `protocol_id = protocol.id` (trace §A5: sem o filtro, o
-- walk-forward do adapter adotaria a dose de OUTRO medicamento numa escada cross-med). Sem o
-- backfill o filtro devolve VAZIO e a dose de titulação degrada em silêncio para
-- `protocols.dosage_per_intake`. N1 é intra-protocolo por construção (todas as etapas herdaram
-- o mesmo medicine_id do protocol de origem), então o vínculo é exato, não heurístico.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- O DESENHO DE CONCORRÊNCIA (R-288 — trace completo em plan.md §Apêndice F3)
-- ─────────────────────────────────────────────────────────────────────────────
-- O claim É o UPDATE: `WHERE status = 'pending_confirmation'` transiciona o status para o estado
-- de posse ('current') na MESMA transação em que executa a transição inteira. Não existe janela
-- de processamento assíncrono entre reivindicar e processar ⇒ AP-276 (claim que não muda status)
-- não se aplica, e não há stuck-recovery a fazer: `pending_confirmation` é posse HUMANA, sem
-- timeout por REQUISITO de produto (Decisões §7.2 "sem pressa"; §10 "nunca avança sozinho").
--
-- Idempotência por ESTADO, não por token (AP-221): o retry do mesmo comando cai no claim vazio,
-- lê o status atual e responde `already_confirmed` — o mesmo caminho de código do double-tap.
-- Read-modify-write em JS aqui seria TOCTOU; por isso a decisão vive num único UPDATE predicado.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                 |
-- |----------------------------------------|-----------------------------------------------------|
-- | p_step_id NULL / inexistente           | claim 0 linhas → SELECT de diagnóstico não acha → {success:false, reason:'nao_pendente'}. Não distingue "não existe" de "não é seu" (não vaza existência). |
-- | step de OUTRO usuário (IDOR)           | `AND user_id = auth.uid()` no claim E no SELECT: dono derivado DA ROW, nunca do payload (AP-293). A RPC não tem parâmetro de user por design. |
-- | anon chamando                          | REVOKE EXECUTE FROM PUBLIC + FROM anon (AP-278): negado por CONTROLE, não por acidente de auth.uid() NULL. |
-- | 2 confirmações concorrentes            | 1ª pega o row lock; a 2ª bloqueia, re-avalia o predicado após o COMMIT, pega 0 linhas → already_confirmed. 1 transição. |
-- | retry offline do mesmo comando         | idem acima → {success:true, already_confirmed:true}. Nenhum protocol/evento duplicado. |
-- | step já 'completed'                    | {success:false, reason:'step_obsoleto'} — rejeição honesta (não finge sucesso). |
-- | step 'upcoming' (ainda não venceu)     | {success:false, reason:'nao_pendente'} — a UI não deve oferecer a ação. |
-- | SELECT ... INTO sem linha              | AP-277: atribui NULL, não preserva default. Todo SELECT INTO aqui é seguido de `FOUND`/IS NULL explícito. |
-- | etapa anterior inexistente (1ª etapa)  | v_prev NULL → nada a pausar/completar; só ativa/cria o protocol da etapa. Caminho legítimo (escada nova, F4/F5). |
-- | etapa anterior sem protocol_id         | Nada a pausar (não há executor). Registrado no `detail` do evento; não é erro. |
-- | medicine_id igual ao da etapa anterior | Deriva `dose_change` NA EXECUÇÃO (trace §A4: o usuário pode ter editado a etapa após o push): atualiza a dose do MESMO protocol, sem pausar nada. O tipo nunca é congelado no push. |
-- | protocol novo já existe (re-ativação)  | active=true + paused_at=NULL + dose/unidade da etapa; instâncias skipped_paused futuras voltam a pending (espelha `reactivateFuturePaused` do JS). |
-- | protocol novo não existe               | INSERT herdando horários/frequência/plano do anterior (Decisões §3.3 "Lembretes — Quinta · 22:00"). start_date = hoje no fuso do dono. |
-- | instâncias do protocol pausado         | UPDATE pending futuras → 'skipped_paused' DENTRO da txn. Sem isto o usuário receberia lembrete do medicamento ANTIGO (o JS faz isso em `syncInstancesOnWrite`; a RPC não pode "esquecer" o par). |
-- | geração das instâncias do protocol novo| FORA da txn, best-effort (R-245): cron diário + `ensureInstancesUpTo` são a malha. A RPC não gera (o gerador é JS puro). |
-- | estoque                                | INTOCADO por design (PO-4 é F5): pausar congela as-is — "nada é apagado" (vocabulário 044). |
-- | intake_unit = 'cp' escrito em protocols| 🔴 CHECK `protocols_intake_unit_check` = ('gotas','ml','UI','mg') — NÃO aceita 'cp'! Em protocols, comprimido é intake_unit NULL (62/70 linhas em prod); titration_steps materializa 'cp' explícito (CHECK próprio + migração F2 `COALESCE(p.intake_unit,'cp')`). Fronteira N2→N1: `NULLIF(unit,'cp')`. Sem isso, TODA titulação de comprimido (metoprolol = o caso canônico do PO-3) aborta com 23514. Hoje passa por sorte: a única escada de prod é 'mg'. |
-- | frequency do protocol novo             | CHECK exige 'diário' COM acento (dado real: 59 linhas 'diário', 0 'diario' — a CLAUDE.md diz 'diario', o banco discorda). Fallback acentuado. |
-- | search_path injection                  | SET search_path = '' + tudo schema-qualificado (public./auth.). |
-- | overload de assinatura                 | AP-227: assinatura NOVA (não existia antes). DROP explícito da assinatura exata antes do CREATE (idempotência sem overload). |
-- | migração re-executada                  | Backfill guardado por `IS NULL`; CHECK por DROP/ADD; RPC por DROP/CREATE. Idempotente. |
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BACKFILL: protocol_id das etapas migradas do N1 (pré-requisito do cutover T014)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.titration_steps s
   SET protocol_id = t.migrated_from_protocol_id,
       updated_at  = now()
  FROM public.titrations t
 WHERE s.titration_id = t.id
   AND t.migrated_from_protocol_id IS NOT NULL
   AND s.protocol_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CON-031 aditivo: evento de transição da escada na trilha append-only existente
--    (dose_instance_id fica NULL — a transição é do TRATAMENTO, não de uma ocorrência).
--    R-271: o CHECK abaixo espelha CRITICAL_AUDIT_EVENTS em packages/core/src/schemas/
--    criticalAuditEventSchema.ts — os dois andam JUNTOS ou o insert falha em runtime.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.dose_critical_events
  DROP CONSTRAINT IF EXISTS dose_critical_events_event_check;
ALTER TABLE public.dose_critical_events
  ADD CONSTRAINT dose_critical_events_event_check CHECK (
    event = ANY (ARRAY[
      'alarm_scheduled', 'alarm_fired', 'alarm_suppressed', 'nag_fired', 'snoozed',
      'resolved', 'push_sent', 'push_failed', 'surface_transitioned',
      'push_skipped_no_token', 'token_captured',
      'titration_transitioned'
    ])
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC confirm_titration_switch — o comando "iniciar a etapa N"
-- ─────────────────────────────────────────────────────────────────────────────
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
    -- Troca de medicamento: pausa o anterior e ativa/cria o próximo.
    IF v_prev.protocol_id IS NOT NULL THEN
      UPDATE public.protocols
         SET active = false, paused_at = now()
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
  'adjacente. Estoque intocado (PO-4/F5). A geração das instâncias do protocol novo é best-effort '
  'fora da txn (R-245: cron diário + ensureInstancesUpTo).';

-- AP-278: REVOKE antes de qualquer GRANT. anon NUNCA executa RPC privilegiada que muta dado —
-- proteção por controle de acesso, não por acidente (auth.uid() NULL abortando lá dentro).
REVOKE EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERIFICAÇÃO (rodar após aplicar)
-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: zero etapas de escada migrada sem executor.
SELECT
  'backfill_protocol_id' AS verificacao,
  count(*) FILTER (WHERE s.protocol_id IS NULL) AS steps_sem_protocol,
  count(*)                                       AS steps_migrados,
  count(*) FILTER (WHERE s.protocol_id IS NULL) = 0 AS ok
FROM public.titration_steps s
JOIN public.titrations t ON t.id = s.titration_id
WHERE t.migrated_from_protocol_id IS NOT NULL;

-- Grants da RPC: authenticated sim, anon/PUBLIC não.
SELECT
  'grants_rpc' AS verificacao,
  has_function_privilege('authenticated', 'public.confirm_titration_switch(uuid)', 'EXECUTE') AS authenticated_pode,
  has_function_privilege('anon',          'public.confirm_titration_switch(uuid)', 'EXECUTE') AS anon_pode,
  has_function_privilege('authenticated', 'public.confirm_titration_switch(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.confirm_titration_switch(uuid)', 'EXECUTE') AS ok;

-- Assinatura única (AP-227: zero overload).
SELECT 'assinatura_unica' AS verificacao, count(*) AS n, count(*) = 1 AS ok
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'confirm_titration_switch';
