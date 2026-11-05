-- Spec 115 — Growth Analytics & Treatment Wedge Dashboard (FR-001).
--
-- public.get_admin_growth_analytics(p_limit, p_offset, p_excluded_user_ids) → jsonb
--   Uma ida ao banco para o painel admin (`api/admin.ts?resource=growth`). Só leitura (STABLE).
--
-- Decisões que o SQL materializa (spec §10/§11, analysis.md):
--   · Unidade principal = usuário distinto (INV-5); tratamentos são métrica secundária.
--   · Universo de protocolos = archived_at IS NULL; pausados contam (D-REV-5).
--   · Wedge por PREFIXO de therapeutic_class_code, nunca por texto de classe (INV-4). A lista
--     espelha WEDGE_CLASS_PREFIXES do core — wedgeParity.test.ts lê a linha marcada abaixo.
--   · Titulação = existe etapa em titration_steps (as colunas N1 de protocols estão mortas — 029 F6).
--   · Estoque por tratamento = o medicamento do protocolo tem ≥1 linha em stock (D-AN-1).
--   · Plataformas usadas (D-AN-2 / FR-011) = device_activity ∪ notification_devices ∪ user-agent de
--     auth.sessions classificado aqui (iOS app · Android app · Web). O logout do app apaga as duas
--     primeiras (spec 095); a sessão no servidor sobrevive (`signOut({ scope: 'local' })`).
--   · Push ativo = notification_devices ativo com provider expo/webpush (apns_liveactivity é token
--     de Live Activity, não push).
--   · Contas excluídas (p_excluded_user_ids) saem de TODA CTE, numerador e denominador (PO-115-8).
--
-- 🔴 Privacidade (INV-2 / SC-004): medicines.name NUNCA é lido. De auth.users só id, created_at e
--    last_sign_in_at; de auth.sessions só user_id, user_agent e updated_at — a linha também guarda
--    material de token e IP (RC-SEC S-2/S-9). E-mail vem de public.user_emails. O user-agent é
--    texto do cliente: só é comparado com prefixos fixos e nunca sai da função (S-10).
-- 🔴 SECURITY DEFINER com search_path vazio e nomes qualificados (RC-SEC S-1). EXECUTE só para
--    service_role (ADR-119 / INV-3): anon e authenticated não chamam pelo PostgREST.
--
-- Prova: 20261103_admin_growth_analytics.test.sql (QA primeiro, termina em RAISE — nada sobra).

