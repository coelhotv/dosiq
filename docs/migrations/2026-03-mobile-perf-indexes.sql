-- Sprint M3: Índices + View de Pré-Agregação Completa
-- Aplicado em: 2026-03-13
-- Supabase projeto: dosiq
-- Referência: plans/EXEC_SPEC_MOBILE_PERFORMANCE.md
--
-- OBJETIVO: Tirar TODA carga de processamento da main-thread do mobile
-- PROBLEMA: getDailyAdherence() no client processa N logs (O(N)) → trava no mobile mid-low tier
-- SOLUÇÃO: Índices + View pré-agregada que calcula tudo no servidor

-- ============================================================================
-- BLOCO 1: Índice de paginação principal (getAllPaginated + getAll)
-- ============================================================================
-- Suporta: WHERE user_id = X ORDER BY taken_at DESC LIMIT N
-- Impacto: Acelera query crítica do Timeline (30 últimos logs)
-- Antes: ~200ms (Seq Scan) | Depois: <10ms (Index Scan)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);

-- ============================================================================
-- BLOCO 2: Índice por protocolo (getByProtocol)
-- ============================================================================
-- Suporta: WHERE protocol_id = X ORDER BY taken_at DESC
-- Impacto: Acelera queries de protocolo individual

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_protocol_taken_at
ON medicine_logs (protocol_id, taken_at DESC);

-- ============================================================================
-- BLOCO 3A: View de adesão DIÁRIA (para Sparkline — últimos 30 dias)
-- ============================================================================
-- Pré-calcula adesão agregada POR DIA (todos os períodos somados)
-- Elimina O(N) do client: getDailyAdherence() em HealthHistory.jsx
-- Impacto: Sparkline renderiza em <50ms (antes: 100-200ms processamento JS)

