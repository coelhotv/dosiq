-- Spec 041 — iOS Live Activity push-to-start (APNs)
-- (1) Estende o CHECK de notification_devices.provider p/ aceitar o token push-to-start do
--     ActivityKit (provider 'apns_liveactivity'). Reusa a tabela existente (S-4 do RC-SEC) —
--     mesma RLS auth.uid()=user_id, UNIQUE(provider,push_token), ciclo is_active. Sem tabela nova.
-- (2) Marca de idempotência do disparo de start em dose_instances (la_push_started_at): evita
--     re-disparar o mesmo start N vezes na janela `upcoming` (cron de minuto). NÃO reusa
--     notified_at (esse é do reminder no T0; push-to-start dispara em T0−antecedência, antes).
-- R-271: CHECK sincronizado com o enum (caixa exata). Valor ADITIVO → linhas existentes intactas.

-- (1) provider CHECK
ALTER TABLE public.notification_devices
  DROP CONSTRAINT IF EXISTS notification_devices_provider_check;

ALTER TABLE public.notification_devices
  ADD CONSTRAINT notification_devices_provider_check
  CHECK (provider IN ('expo', 'webpush', 'apns_liveactivity'));

-- (2) marca de idempotência (nullable; NULL = nunca disparado start desta ocorrência)
ALTER TABLE public.dose_instances
  ADD COLUMN IF NOT EXISTS la_push_started_at timestamptz;

COMMENT ON COLUMN public.dose_instances.la_push_started_at IS
  'Spec 041: instante em que o push-to-start da Live Activity (iOS) foi disparado para esta ocorrência. NULL = nunca disparado. Idempotência do start na janela upcoming (T0−antecedência).';
