-- 20260527_add_timezone_to_user_settings.sql
-- ADR-049 — Core tz-aware + user_settings.timezone como fonte de verdade (Fase 1)
-- Adiciona coluna timezone a user_settings (schema public — ratifica ADR-031).
-- Default 'America/Sao_Paulo' preserva o comportamento atual → migração NÃO-breaking.
-- user_settings já existe (não requer grants novos).

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

COMMENT ON COLUMN public.user_settings.timezone IS
  'IANA timezone do usuário (ex: America/Sao_Paulo, America/Manaus). Fonte de verdade para cálculo temporal tz-aware (ADR-049).';
