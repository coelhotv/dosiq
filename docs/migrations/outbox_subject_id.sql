-- Migration: notification_outbox ganha subject_id (notificação POR ITEM)
-- Created: 2026-08-19
-- Spec: 050 (PR 1a) · ADR-078
-- Purpose: permitir fan-out — hoje a UNIQUE (user_id, kind, period_key) força UMA notificação por
--          usuário/kind/período. Com subject_id na chave, um mesmo usuário pode receber N
--          notificações do mesmo kind no mesmo período, uma por assunto (medicamento, lote...).
--
-- Tabela EXISTENTE → nenhum grant novo (os grants de notification_outbox já existem).
--
-- 🔴 NULLS NOT DISTINCT é OBRIGATÓRIO (PostgreSQL 17.6 em prod — suportado).
--    Sem ele, duas linhas com subject_id NULL deixariam de colidir e a idempotência dos 4 kinds
--    já migrados (daily_adherence, weekly_adherence, monthly_report, daily_digest) sumiria em
--    silêncio — e um backfill passaria a ser obrigatório. ZERO backfill com a cláusula: as linhas
--    atuais ficam subject_id NULL e a semântica antiga é preservada exatamente.
--
-- claim_notification_outbox NÃO precisa ser recriada: é RETURNS SETOF notification_outbox,
-- portanto a coluna nova entra sozinha no tipo de retorno.
--
-- ROLLBACK:
--   alter table public.notification_outbox drop constraint notification_outbox_uniq;
--   alter table public.notification_outbox
--     add constraint notification_outbox_uniq unique (user_id, kind, period_key);
--   alter table public.notification_outbox drop column if exists subject_id;
--   -- ⚠️ o rollback da UNIQUE só passa se não houver linhas com subject_id preenchido
--   --    (duas linhas do mesmo usuário/kind/período colidiriam na chave de 3 colunas).

alter table public.notification_outbox add column if not exists subject_id uuid;

alter table public.notification_outbox drop constraint notification_outbox_uniq;

alter table public.notification_outbox
  add constraint notification_outbox_uniq
  unique nulls not distinct (user_id, kind, period_key, subject_id);

comment on column public.notification_outbox.subject_id is
  'Assunto da notificação (medicine_id, stock.id...). NULL = notificação de usuário/período inteiro (4 kinds originais). Parte da UNIQUE com NULLS NOT DISTINCT.';
