-- 20260716_titrations_data_migration.sql — 029 Slice F2 / T008 (migração de DADOS N1→N2).
--
-- PROPÓSITO: materializar cada escada de titulação N1 (jsonb em `protocols.titration_schedule`)
-- como entidade N2 (`titrations` + `titration_steps`), SEM tocar o jsonb (read-only) e SEM motor.
-- O adapter dual-read (F2 T007) lê a entidade nova atrás da flag `TITRATION_SOURCE`; o cutover
-- dos consumers é F3. O jsonb N1 só é dropado no F6 (PO-SEC-4: rollback limpo até a validação).
--
-- ⚠️ NÃO APLICAR EM PROD sem aprovação do PO (regime clínico; base beta pequena). Rodar o
-- `.test.sql` (BEGIN..ROLLBACK) antes — PO-SEC-4.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- MAPA DE ESTADOS (ADR-080 / spec 029 §Migração de dados)
-- ─────────────────────────────────────────────────────────────────────────────
-- p.titration_status = 'titulando'      → etapas < current_stage_index = 'completed';
--                                          etapa == current_stage_index = 'current'
--                                          (started_at = p.stage_started_at); demais 'upcoming'.
-- p.titration_status = 'alvo_atingido'  → ÚLTIMA etapa = 'current' + CONTÍNUA (duration_days NULL,
--                                          started_at = p.stage_started_at); demais 'completed'.
--                                          (o adapter devolve null p/ etapa contínua vigente =
--                                           paridade com o legado 'alvo_atingido' → dose do protocol.)
-- p.titration_status = 'pausado' (etc.) → NENHUMA etapa 'current' (a escada acompanha o protocol);
--                                          etapas < current = 'completed'; demais 'upcoming'.
--
-- NORMALIZAÇÃO: duration_days := COALESCE(duration_days, days) — mata o fallback legado `days`
-- (visto em titrationUtils.getStageDurationDays) AQUI, não perpetua no motor N2.
-- MEDICINE: todas as etapas herdam p.medicine_id (N1 é intra-medicamento por construção).
-- UNIDADE: COALESCE(p.intake_unit, 'cp') — sólidos N1 têm intake_unit NULL; 'cp' fecha o CHECK.
-- USER: p.user_id (dono) — a FK composta (titration_id, user_id) exige coerência (AP-293).
-- IDEMPOTENTE: NOT EXISTS por migrated_from_protocol_id (escada) e por titration_id (etapas).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_eligible          int;
  v_titrations_before int;
  v_titrations_created int;
  v_steps_created     int;
