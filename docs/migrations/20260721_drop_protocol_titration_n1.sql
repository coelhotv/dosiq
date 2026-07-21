-- 029 F6 — DROP das 4 colunas de titulação N1 de `protocols`.
--
-- Fecha o épico 029: a titulação deixou de ser 4 colunas penduradas no tratamento e passou a
-- ser entidade própria (`titrations` + `titration_steps`, ADR-084). Estas colunas não têm mais
-- nenhum leitor nem escritor no código — o repontamento foi no MESMO PR, no commit anterior.
--
-- ⚠️ IRREVERSÍVEL. Um rollback recria a estrutura, nunca o conteúdo.
--
-- ─────────────────────────── Estado medido antes do DROP (2026-07-21) ───────────────────────
-- As 68 linhas de `protocols` em produção são BYTE-IDÊNTICAS nas 4 colunas:
--     titration_status='estável' · titration_schedule='[]' · current_stage_index=0 · stage_started_at=NULL
-- Zero linhas com escada declarada; zero com relógio setado; um único valor distinto de índice.
-- Não é "dado zumbi", é coluna zumbi: não há informação a preservar.
-- Backup lógico + queries em plans/specs/029-treatment-level-titration/evidence/f6-backup-n1-columns.md
--
-- Titulação N2 viva no mesmo instante: titrations=4 · titration_steps=12 · 1 usuário.
--
-- ─────────────────────────── Por que isto é seguro (o gate do #750) ─────────────────────────
-- Coluna dropada + código que ainda a pede = 42703 em produção. Foi assim que web+mobile+cron
-- caíram em 2026-07-16 (AP-300), passando por tsc, lint, 2068 testes, RC5 e review externo —
-- porque `select()` é string e o client está sempre mockado. Provado ANTES deste arquivo:
--   1. grep das 4 colunas em apps/ packages/ server/ api/ → ZERO em código de produção.
--   2. Os 7 selects alterados EXECUTADOS contra o PostgREST real → todos 200 (R-295).
--   3. Varredura no próprio banco → ZERO dependentes em pg_views, pg_matviews, pg_proc
--      (funções/RPCs), pg_constraint, pg_indexes, defaults/generated e pg_policies (RLS).
--   4. validate:full (798) · test:critical (2104) · mobile (497) · lint 0 erros · strict-island OK.
--
-- Guardas automáticas contra reintrodução (o F2 declarou um campo e o F3 pisou nele — AP-300):
--   · createProtocolRepository.test.ts  → insert não pode conter nenhuma das 4
--   · protocolService.test.ts (mobile)  → idem
--   · validation.test.ts (core)         → o Zod DESCARTA as 4 se vierem de cache legado
--
-- R-289: `database.types.ts` regenerado no MESMO PR, com o diff auditado.

BEGIN;

ALTER TABLE public.protocols
  DROP COLUMN IF EXISTS titration_schedule,
  DROP COLUMN IF EXISTS titration_status,
  DROP COLUMN IF EXISTS current_stage_index,
  DROP COLUMN IF EXISTS stage_started_at;

COMMIT;

-- Verificação (deve retornar 0 linhas):
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='protocols'
--      and column_name in ('titration_schedule','titration_status','current_stage_index','stage_started_at');
