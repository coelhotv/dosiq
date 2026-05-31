-- 20260531_rewrite_adherence_views_dose_instances.sql
-- Fase 4 / G6 (S4.2b) — Reescreve a FONTE de v_daily_adherence e v_adherence_heatmap
-- de medicine_logs (inferência ±2h sobre schedule) → dose_instances (status real).
--
-- Mantém EXATAMENTE a mesma interface de saída (colunas/shape) que
-- Reports/PDF/Consultation/HealthHistory já consomem, e preserva a AGREGAÇÃO
-- NO SERVIDOR (R-249 — nunca mover long-range/heatmap pro client; mitigação OOM
-- em devices low-mid). O client segue recebendo ~28 linhas prontas.
--
-- Semântica (ADR-054 / R-248): adesão = taken / (taken + missed).
--   expected_doses = ocorrências DEVIDAS já resolvidas = count(taken)+count(missed)
--   taken_doses    = count(taken)
--   pending (futuro/não vencido) e skipped_* (neutro) ficam FORA do denominador.
--
-- 🐞 Mata AP-191: no legado, expected vinha só de protocols.active=true mas taken
-- contava TODOS os logs → protocolo finalizado saía do denominador e ficava no
-- numerador → adherence_percentage > 100% (sparkline "118%"). Aqui numerador e
-- denominador derivam da MESMA fonte/escopo (dose_instances) e há CLAMP 0-100.

-- ⚠️ SECURITY (AP-201): `CREATE OR REPLACE VIEW` RESETA o reloption `security_invoker`
-- para false (Postgres não o preserva). Sem `security_invoker=true` a view roda como
-- OWNER → bypassa a RLS de `dose_instances` (policy `user_id = auth.uid()`). Como o
-- client consome as views SEM filtro `user_id` (depende de RLS p/ escopar), a view
-- passaria a retornar TODOS os usuários → agregação errada no client + VAZAMENTO
-- cross-usuário. Toda view sobre tabela com RLS DEVE declarar `WITH (security_invoker = true)`.

-- ── v_daily_adherence ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_daily_adherence
WITH (security_invoker = true) AS
WITH inst AS (
  SELECT
    di.user_id,
    (di.scheduled_for AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::date AS log_date,
    di.status
  FROM public.dose_instances di
  LEFT JOIN public.user_settings us ON di.user_id = us.user_id
  WHERE di.status IN ('taken', 'missed')
)
SELECT
  user_id,
  log_date,
  count(*) AS expected_doses,
  count(*) FILTER (WHERE status = 'taken') AS taken_doses,
  CASE
    WHEN count(*) = 0 THEN NULL::numeric
    ELSE GREATEST(0, LEAST(100,
      round((count(*) FILTER (WHERE status = 'taken'))::numeric / count(*)::numeric * 100, 2)
    ))
  END AS adherence_percentage
FROM inst
GROUP BY user_id, log_date;

-- ── v_adherence_heatmap ──────────────────────────────────────────────────────
-- Janela de 90 dias (mesma do legado); agrupa por dia-da-semana × período do dia,
-- ambos derivados do scheduled_for no fuso do usuário.
CREATE OR REPLACE VIEW public.v_adherence_heatmap
WITH (security_invoker = true) AS
WITH inst AS (
  SELECT
    di.user_id,
    (EXTRACT(dow FROM (di.scheduled_for AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))))::int AS day_of_week,
    CASE
      WHEN EXTRACT(hour FROM (di.scheduled_for AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))) < 6 THEN 0
      WHEN EXTRACT(hour FROM (di.scheduled_for AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))) < 12 THEN 1
      WHEN EXTRACT(hour FROM (di.scheduled_for AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))) < 18 THEN 2
      ELSE 3
    END AS period_index,
    di.status
  FROM public.dose_instances di
  LEFT JOIN public.user_settings us ON di.user_id = us.user_id
  WHERE di.status IN ('taken', 'missed')
    AND di.scheduled_for >= (CURRENT_DATE - INTERVAL '90 days')
)
SELECT
  user_id,
  day_of_week,
  period_index,
  count(*) AS expected_doses,
  count(*) FILTER (WHERE status = 'taken') AS taken_doses,
  CASE
    WHEN count(*) = 0 THEN NULL::numeric
    ELSE GREATEST(0, LEAST(100,
      round((count(*) FILTER (WHERE status = 'taken'))::numeric / count(*)::numeric * 100, 2)
    ))
  END AS adherence_percentage
FROM inst
GROUP BY user_id, day_of_week, period_index;

-- ── Grants (CREATE OR REPLACE preserva ACL, re-afirmamos por segurança) ───────
GRANT SELECT ON public.v_daily_adherence TO authenticated;
GRANT SELECT ON public.v_daily_adherence TO service_role;
GRANT SELECT ON public.v_adherence_heatmap TO authenticated;
GRANT SELECT ON public.v_adherence_heatmap TO service_role;
