-- 20261003_report_dose_days.sql — spec 097 Slice A1 · ADR-105 (emendas 2026-10-03) · R-249 · AP-186
-- Agregado de doses do relatório clínico: tratamento × dia local × horário.
--
-- PROBLEMA: a faixa diária por tratamento (DESIGN_DECISOES §3.4) precisa das ocorrências por
--   tratamento, dia e horário. `v_daily_adherence` agrupa só por dia (sem protocol_id), e a leitura
--   crua de dose_instances passa de 1000 linhas em 180 dias (2.441 na conta polifarmácia; AP-186).
--
-- FIX: uma RPC SECURITY INVOKER (herda a RLS) que devolve contagens por status, sem calcular
--   percentual — a regra de adesão (ADR-054: taken/(taken+missed), skipped_* neutro) fica no core.
--   Dia local = mesmo fuso de `v_daily_adherence` e do gerador (user_settings.timezone; ADR-049).
--   Sem parâmetro de fuso nem de usuário (C-1 do A1; PO-SEC-2).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                              | Análise / mitigação                                 |
-- |-----------------------------------|-----------------------------------------------------|
-- | p_from / p_to NULL                | RAISE 22004 — nunca janela implícita.         PASS  |
-- | p_from > p_to                     | RAISE 22023.                                  PASS  |
-- | janela > 186 dias                 | RAISE 22023 (períodos fixos ≤ 180; RC2-D4).   PASS  |
-- | janela sem instância              | 0 linhas, sem erro.                           PASS  |
-- | user_settings ausente / tz NULL   | COALESCE 'America/Sao_Paulo' (= view).        PASS  |
-- | protocol_id NULL                  | impossível: NOT NULL na coluna (banco 03/10). PASS  |
-- | linha do piloto `…0001`           | impossível: FK user_id → auth.users; e WHERE   |
-- |                                   | user_id = auth.uid() explícito.               PASS  |
-- | divisor                           | nenhum: só contagens.                         PASS  |
-- | anon (auth.uid() NULL)            | sem EXECUTE (REVOKE PUBLIC/anon); e WHERE     |
-- |                                   | user_id = NULL não casa nada.                 PASS  |
-- | política legada permissiva        | WHERE user_id = (select auth.uid()) explícito. PASS |
-- | borda 23h30 -03                   | AT TIME ZONE tz antes do ::date.              PASS  |
-- | slot com segundos                 | to_char HH24:MI.                              PASS  |
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.report_dose_days(p_from date, p_to date)
RETURNS TABLE (
  protocol_id    uuid,
  medicine_id    uuid,
  day            date,
  slot           text,
  taken_count    integer,
  missed_count   integer,
  paused_count   integer,
  skipped_count  integer,
  pending_count  integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_tz  text;
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'report_dose_days: período obrigatório' USING ERRCODE = '22004';
  END IF;
  IF p_from > p_to THEN
    RAISE EXCEPTION 'report_dose_days: início depois do fim' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > 186 THEN
    RAISE EXCEPTION 'report_dose_days: período acima de 186 dias' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(us.timezone, 'America/Sao_Paulo') INTO v_tz
    FROM public.user_settings us WHERE us.user_id = v_uid;
  v_tz := COALESCE(v_tz, 'America/Sao_Paulo');

  RETURN QUERY
  WITH inst AS (
    SELECT di.protocol_id,
           di.medicine_id,
           (di.scheduled_for AT TIME ZONE v_tz)::date        AS day,
           to_char(di.scheduled_for AT TIME ZONE v_tz, 'HH24:MI') AS slot,
           di.status
      FROM public.dose_instances di
     WHERE di.user_id = v_uid
       -- janela em instantes (usa o índice de scheduled_for), recortada de novo pelo dia local
       AND di.scheduled_for >= (p_from::timestamp AT TIME ZONE v_tz) - interval '1 day'
       AND di.scheduled_for <  ((p_to + 1)::timestamp AT TIME ZONE v_tz) + interval '1 day'
  )
  SELECT i.protocol_id,
         i.medicine_id,
         i.day,
         i.slot,
         count(*) FILTER (WHERE i.status = 'taken')::integer,
         count(*) FILTER (WHERE i.status = 'missed')::integer,
         count(*) FILTER (WHERE i.status = 'skipped_paused')::integer,
         count(*) FILTER (WHERE i.status = 'skipped_user')::integer,
         count(*) FILTER (WHERE i.status = 'pending')::integer
    FROM inst i
   WHERE i.day BETWEEN p_from AND p_to
   GROUP BY i.protocol_id, i.medicine_id, i.day, i.slot
   ORDER BY i.day, i.slot, i.protocol_id;
END;
$$;

COMMENT ON FUNCTION public.report_dose_days(date, date) IS
  'Spec 097/ADR-105: contagens de dose_instances do chamador por tratamento × dia local × horário (fuso de user_settings). Sem percentual: adesão é do core (ADR-054).';

REVOKE EXECUTE ON FUNCTION public.report_dose_days(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_dose_days(date, date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.report_dose_days(date, date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.report_dose_days(date, date) TO service_role;
