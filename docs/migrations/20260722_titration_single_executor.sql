-- ═══════════════════════════════════════════════════════════════════════════════
-- 20260722 · confirm_titration_switch — EXECUTOR ÚNICO (spec 052 Slice C · ADR-085)
--
-- O QUE MUDA
--   `medicine_switch` deixa de CRIAR um `protocols` novo e de ENCERRAR o anterior. Passa a
--   MUTAR o executor vigente (`medicine_id`, `dosage_per_intake`, `intake_unit`), exatamente
--   como o `dose_change` já fazia. Os dois ramos colapsam num só: o tipo de transição vira
--   rótulo de AUDITORIA, não bifurcação de escrita.
--
--   Removidos deste caminho:
--     · INSERT INTO public.protocols (nasce executor por medicamento)
--     · UPDATE ... SET active=false, paused_at=now(), end_date=... (encerra o anterior)
--     · UPDATE dose_instances SET status='skipped_paused' (par obrigatório da pausa)
--   O slice REMOVE mais do que adiciona.
--
-- POR QUE SÓ AGORA
--   A titulação criar um `protocols` por medicamento nunca foi modelagem — era NECESSIDADE:
--   com a identidade da dose resolvida por join, mutar `protocols.medicine_id` reescreveria o
--   histórico agendado inteiro. Os Slices A (congelar a escrita em `dose_instances.medicine_id`)
--   e B (mover a leitura para o snapshot) removeram essa necessidade. Sem este slice a 052
--   entrega correção clínica sem nenhuma mudança perceptível ao paciente.
--
-- CONSEQUÊNCIA PARA O USUÁRIO (a entrega de UX da spec)
--   Trocar de concentração continua sendo O MESMO tratamento. A lista deixa de virar pilha de
--   tratamentos encerrados; "meu Mounjaro" tem uma história só. A janela de 24h do "pausado" e
--   o risco de dois executores simultâneos deixam de ser REPRESENTÁVEIS — não por correção de
--   borda, mas por não existir mais protocolo antigo.
--
-- VÍNCULO DA ESCADA (FR-009 · AP-311 · PO-9)
--   A RPC passa a vincular TODAS as etapas da escada ao executor único, não só a confirmada.
--   Hoje o fio escada↔tratamento vive numa única linha "sorteada" de `titration_steps`; apagar
--   essa linha orfana a escada e a leitura devolve `[]` — VAZIO indistinguível de "não há
--   escada", falha silenciosa medida em prod em 2026-07-20. Com N vínculos idênticos, apagar
--   qualquer subconjunto de etapas nunca deixa a escada sem fio.
--
-- CONTRATO (CON-032 — quebra, coberta por ADR-085)
--   Assinatura e reasons INALTERADOS. Muda a SEMÂNTICA do retorno:
--     · `protocol_activated` deixa de poder significar "protocolo recém-criado"; é SEMPRE o
--       executor vigente do tratamento.
--     · `protocol_paused` é SEMPRE null (a chave permanece por compatibilidade dos 3 chamadores).
--     · `titration_steps.protocol_id` perde o estado NULL transitório.
--
-- DADO EXISTENTE
--   Trocas ANTERIORES a esta migração já criaram protocolos separados. Medido em prod
--   (2026-07-20): ZERO protocolos duplicados — os 3 do smoke foram apagados pelo PO. Nenhuma
--   migração de dados necessária. O caminho de criação sobrevive apenas como último recurso,
--   para escada legada sem NENHUM executor vinculado.
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

  -- Tipo DERIVADO na execução (ADR-080 §2 / trace §A4), nunca congelado no push.
  -- 🆕 052 Slice C: continua derivado, mas agora é RÓTULO DE AUDITORIA — as duas transições
  -- executam a MESMA escrita (mutar o executor vigente). Quem quiser saber o que mudou lê
  -- `dose_critical_events`, não o formato do dado.
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

  -- ══ EXECUTOR ÚNICO (protocols) ═════════════════════════════════════════════
  -- Resolve o executor do TRATAMENTO, não da etapa: anterior → desta etapa → qualquer etapa da
  -- escada que ainda carregue o fio. O terceiro COALESCE é o que salva a escada legada cuja
  -- única etapa vinculada foi apagada (AP-311) — sem ele, ela cairia no caminho de criação e
  -- nasceria um executor duplicado justamente no cenário que este slice existe para matar.
  v_protocol_id := COALESCE(
    v_prev.protocol_id,
    v_step.protocol_id,
    (SELECT ts.protocol_id
       FROM public.titration_steps ts
      WHERE ts.titration_id = v_step.titration_id
        AND ts.user_id = v_user_id
        AND ts.protocol_id IS NOT NULL
      ORDER BY ts.position
      LIMIT 1)
  );

  IF v_protocol_id IS NOT NULL THEN
    -- 🔴 O CORAÇÃO DO SLICE C: um único UPDATE, para qualquer tipo de transição.
    -- `medicine_id` muda junto — o que só é seguro porque `dose_instances.medicine_id`
    -- (Slice A) e `medicine_logs.medicine_id` congelam o passado. Sem os Slices A/B esta
    -- linha reescreveria o histórico clínico inteiro (é literalmente a R-299).
    --
    -- `active`/`paused_at`/`end_date` são LIMPOS porque o executor pode ter sido encerrado
    -- por uma troca ANTERIOR a este slice: sem isto ele seguiria executando já finalizado
    -- (`resolveTreatmentStatus` faz FINALIZADO vencer sobre `active`).
    UPDATE public.protocols
       SET medicine_id       = v_step.medicine_id,
           dosage_per_intake = v_step.dose,
           intake_unit       = NULLIF(v_step.intake_unit, 'cp'),  -- fronteira N2→N1 (CON-032 §5)
           active            = true,
           paused_at         = NULL,
           end_date          = NULL
     WHERE id = v_protocol_id AND user_id = v_user_id;

    -- Legado: instâncias futuras pausadas por uma troca ANTERIOR a este slice. O upsert
    -- idempotente do gerador não as reverteria sozinho. Nunca toca passado nem não-pending.
    UPDATE public.dose_instances
       SET status = 'pending'
     WHERE protocol_id = v_protocol_id
       AND status = 'skipped_paused'
       AND scheduled_for > now();
  ELSE
    -- ÚLTIMO RECURSO: escada legada sem NENHUM executor vinculado em nenhuma etapa. Não há
    -- o que mutar, então o executor nasce aqui. Não é o caminho normal — escada cadastrada
    -- pelo app (`createFullLadder`) já nasce com todas as etapas vinculadas (FR-009/T026).
    --
    -- ⚠️ `v_prev_protocol` é NULL aqui, SEMPRE — e isso é correto, não um esquecimento. Antes,
    -- ele vinha do `RETURNING` do UPDATE que pausava o executor anterior; esse bloco foi
    -- removido. Mas chegar neste ELSE significa que o COALESCE acima não achou executor em
    -- NENHUMA etapa da escada — ou seja, não existe protocolo anterior de quem herdar
    -- agendamento. Os COALESCE abaixo ficam por isso: caem nos defaults (nome do medicamento,
    -- 'diário', `[]`) porque não há fonte melhor, não porque a fonte foi perdida.
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
      NULLIF(v_step.intake_unit, 'cp'),
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

  -- ══ VÍNCULO ESCADA↔TRATAMENTO (FR-009 · AP-311) ════════════════════════════
  -- TODA etapa aponta para o executor único — não só a confirmada. Com N vínculos idênticos,
  -- apagar qualquer subconjunto de etapas editáveis nunca orfana a escada.
  UPDATE public.titration_steps
     SET protocol_id = v_protocol_id, updated_at = now()
   WHERE titration_id = v_step.titration_id
     AND user_id = v_user_id
     AND protocol_id IS DISTINCT FROM v_protocol_id;

  -- ══ AUDITORIA (CON-031 aditivo) ════════════════════════════════════════════
  -- dose_instance_id NULL: a transição é do tratamento, não de uma ocorrência de dose.
  -- `protocol_paused` permanece na chave (compat dos 3 chamadores) e é SEMPRE null: com
  -- executor único não existe protocolo anterior para pausar.
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
      'protocol_paused',     NULL,
      'previous_step_id',    v_prev.id
    )
  );

  RETURN jsonb_build_object(
    'success',            true,
    'already_confirmed',  false,
    'transition',         v_transition,
    'step_id',            v_step.id,
    'protocol_activated', v_protocol_id,
    'protocol_paused',    NULL
  );
END;
$$;

-- ══ GRANTS (docs/standards/SUPABASE_MIGRATIONS.md) ═══════════════════════════
-- SECURITY DEFINER + `search_path = ''`: só quem está autenticado chama; anon é barrado no
-- REVOKE e, em defesa em profundidade, pelo guard de `auth.uid()` no topo da função.
REVOKE ALL ON FUNCTION public.confirm_titration_switch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_titration_switch(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) TO service_role;

COMMENT ON FUNCTION public.confirm_titration_switch(uuid) IS
  'Confirma etapa de titulação mutando o EXECUTOR ÚNICO do tratamento (spec 052 Slice C, '
  'ADR-085). Não cria nem encerra protocolos. Vincula todas as etapas da escada ao executor '
  '(FR-009, AP-311). Retorno: protocol_activated = executor vigente; protocol_paused sempre null.';
