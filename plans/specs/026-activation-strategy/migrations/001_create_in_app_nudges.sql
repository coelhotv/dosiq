-- 026 Fase 1: Nudges In-App
-- Tabela admin-managed; leitura autenticada, escrita service_role.

CREATE TABLE public.in_app_nudges (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version          integer     NOT NULL DEFAULT 1,
  title            text        NOT NULL,
  body             text        NOT NULL,
  target_view      text        NOT NULL,  -- 'dashboard' | 'profile' | 'any'
  action_type      text        NOT NULL,  -- 'navigate' | 'open_url' | 'dismiss_only'
  action_payload   jsonb,
  min_app_version  text,
  max_app_version  text,
  platform         text        NOT NULL DEFAULT 'all',  -- 'ios' | 'android' | 'web' | 'all'
  priority         integer     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  start_at         timestamptz,
  end_at           timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT in_app_nudges_target_view_check
    CHECK (target_view IN ('dashboard', 'profile', 'any')),
  CONSTRAINT in_app_nudges_action_type_check
    CHECK (action_type IN ('navigate', 'open_url', 'dismiss_only')),
  CONSTRAINT in_app_nudges_platform_check
    CHECK (platform IN ('ios', 'android', 'web', 'all'))
);

CREATE INDEX idx_in_app_nudges_target_view ON public.in_app_nudges (target_view)
  WHERE is_active = true;

CREATE INDEX idx_in_app_nudges_platform ON public.in_app_nudges (platform)
  WHERE is_active = true;

-- Grants obrigatórios (CLAUDE.md — a partir de 30/10/2026)
GRANT SELECT ON public.in_app_nudges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_nudges TO service_role;

ALTER TABLE public.in_app_nudges ENABLE ROW LEVEL SECURITY;

-- RLS: usuários autenticados leem nudges ativos
CREATE POLICY "authenticated pode ler nudges ativos"
  ON public.in_app_nudges
  FOR SELECT
  TO authenticated
  USING (is_active = true);
