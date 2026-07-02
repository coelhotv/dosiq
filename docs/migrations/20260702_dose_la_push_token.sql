-- Spec 041 Fase 2 (fix-up) — token push per-Activity da Live Activity iOS.
--
-- O push-to-start (Fase 1) inicia a LA com app fechado, mas NÃO transiciona nem encerra: a LA iOS
-- só recomputa estado em re-render, que sem JS depende de um único staleDate (ADR-076 emendada
-- 2026-07-02). Fix-up: o servidor dirige update (upcoming→now→late) e end (dose registrada) via
-- push APNs usando o token PER-ACTIVITY (Activity.pushTokenUpdates, ≠ pushToStartToken).
--
-- Este token é efêmero: vive/morre com a ocorrência da dose. Guardá-lo na própria dose_instance
-- (não em notification_devices, que é por-device) mantém a semântica limpa — NULL = sem LA ativa.
-- Aditivo, sem backfill. R-271 n/a (sem CHECK/enum).

ALTER TABLE public.dose_instances
  ADD COLUMN IF NOT EXISTS la_push_token text;

COMMENT ON COLUMN public.dose_instances.la_push_token IS
  'Spec 041 fix-up: token push per-Activity (ActivityKit Activity.pushTokenUpdates) da Live Activity iOS ativa desta ocorrência. Usado pelo servidor p/ push de update/end. NULL = sem LA ativa. Efêmero (limpo no end/410).';

-- Último estado (CON-029) empurrado por push de update. Idempotência do update: só dispara quando o
-- estado derivado (deriveDoseActivityState no disparo) DIFERE deste — evita spam APNs a cada minuto e
-- resiste a tick de cron perdido / clock skew (mais robusto que aritmética de minuto de boundary).
ALTER TABLE public.dose_instances
  ADD COLUMN IF NOT EXISTS la_push_state text;

COMMENT ON COLUMN public.dose_instances.la_push_state IS
  'Spec 041 fix-up: último estado da máquina CON-029 (upcoming/now/late) empurrado à Live Activity via push de update. NULL = nada empurrado ainda. Guarda de idempotência do ciclo update.';
