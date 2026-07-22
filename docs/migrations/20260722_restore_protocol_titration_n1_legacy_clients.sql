-- HOTFIX DE PRODUÇÃO (2026-07-22) — restaura as 4 colunas de titulação N1 de `protocols`.
--
-- Desfaz o efeito de `20260721_drop_protocol_titration_n1.sql` (épico 029 F6) SEM reverter o
-- épico: a titulação continua sendo a entidade N2 (`titrations` + `titration_steps`, ADR-084).
-- Estas colunas voltam INERTES — nenhum código de produção (v0.28.0+) as lê ou escreve.
--
-- ─────────────────────────────── Por que o DROP quebrou produção ────────────────────────────
-- O gate do F6 foi rigoroso e provou o que se propôs a provar: ZERO leitores das 4 colunas no
-- REPOSITÓRIO (grep em apps/ packages/ server/ api/, 7 selects executados contra o PostgREST
-- real, varredura de views/matviews/proc/constraints/policies no banco). Tudo isso era e segue
-- sendo verdade.
--
-- O que grep no repositório NÃO alcança: os BINÁRIOS JÁ INSTALADOS nos aparelhos. O mobile
-- v0.27.0, publicado na Play Store e sem update forçado, nomeia `titration_status` no `select()`
-- de DOIS serviços:
--   · apps/mobile/src/features/dashboard/services/dashboardService.ts:31
--   · apps/mobile/src/features/treatments/services/treatmentsService.ts:113
-- Pós-DROP esses selects viram `42703` PERMANENTE: aba Hoje e aba Tratamentos mortas em todo
-- aparelho não atualizado. Estoque e Perfil não tocam `protocols` — por isso carregavam normal,
-- o que mascarou o diagnóstico. Web não sofreu (recarrega o bundle novo); bot e cron são
-- server-side. Sintoma relatado: "Cache expirado (> 24h)" — o `handleCacheFallback` de
-- `useTodayData.ts` engole o erro original e reporta só a expiração do snapshot (ver AP-314).
--
-- ──────────────────────────────── Por que restaurar é seguro ────────────────────────────────
-- A migração do DROP mediu produção antes de agir e registrou: as 68 linhas de `protocols` eram
-- BYTE-IDÊNTICAS nas 4 colunas —
--     titration_status='estável' · titration_schedule='[]' · current_stage_index=0 · stage_started_at=NULL
-- Não havia informação a preservar (coluna zumbi, não dado zumbi). Logo os DEFAULTs abaixo
-- REPRODUZEM EXATAMENTE o que o cliente antigo lia antes do DROP — restauração fiel, não
-- aproximação. Tipos conforme `packages/shared-data/src/database.types.ts` pré-DROP: todas
-- nullable, sem NOT NULL, sem CHECK.
--
-- O DEFAULT (não só a coluna) é o que importa: protocolo criado por cliente NOVO, que não
-- escreve nenhuma das 4, é lido por cliente ANTIGO — e precisa ver 'estável'/'[]'/0/NULL.
--
-- Leitura no cliente antigo segue CORRETA, não degradada: o `EvolutionBadge` da v0.27.0 já
-- deriva de `titration_steps` via `getEvolutionBadge` (N2) — `titration_status` era vestígio no
-- select, com o valor descartado. Escrita também resolve: a v0.27.0 insere as 4 no cadastro de
-- tratamento (`createProtocolRepository.create()`), e as colunas aceitam.
--
-- Grants: `GRANT` em `protocols` é table-level → colunas novas herdam (anon e authenticated já
-- têm SELECT/INSERT/UPDATE/DELETE). Nenhuma policy de RLS referencia as 4. Nada a fazer.
--
-- ⚠️ NÃO REINTRODUZIR NO CÓDIGO. As guardas automáticas do F6 seguem valendo e devem continuar
-- verdes (createProtocolRepository.test.ts, protocolService.test.ts mobile, validation.test.ts
-- do core): nenhum insert de produção pode conter estas colunas. Elas existem exclusivamente
-- para manter os binários legados vivos.
--
-- Remoção definitiva: só quando nenhuma versão mobile que nomeia `titration_status` estiver mais
-- em uso — critério objetivo a definir na política de versão mínima suportada (ver AP-314).

BEGIN;

ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS titration_schedule  jsonb       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS titration_status    text        DEFAULT 'estável',
  ADD COLUMN IF NOT EXISTS current_stage_index integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_started_at    timestamptz DEFAULT NULL;

COMMIT;

COMMENT ON COLUMN public.protocols.titration_status IS
  'LEGADO N1 — inerte. Restaurada em 2026-07-22 só para o mobile <= v0.27.0 não tomar 42703. Nenhum código novo lê/escreve. Titulação viva = titration_steps (ADR-084).';
COMMENT ON COLUMN public.protocols.titration_schedule IS
  'LEGADO N1 — inerte. Ver comentário de titration_status.';
COMMENT ON COLUMN public.protocols.current_stage_index IS
  'LEGADO N1 — inerte. Ver comentário de titration_status.';
COMMENT ON COLUMN public.protocols.stage_started_at IS
  'LEGADO N1 — inerte. Ver comentário de titration_status.';

-- ─────────────────────────────────────── Verificação ────────────────────────────────────────
-- 1) Colunas de volta com os tipos/defaults certos (deve retornar 4 linhas):
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema='public' and table_name='protocols'
--      and column_name in ('titration_schedule','titration_status','current_stage_index','stage_started_at');
--
-- 2) Backfill idêntico ao estado pré-DROP (as 4 contagens devem igualar o total):
--   select count(*) as total,
--          count(*) filter (where titration_status='estável')      as st_ok,
--          count(*) filter (where titration_schedule='[]'::jsonb)  as sch_ok,
--          count(*) filter (where current_stage_index=0)           as idx_ok,
--          count(*) filter (where stage_started_at is null)        as clock_null
--     from public.protocols;
--
-- 3) Gate R-295 — o select LITERAL da v0.27.0 executado contra o PostgREST (deve dar 200):
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "$SUPABASE_URL/rest/v1/protocols?select=id,titration_status,titration_schedule,current_stage_index,stage_started_at&limit=1" \
--     -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
--
-- Executadas em 2026-07-22 contra produção: (1) 4 linhas OK · (2) 68/68 em todas · (3) 200
-- (controle com coluna inexistente devolveu 42703, provando que o teste discrimina).
