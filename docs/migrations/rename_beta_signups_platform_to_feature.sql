-- rename_beta_signups_platform_to_feature.sql
-- Renomeia coluna `platform` para `feature` na tabela `beta_signups`.
--
-- Justificativa: A coluna nunca foi usada para identificar plataforma do
-- dispositivo, mas sim a "lista" (feature/canal) em que o e-mail é inscrito.
-- O valor existente 'android' identifica a lista de testers do Play Store
-- closed testing. Novos valores como 'caregiver_mode' serão usados para
-- medir demanda de features via termômetro (painted door test).
--
-- Aplicação: PO aplica manualmente via Supabase SQL Editor ou MCP.
-- Reversível: ALTER TABLE ... RENAME COLUMN feature TO platform;

-- 1. Renomear coluna
ALTER TABLE public.beta_signups RENAME COLUMN platform TO feature;

-- 2. Dropar constraint antiga (nome gerado pelo PG inclui 'platform')
ALTER TABLE public.beta_signups DROP CONSTRAINT IF EXISTS beta_signups_platform_check;

-- 3. Recriar constraint com valores expandidos
ALTER TABLE public.beta_signups
  ADD CONSTRAINT beta_signups_feature_check
  CHECK (feature IN ('android', 'ios', 'other', 'caregiver_mode'));

-- 4. Dropar índice antigo
DROP INDEX IF EXISTS beta_signups_email_platform_uniq;

-- 5. Recriar índice com nome atualizado
CREATE UNIQUE INDEX beta_signups_email_feature_uniq
  ON public.beta_signups (lower(email), feature);

-- Grants/RLS inalterados — já existem na migration original.
-- service_role mantém acesso total; anon/authenticated continuam sem acesso.