BEGIN
  SELECT count(*) INTO v_eligible
  FROM public.protocols p
  WHERE p.titration_schedule IS NOT NULL
    AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
             THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0;

  SELECT count(*) INTO v_titrations_before
  FROM public.titrations WHERE migrated_from_protocol_id IS NOT NULL;

  RAISE NOTICE 'MIGRAÇÃO N1→N2 (audit PO-SEC-4) — ANTES: % protocolo(s) N1 com schedule; % escada(s) já migrada(s).',
    v_eligible, v_titrations_before;

  -- 1) uma escada por protocolo elegível (idempotente por migrated_from_protocol_id)
  INSERT INTO public.titrations (user_id, treatment_plan_id, migrated_from_protocol_id)
  SELECT p.user_id, p.treatment_plan_id, p.id
  FROM public.protocols p
  WHERE p.titration_schedule IS NOT NULL
    AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
             THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.titrations t WHERE t.migrated_from_protocol_id = p.id
    );
  GET DIAGNOSTICS v_titrations_created = ROW_COUNT;

  -- 2) etapas de cada escada recém-criada (idempotente: só escadas ainda sem etapas)
  INSERT INTO public.titration_steps
    (titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at)
  SELECT
    t.id,
    p.user_id,
    (stage.ord - 1)::int,
    p.medicine_id,
    (stage.val->>'dosage')::numeric,
    COALESCE(p.intake_unit, 'cp'),
    CASE
      WHEN p.titration_status = 'alvo_atingido' AND stage.ord = cnt.n THEN NULL  -- última contínua
      ELSE COALESCE((stage.val->>'duration_days')::int, (stage.val->>'days')::int)
    END,
    CASE
      WHEN p.titration_status = 'titulando' THEN
        CASE
          WHEN (stage.ord - 1) < COALESCE(p.current_stage_index, 0) THEN 'completed'
          WHEN (stage.ord - 1) = COALESCE(p.current_stage_index, 0) THEN 'current'
          ELSE 'upcoming'
        END
      WHEN p.titration_status = 'alvo_atingido' THEN
        CASE WHEN stage.ord = cnt.n THEN 'current' ELSE 'completed' END
      ELSE  -- 'pausado' e quaisquer outros: acompanha o protocol, sem etapa vigente própria
        CASE WHEN (stage.ord - 1) < COALESCE(p.current_stage_index, 0) THEN 'completed' ELSE 'upcoming' END
    END,
    CASE
      WHEN p.titration_status = 'titulando'
           AND (stage.ord - 1) = COALESCE(p.current_stage_index, 0) THEN p.stage_started_at
      WHEN p.titration_status = 'alvo_atingido' AND stage.ord = cnt.n THEN p.stage_started_at
      ELSE NULL
    END
  FROM public.titrations t
  JOIN public.protocols p ON p.id = t.migrated_from_protocol_id
  CROSS JOIN LATERAL jsonb_array_elements(p.titration_schedule) WITH ORDINALITY AS stage(val, ord)
  CROSS JOIN LATERAL (SELECT jsonb_array_length(p.titration_schedule) AS n) cnt
  WHERE t.migrated_from_protocol_id IS NOT NULL
    -- mesma salvaguarda do passo 1 (jsonb_array_elements aborta a migração em array inválido):
    AND p.titration_schedule IS NOT NULL
    AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
             THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.titration_steps s WHERE s.titration_id = t.id
    );
  GET DIAGNOSTICS v_steps_created = ROW_COUNT;

  RAISE NOTICE 'MIGRAÇÃO N1→N2 — DEPOIS: % escada(s) criada(s), % etapa(s) criada(s).',
    v_titrations_created, v_steps_created;

  -- Invariante de contagem (PO-SEC-4): toda escada N1 ainda-não-migrada virou uma titration.
  IF (v_titrations_before + v_titrations_created) <> v_eligible THEN
    RAISE EXCEPTION 'MIGRAÇÃO INCONSISTENTE: % elegível(is) <> % migrada(s) total.',
      v_eligible, (v_titrations_before + v_titrations_created);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (rodar após a migração; deve reportar ok=true em ambas as linhas)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT
  'contagem escadas = protocolos N1 com schedule' AS verificacao,
  (SELECT count(*) FROM public.protocols p
     WHERE p.titration_schedule IS NOT NULL
       AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
                THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0) AS protocolos_n1,
  (SELECT count(*) FROM public.titrations WHERE migrated_from_protocol_id IS NOT NULL) AS escadas_migradas,
  (SELECT count(*) FROM public.protocols p
     WHERE p.titration_schedule IS NOT NULL
       AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
                THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0)
   = (SELECT count(*) FROM public.titrations WHERE migrated_from_protocol_id IS NOT NULL) AS ok
UNION ALL
SELECT
  'toda etapa bate soma de estágios jsonb' AS verificacao,
  (SELECT COALESCE(sum(jsonb_array_length(p.titration_schedule)), 0)::int FROM public.protocols p
     WHERE p.titration_schedule IS NOT NULL
       AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
                THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0) AS estagios_jsonb,
  (SELECT count(*)::int FROM public.titration_steps s
     JOIN public.titrations t ON t.id = s.titration_id
     WHERE t.migrated_from_protocol_id IS NOT NULL) AS etapas_criadas,
  (SELECT COALESCE(sum(jsonb_array_length(p.titration_schedule)), 0) FROM public.protocols p
     WHERE p.titration_schedule IS NOT NULL
       AND CASE WHEN jsonb_typeof(p.titration_schedule) = 'array'
                THEN jsonb_array_length(p.titration_schedule) ELSE 0 END > 0)
   = (SELECT count(*) FROM public.titration_steps s
        JOIN public.titrations t ON t.id = s.titration_id
        WHERE t.migrated_from_protocol_id IS NOT NULL) AS ok;