CREATE OR REPLACE FUNCTION public.get_admin_growth_analytics(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_excluded_user_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
WITH params AS (
  SELECT
    least(greatest(coalesce(p_limit, 100), 1), 500) AS lim,
    greatest(coalesce(p_offset, 0), 0) AS offs,
    coalesce(p_excluded_user_ids, '{}'::uuid[]) AS excl,
    -- WEDGE_CLASS_PREFIXES (espelho de packages/core/src/services/trackedMeasure.ts)
    ARRAY['A10S', 'A10X9', 'A8A']::text[] AS wedge
),
base_users AS (
  SELECT u.id AS user_id, u.created_at, u.last_sign_in_at,
         (u.created_at >= now() - interval '30 days') AS is_cohort30
  FROM auth.users u CROSS JOIN params p
  WHERE NOT (u.id = ANY (p.excl))
),
excluded AS (
  SELECT count(*)::int AS n FROM auth.users u CROSS JOIN params p WHERE u.id = ANY (p.excl)
),
live_protocols AS (
  SELECT
    pr.id AS protocol_id,
    pr.user_id,
    pr.name AS protocol_name,
    pr.frequency,
    nullif(upper(trim(m.therapeutic_class_code)), '') AS class_code,
    m.therapeutic_class AS class_label,
    EXISTS (SELECT 1 FROM public.titration_steps ts WHERE ts.protocol_id = pr.id) AS has_titration,
    nullif(coalesce(pr.tracked_measure, 'nenhum'), 'nenhum') AS tracked_measure,
    coalesce(pr.critical_alarm, false) AS has_critical_alarm,
    (pr.medicine_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.stock s WHERE s.medicine_id = pr.medicine_id)) AS has_stock,
    (pr.end_date IS NOT NULL) AS has_end_date,
    bu.is_cohort30
  FROM public.protocols pr
  JOIN base_users bu ON bu.user_id = pr.user_id
  LEFT JOIN public.medicines m ON m.id = pr.medicine_id
  WHERE pr.archived_at IS NULL
),
classified AS (
  SELECT lp.*,
    CASE
      WHEN lp.class_code IS NULL THEN 'sem_codigo'
      WHEN EXISTS (SELECT 1 FROM params p, unnest(p.wedge) w WHERE lp.class_code LIKE w || '%') THEN 'glp1_antiobesidade'
      WHEN lp.class_code LIKE 'A10%' THEN 'antidiabeticos_outros'
      ELSE 'outras'
    END AS wedge_bucket
  FROM live_protocols lp
),
denoms AS (
  SELECT
    count(DISTINCT user_id)::int AS users_all,
    count(*)::int AS protocols_all,
    count(DISTINCT user_id) FILTER (WHERE is_cohort30)::int AS users_c30,
    count(*) FILTER (WHERE is_cohort30)::int AS protocols_c30
  FROM classified
),
push_users AS (
  SELECT DISTINCT nd.user_id
  FROM public.notification_devices nd
  JOIN base_users bu ON bu.user_id = nd.user_id
  WHERE nd.is_active AND nd.provider IN ('expo', 'webpush')
),
feature_rows AS (
  SELECT c.user_id, c.is_cohort30, f.feature, f.enabled
  FROM classified c
  CROSS JOIN LATERAL (VALUES
    ('titration', c.has_titration),
    ('biomarker', c.tracked_measure IS NOT NULL),
    ('critical_alarm', c.has_critical_alarm),
    ('stock', c.has_stock),
    ('end_date', c.has_end_date)
  ) AS f(feature, enabled)
),
feature_rates AS (
  SELECT fr.feature,
    count(DISTINCT fr.user_id) FILTER (WHERE fr.enabled)::int AS users,
    count(*) FILTER (WHERE fr.enabled)::int AS protocols,
    count(DISTINCT fr.user_id) FILTER (WHERE fr.enabled AND fr.is_cohort30)::int AS users_c30,
    count(*) FILTER (WHERE fr.enabled AND fr.is_cohort30)::int AS protocols_c30
  FROM feature_rows fr
  GROUP BY fr.feature
),
platform_events AS (
  SELECT da.user_id, da.platform, da.last_seen_at AS seen_at
  FROM public.device_activity da JOIN base_users bu ON bu.user_id = da.user_id
  UNION ALL
  SELECT nd.user_id, nd.platform, nd.last_seen_at
  FROM public.notification_devices nd JOIN base_users bu ON bu.user_id = nd.user_id
  UNION ALL
  SELECT ses.user_id,
    CASE
      WHEN ses.user_agent LIKE 'Dosiq/%CFNetwork%' THEN 'ios'
      WHEN ses.user_agent LIKE 'okhttp/%' THEN 'android'
      WHEN ses.user_agent LIKE 'Mozilla/%' THEN 'web'
    END,
    ses.updated_at
  FROM auth.sessions ses JOIN base_users bu ON bu.user_id = ses.user_id
),
users_page AS (
  SELECT bu.* FROM base_users bu
  ORDER BY bu.created_at DESC, bu.user_id
  LIMIT (SELECT lim FROM params) OFFSET (SELECT offs FROM params)
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'excluded_count', (SELECT n FROM excluded),
  'total_users', (SELECT count(*)::int FROM base_users),
  'totals', (
    SELECT jsonb_build_object(
      'users', (SELECT count(*)::int FROM base_users),
      'new_7d', (SELECT count(*)::int FROM base_users WHERE created_at >= now() - interval '7 days'),
      'new_30d', (SELECT count(*)::int FROM base_users WHERE is_cohort30),
      'users_with_protocols', d.users_all,
      'protocols', d.protocols_all,
      'push_active_users', (SELECT count(*)::int FROM push_users),
      'push_active_pct', coalesce(round(100.0 * (SELECT count(*) FROM push_users) / nullif((SELECT count(*) FROM base_users), 0), 1), 0),
      'stock_users_pct', coalesce(round(100.0 * (SELECT users FROM feature_rates WHERE feature = 'stock') / nullif(d.users_all, 0), 1), 0),
      'critical_alarm_users_pct', coalesce(round(100.0 * (SELECT users FROM feature_rates WHERE feature = 'critical_alarm') / nullif(d.users_all, 0), 1), 0)
    ) FROM denoms d
  ),
  'class_distribution', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'class_code', g.code, 'label', g.label, 'wedge', g.bucket,
      'users', g.users, 'protocols', g.protocols,
      'users_pct', coalesce(round(100.0 * g.users / nullif(d.users_all, 0), 1), 0)
    ) ORDER BY g.users DESC, g.protocols DESC, g.code)
    FROM (
      SELECT coalesce(class_code, 'sem_codigo') AS code,
             mode() WITHIN GROUP (ORDER BY class_label) AS label,
             min(wedge_bucket) AS bucket,
             count(DISTINCT user_id)::int AS users, count(*)::int AS protocols
      FROM classified GROUP BY coalesce(class_code, 'sem_codigo')
    ) g CROSS JOIN denoms d
  ), '[]'::jsonb),
  'wedge', (
    SELECT jsonb_object_agg(b.bucket, jsonb_build_object(
      'users', coalesce(w.users, 0), 'protocols', coalesce(w.protocols, 0),
      'users_pct', coalesce(round(100.0 * w.users / nullif(d.users_all, 0), 1), 0)
    ))
    FROM (VALUES ('glp1_antiobesidade'), ('antidiabeticos_outros'), ('outras'), ('sem_codigo')) AS b(bucket)
    CROSS JOIN denoms d
    LEFT JOIN (
      SELECT wedge_bucket, count(DISTINCT user_id)::int AS users, count(*)::int AS protocols
      FROM classified GROUP BY wedge_bucket
    ) w ON w.wedge_bucket = b.bucket
  ),
  'frequency_distribution', coalesce((
    SELECT jsonb_agg(jsonb_build_object('frequency', f.frequency, 'users', f.users, 'protocols', f.protocols)
      ORDER BY f.protocols DESC, f.frequency)
    FROM (
      SELECT frequency, count(DISTINCT user_id)::int AS users, count(*)::int AS protocols
      FROM classified GROUP BY frequency
    ) f
  ), '[]'::jsonb),
  'feature_rates', (
    SELECT jsonb_agg(jsonb_build_object(
      'feature', k.feature,
      'users', coalesce(r.users, 0), 'protocols', coalesce(r.protocols, 0),
      'users_pct', coalesce(round(100.0 * r.users / nullif(d.users_all, 0), 1), 0),
      'protocols_pct', coalesce(round(100.0 * r.protocols / nullif(d.protocols_all, 0), 1), 0),
      'cohort30', jsonb_build_object(
        'users', coalesce(r.users_c30, 0), 'protocols', coalesce(r.protocols_c30, 0),
        'users_pct', coalesce(round(100.0 * r.users_c30 / nullif(d.users_c30, 0), 1), 0),
        'protocols_pct', coalesce(round(100.0 * r.protocols_c30 / nullif(d.protocols_c30, 0), 1), 0)
      )
    ) ORDER BY k.ord)
    FROM (VALUES (1, 'titration'), (2, 'biomarker'), (3, 'critical_alarm'), (4, 'stock'), (5, 'end_date')) AS k(ord, feature)
    CROSS JOIN denoms d
    LEFT JOIN feature_rates r ON r.feature = k.feature
  ),
  'denominators', (SELECT to_jsonb(d) FROM denoms d),
  'users', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', up.user_id,
      'email', (SELECT ue.email FROM public.user_emails ue WHERE ue.id = up.user_id),
      'created_at', up.created_at,
      'last_activity_at', greatest(up.last_sign_in_at,
        (SELECT max(da.last_seen_at) FROM public.device_activity da WHERE da.user_id = up.user_id)),
      'platforms', coalesce((
        SELECT jsonb_agg(DISTINCT pe.platform ORDER BY pe.platform)
        FROM platform_events pe WHERE pe.user_id = up.user_id AND pe.platform IS NOT NULL
      ), '[]'::jsonb),
      'platform', (
        SELECT pe.platform FROM platform_events pe
        WHERE pe.user_id = up.user_id AND pe.platform IS NOT NULL
        ORDER BY pe.seen_at DESC NULLS LAST LIMIT 1
      ),
      'app_version', coalesce(dev.app_version, nd.app_version),
      'push_active', EXISTS (SELECT 1 FROM push_users pu WHERE pu.user_id = up.user_id),
      'onboarding_completed', coalesce((SELECT bool_or(us.onboarding_completed) FROM public.user_settings us WHERE us.user_id = up.user_id), false),
      'protocols_count', (SELECT count(*)::int FROM classified c WHERE c.user_id = up.user_id),
      'treatments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'protocol_id', c.protocol_id,
          'protocol_name', c.protocol_name,
          'therapeutic_class', c.class_label,
          'therapeutic_class_code', c.class_code,
          'wedge', c.wedge_bucket,
          'frequency', c.frequency,
          'features', jsonb_build_object(
            'titration', c.has_titration,
            'tracked_measure', c.tracked_measure,
            'critical_alarm', c.has_critical_alarm,
            'stock', c.has_stock,
            'end_date', c.has_end_date
          )
        ) ORDER BY c.protocol_name)
        FROM classified c WHERE c.user_id = up.user_id
      ), '[]'::jsonb)
    ) ORDER BY up.created_at DESC, up.user_id)
    FROM users_page up
    LEFT JOIN LATERAL (
      SELECT da.app_version FROM public.device_activity da
      WHERE da.user_id = up.user_id ORDER BY da.last_seen_at DESC NULLS LAST LIMIT 1
    ) dev ON true
    LEFT JOIN LATERAL (
      SELECT x.app_version FROM public.notification_devices x
      WHERE x.user_id = up.user_id ORDER BY x.last_seen_at DESC NULLS LAST LIMIT 1
    ) nd ON true
  ), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.get_admin_growth_analytics(integer, integer, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_growth_analytics(integer, integer, uuid[]) TO service_role;
