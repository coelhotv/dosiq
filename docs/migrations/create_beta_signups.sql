-- create_beta_signups.sql
-- Tabela de captura de e-mails para o closed testing do app Android (Play Console
-- exige 12 testers por 2 semanas antes de liberar produção). Origem: landing web,
-- usuário NÃO autenticado → role `anon` precisa de INSERT, mas NUNCA de SELECT
-- (evita harvesting da lista de e-mails).

CREATE TABLE IF NOT EXISTS public.beta_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  platform   text NOT NULL DEFAULT 'android'
             CHECK (platform IN ('android', 'ios', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dedupe por (email, plataforma) — evita spam de inserts do mesmo e-mail.
CREATE UNIQUE INDEX IF NOT EXISTS beta_signups_email_platform_uniq
  ON public.beta_signups (lower(email), platform);

-- Grants (template obrigatório do projeto).
-- anon: APENAS INSERT (signup público da landing). Sem SELECT/UPDATE/DELETE.
GRANT INSERT ON public.beta_signups TO anon;
GRANT INSERT ON public.beta_signups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_signups TO service_role;

ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;

-- INSERT liberado para visitantes (anon) e usuários logados.
CREATE POLICY "beta_signups_insert_anon"
  ON public.beta_signups FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "beta_signups_insert_authenticated"
  ON public.beta_signups FOR INSERT TO authenticated
  WITH CHECK (true);

-- NENHUMA policy de SELECT/UPDATE/DELETE → só o service_role (que ignora RLS)
-- lê a lista. A landing nunca consegue ler e-mails de volta.
