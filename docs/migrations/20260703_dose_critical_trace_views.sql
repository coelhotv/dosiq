-- Spec 042 — Views de debug do audit trail de dose crítica (dose_critical_events).
-- Aditivas, reversíveis, sem impacto de usuário. Aplicadas em prod via MCP em 2026-07-03.
-- security_invoker=on → herdam a RLS da tabela base: no app cada usuário vê só as próprias doses;
-- service_role/PO (SQL editor) vê tudo. Sem GRANT extra — herdam o SELECT de dose_critical_events.

-- 1. Trajetória linha-a-linha por dose, ordenada, com posição (seq) e tempo decorrido (elapsed)
--    desde o 1º evento da dose. Uso: debug fino de UMA dose ("por que o alarme não tocou?").
create or replace view public.v_dose_critical_trace
with (security_invoker = on) as
select
  e.dose_instance_id,
  row_number() over w                                             as seq,
  e.event,
  e.platform,
  e.actor,
  e.created_at,
  e.created_at - first_value(e.created_at) over w                 as elapsed,
  e.detail,
  e.user_id,
  e.id
from public.dose_critical_events e
where e.dose_instance_id is not null
window w as (partition by e.dose_instance_id order by e.created_at, e.id)
order by e.dose_instance_id, e.created_at, e.id;

-- 2. Resumo por dose (visão de pássaro): contagem, janela, sequência compacta de eventos, flags.
create or replace view public.v_dose_critical_summary
with (security_invoker = on) as
select
  dose_instance_id,
  count(*)                                                        as eventos,
  min(created_at)                                                 as inicio,
  max(created_at)                                                 as fim,
  max(created_at) - min(created_at)                               as duracao,
  string_agg(event, ' → ' order by created_at, id)                as trajetoria,
  bool_or(event = 'resolved')                                     as resolvida,
  bool_or(event = 'alarm_suppressed')                             as teve_suprimido,
  user_id
from public.dose_critical_events
where dose_instance_id is not null
group by dose_instance_id, user_id;

-- Uso:
--   select left(dose_instance_id::text,8) dose, eventos, trajetoria, resolvida, duracao
--     from public.v_dose_critical_summary order by fim desc;
--   select seq, event, platform, actor, elapsed, detail
--     from public.v_dose_critical_trace where dose_instance_id = '<uuid>' order by seq;

-- Rollback:
--   drop view if exists public.v_dose_critical_summary;
--   drop view if exists public.v_dose_critical_trace;
