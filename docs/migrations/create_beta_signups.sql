-- create_beta_signups.sql
-- Tabela de captura de e-mails para o closed testing do app Android (Play Console
-- exige 12 testers por 2 semanas antes de liberar produção). Origem: landing web.
--
-- Segurança: a escrita pública passa pelo endpoint serverless `api/beta-signup.js`,
-- que usa SUPABASE_SERVICE_ROLE_KEY (server-only). A tabela NÃO concede nada a
-- `anon` nem a `authenticated` — só `service_role` (que ignora RLS) acessa.
-- Assim não há superfície de escrita/leitura pública direta na tabela.

CREATE TABLE IF NOT EXISTS public.beta_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  platform   text NOT NULL DEFAULT 'android'
             CHECK (platform IN ('android', 'ios', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dedupe por (email, plataforma) — idempotência do endpoint (unique_violation 23505).
CREATE UNIQUE INDEX IF NOT EXISTS beta_signups_email_platform_uniq
  ON public.beta_signups (lower(email), platform);

-- Sem grants para anon/authenticated: a tabela só é acessível via service_role
-- (usado pelo endpoint). service_role ignora RLS, mas mantemos RLS habilitada
-- para garantir que nenhum acesso anon/authenticated direto seja possível.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_signups TO service_role;
ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada → anon/authenticated não conseguem ler nem escrever.
