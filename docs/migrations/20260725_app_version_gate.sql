-- app_version_gate — config remota do kill switch de versão mínima (spec 051 fatia 051-A / ADR-091).
--
-- POR QUE UMA TABELA DEDICADA (ADR-091 D1): `in_app_nudges.min_app_version` é filtro de CONTEÚDO por
-- usuário ("este nudge aparece para quais versões?"), não config GLOBAL de bloqueio de boot. Semânticas,
-- políticas de acesso e ciclos de vida diferentes: a policy dos nudges é restrita a `authenticated`, e
-- este gate precisa de `anon` (o bloqueio decide sobre o BINÁRIO, e roda no boot antes de haver sessão).
--
-- 🔴 QUEM ESCREVE AQUI PODE INUTILIZAR A BASE INSTALADA INTEIRA. Daí o modelo de acesso abaixo ser
-- duas camadas INDEPENDENTES (AP-278) e a escrita passar exclusivamente pelo caminho admin
-- (`service_role`, atrás de auth de admin — R-042), com guarda de raio de impacto no handler (S-7).
--
-- MOBILE-ONLY por construção: o CHECK de platform não inclui 'web'. A web serve sempre o build atual
-- (não tem o problema que causa o bloqueio — AP-314) e, por ADR-091 D9, o painel que DESATIVA o gate
-- nunca pode estar dentro do escopo dele.

CREATE TABLE IF NOT EXISTS public.app_version_gate (
  -- Domínio FECHADO e semeado abaixo: nunca cresce. Com as 2 linhas existindo, o painel do 1.5c nasce
  -- edit-only (sem create/delete/empty state/lista). A linha "linha ausente ⇒ ABRE" da tabela-verdade
  -- (CON-033 §1) permanece como defesa contra o inesperado, não como caso de uso.
  platform text PRIMARY KEY CHECK (platform IN ('ios', 'android')), -- R-271: caixa exata do enum do core
  -- Piso de versão. Formato X.Y.Z imposto pelo Zod da ESCRITA; a LEITURA é tolerante de propósito
  -- (valor inválido ⇒ compareSemver devolve null ⇒ o gate ABRE — AP-303: indeterminado ≠ negação).
  min_supported_version text,
  is_active boolean NOT NULL DEFAULT false, -- nasce DESLIGADO
  message text,     -- copy opcional; null ⇒ o cliente usa copy compilada. Renderizado como texto puro (S-9)
  store_url text,   -- sob allowlist no Zod E no cliente (S-8); fora dela ⇒ constante compilada
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Trilha de auditoria que SOBREVIVE ao titular (R-287): SET NULL, não CASCADE — quem apagou a conta
  -- não apaga o registro de quem bloqueou a frota.
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SEED — domínio fechado, ambas as linhas desligadas (ADR-091 D1 / RC3-2 F6)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Idempotente: reaplicar a migração não reseta um gate ativo (ON CONFLICT DO NOTHING).
INSERT INTO public.app_version_gate (platform, is_active)
VALUES ('ios', false), ('android', false)
ON CONFLICT (platform) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ACESSO — DUAS CAMADAS INDEPENDENTES (AP-278). Nenhuma pode ser a única.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- CAMADA 1 — privilégios de tabela.
-- ⚠️ MEDIDO EM 2026-07-25: toda tabela deste projeto tem SELECT/INSERT/UPDATE/DELETE/TRUNCATE para
-- `anon` E `authenticated`, herdado de ALTER DEFAULT PRIVILEGES no schema public. `REVOKE ... FROM
-- PUBLIC` sozinho NÃO resolve — os privilégios estão nomeados nos roles. Revogar é obrigatório, e o
-- REVOKE vem ANTES do GRANT para que o estado final não dependa da ordem em que o Postgres herdou.
REVOKE ALL ON public.app_version_gate FROM PUBLIC;
REVOKE ALL ON public.app_version_gate FROM anon, authenticated;

-- Leitura: `anon` E `authenticated`. O gate roda no boot, antes de haver sessão — sem `anon` o kill
-- switch fica MUDO exatamente para quem abre o app pela primeira vez depois de o servidor mudar.
--
-- 🔴 O GRANT é COLUMN-SCOPED, e isso não é estilo: é a única forma do controle existir (S-10).
-- `GRANT SELECT ON <tabela>` cobre TODAS as colunas, presentes e futuras, e um
-- `REVOKE SELECT (updated_by, updated_at)` depois dele é **INERTE** — o Postgres não subtrai coluna
-- de um privilégio concedido no nível da tabela. Medido em 2026-07-25 no BEGIN..ROLLBACK deste PR:
-- com o grant de tabela, `has_column_privilege('anon', …, 'updated_by', 'SELECT')` seguia `true`.
-- Enumerar as 5 colunas é o que de fato nega as outras duas.
--
-- Por que negar: o cliente precisa de 5 colunas; entregar o uuid interno do admin e o horário da
-- operação a `anon` é exposição gratuita. Filtrar no `.select()` do app é HIGIENE; o grant é o
-- CONTROLE. Consequência desejada e documentada no código do cliente: pedir `select=*` como
-- anon/authenticated devolve 42501 — ninguém deve "consertar" isso.
--
-- ⚠️ Coluna nova nesta tabela NÃO fica legível por acidente: entra aqui explicitamente ou é privada.
GRANT SELECT (platform, min_supported_version, is_active, message, store_url)
  ON public.app_version_gate TO anon, authenticated;

-- Escrita: só `service_role` (o caminho admin, que ignora RLS), atrás de auth de admin (R-042).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_version_gate TO service_role;

-- CAMADA 2 — RLS: uma policy de SELECT, para os DOIS roles, e ZERO policies de escrita.
-- ⚠️ NÃO copiar a policy de `in_app_nudges` (restrita a `authenticated`) — ver justificativa acima.
ALTER TABLE public.app_version_gate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the version gate"
  ON public.app_version_gate FOR SELECT
  TO anon, authenticated
  USING (true);

-- Sem policy de INSERT/UPDATE/DELETE por DESENHO. A ausência não é esquecimento: é a segunda camada.
-- `service_role` ignora RLS, então o caminho admin funciona sem policy.
--
-- ⚠️ ASSIMETRIA MEDIDA (BEGIN..ROLLBACK deste PR, 2026-07-25): as duas camadas falham de formas
-- DIFERENTES. Com o privilégio reconcedido de propósito (`GRANT UPDATE ... TO authenticated`), a RLS
-- sozinha barrou — mas **silenciosamente**: `UPDATE` afetou 0 linhas e NÃO levantou erro. Ou seja, a
-- camada 1 falha ALTO (42501, você descobre na hora) e a camada 2 falha BAIXO (200 com 0 linhas, que
-- um cliente ingênuo lê como sucesso). Consequência de desenho, não curiosidade: o handler admin
-- SEMPRE confere a linha devolvida pelo `.update(...).select()` e trata "0 linhas" como FALHA — do
-- contrário um dia a UI diz "kill switch ativado" sobre uma escrita que não aconteceu.

COMMENT ON TABLE public.app_version_gate IS
  'Kill switch de versão mínima por plataforma (spec 051 / ADR-091 / CON-033). Leitura pública (anon+authenticated, 5 colunas); escrita só via service_role no handler admin, com guarda de raio de impacto. Domínio fechado: 2 linhas, semeadas.';

COMMENT ON COLUMN public.app_version_gate.min_supported_version IS
  'Piso X.Y.Z. Formato imposto no Zod da escrita; leitura tolerante (inválido ⇒ o gate ABRE, AP-303).';