CREATE OR REPLACE VIEW v_daily_adherence
WITH (security_invoker = on) AS
WITH logs_by_day AS (
  SELECT
    ml.user_id,
    (ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::date AS log_date,
    ml.id AS log_id
  FROM medicine_logs ml
  LEFT JOIN user_settings us ON ml.user_id = us.user_id
),
expected_doses_daily AS (
  -- CORRIGIDO: Contar o número de DOSES (time_schedule entries), não o número de protocolos
  -- Exemplo: se protocolo A tem ["08:00", "20:00"], são 2 doses esperadas, não 1
  SELECT
    p.user_id,
    generate_series(p.start_date::date, COALESCE(p.end_date::date, CURRENT_DATE), '1 day'::interval)::date AS active_date,
    jsonb_array_length(p.time_schedule) AS expected_count
  FROM protocols p
  WHERE p.active = true
    AND p.start_date IS NOT NULL
    AND p.time_schedule IS NOT NULL
    AND jsonb_array_length(p.time_schedule) > 0
  GROUP BY p.user_id, p.id, active_date
),
expected_aggregated AS (
  -- IMPORTANTE: SUM(expected_count) soma as time_schedule entries por protocolo
  -- Exemplo: 10 protocolos com [2,1,1,1,1,1,1,1,1,1] time_schedule entries = SUM = 12
  SELECT
    user_id,
    active_date,
    SUM(expected_count) AS total_expected
  FROM expected_doses_daily
  GROUP BY user_id, active_date
)
SELECT
  l.user_id,
  l.log_date,
  COALESCE(e.total_expected, 0) AS expected_doses,
  COUNT(DISTINCT l.log_id) AS taken_doses,
  CASE
    WHEN COALESCE(e.total_expected, 0) = 0 THEN NULL
    ELSE ROUND((COUNT(DISTINCT l.log_id)::numeric / e.total_expected) * 100, 2)
  END AS adherence_percentage
FROM logs_by_day l
LEFT JOIN expected_aggregated e ON l.user_id = e.user_id AND l.log_date = e.active_date
GROUP BY l.user_id, l.log_date, e.total_expected;

-- ============================================================================
-- BLOCO 3B: View de adesão HEATMAP (por dia_semana × período do dia)
-- ============================================================================
-- Pré-calcula adesão por (dia_semana, período_do_dia) — grid 7×4
-- Elimina O(N) do analyzeAdherencePatterns(): heatmap renderiza instantâneo
-- Impacto: AdherenceHeatmap.jsx O(N) → O(1) lookup, sem main-thread blocking
-- CORREÇÃO: Expande doses esperadas por frequência (diário/semanal/dias_alternados)

CREATE OR REPLACE VIEW v_adherence_heatmap
WITH (security_invoker = on) AS
WITH logs_classified AS (
  SELECT
    ml.user_id,
    EXTRACT(DOW FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::int AS day_of_week,
    CASE
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 6 THEN 0
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 12 THEN 1
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 18 THEN 2
      ELSE 3
    END AS period_index,
    ml.id AS log_id
  FROM medicine_logs ml
  LEFT JOIN user_settings us ON ml.user_id = us.user_id
),
protocol_schedule_expanded AS (
  -- Expandir cada protocolo em TODOS os dias da semana que ele é relevante (conforme frequência)
  SELECT
    p.id,
    p.user_id,
    schedule_time,
    day AS day_of_week
  FROM protocols p
  CROSS JOIN LATERAL jsonb_array_elements_text(p.time_schedule) AS schedule_time
  CROSS JOIN generate_series(0, 6) AS day
  WHERE p.active = true
    AND p.start_date IS NOT NULL
    AND p.time_schedule IS NOT NULL
    AND jsonb_array_length(p.time_schedule) > 0
    -- Filtrar dias relevantes por frequência
    AND (
      -- Diário: todos os 7 dias
      (p.frequency IN ('diário', 'daily', 'diariamente'))
      -- Semanal: apenas o day_of_week do start_date
      OR (p.frequency IN ('semanal', 'weekly', 'semanalmente') AND day = EXTRACT(DOW FROM p.start_date::timestamp)::int)
      -- Dias alternados: day_of_week e (day_of_week + 2) % 7
      OR (p.frequency IN ('dias_alternados', 'day_sim_day_nao', 'dia sim, dia não')
          AND day IN (EXTRACT(DOW FROM p.start_date::timestamp)::int, (EXTRACT(DOW FROM p.start_date::timestamp)::int + 2) % 7))
    )
),
expected_per_period AS (
  -- CORRIGIDO: Contar o número de DOSES (schedule_time entries), não o número de protocolos
  -- protocol_schedule_expanded já expande cada protocolo por cada time_schedule entry
  -- Então COUNT(*) = número total de dose opportunities, não COUNT(DISTINCT p.id) = protocolos
  SELECT
    p.user_id,
    p.day_of_week,
    CASE
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 6 THEN 0
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 12 THEN 1
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 18 THEN 2
      ELSE 3
    END AS period_index,
    COUNT(*) AS expected_count
  FROM protocol_schedule_expanded p
  GROUP BY p.user_id, p.day_of_week, period_index
)
SELECT
  l.user_id,
  l.day_of_week,
  l.period_index,
  COALESCE(e.expected_count, 0) AS expected_doses,
  COUNT(DISTINCT l.log_id) AS taken_doses,
  CASE
    WHEN COALESCE(e.expected_count, 0) = 0 THEN NULL
    WHEN COUNT(DISTINCT l.log_id) = 0 THEN 0
    ELSE ROUND((COUNT(DISTINCT l.log_id)::numeric / e.expected_count) * 100, 2)
  END AS adherence_percentage
FROM logs_classified l
LEFT JOIN expected_per_period e
  ON l.user_id = e.user_id
  AND l.day_of_week = e.day_of_week
  AND l.period_index = e.period_index
GROUP BY l.user_id, l.day_of_week, l.period_index, e.expected_count;

-- ============================================================================
-- FIM DA MIGRAÇÃO M3
-- ============================================================================
-- Total de mudanças:
-- - 2 índices compostos para acelerar queries no Supabase
-- - 2 views de pré-agregação server-side (protocols ⨝ medicine_logs)
--   → v_daily_adherence: adesão por dia (para Sparkline)
--   → v_adherence_heatmap: adesão por (dia_semana, período) — grid 7×4 (para Heatmap)
--
-- Impacto esperado:
-- - Timeline query: ~200ms (Seq Scan) → <10ms (Index Scan)
-- - Sparkline: getDailyAdherence() O(N) → O(1) lookup na v_daily_adherence
-- - Heatmap: analyzeAdherencePatterns() O(N) → O(1) lookup na v_adherence_heatmap
-- - Resultado: ZERO processamento no mobile — HealthHistory.jsx não trava
-- ============================================================================
