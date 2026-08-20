-- Migration: notification_outbox aceita o kind `stock_expiry_alert`
-- Created: 2026-08-20
-- Spec: 050 (PR 2) · ADR-078
-- Purpose: o segundo eixo do alerta de estoque (validade biológica pós-abertura, 012 Fase A) migra
--          para a outbox junto com o volume. Diferente do `stock_alert` (fan-out por MEDICAMENTO),
--          este é POR LOTE — `subject_id` = `stock.id`.
--
-- Tabela EXISTENTE → nenhum grant novo (os grants de notification_outbox já existem).
-- Nenhuma coluna nova: só o CHECK de `kind` é recriado com um valor a mais.
-- A UNIQUE (user_id, kind, period_key, subject_id) NULLS NOT DISTINCT do PR 1a já expressa a
-- idempotência deste kind (um alerta por lote por dia local) — nada a alterar nela.
--
-- claim_notification_outbox NÃO é tocada (RETURNS SETOF notification_outbox; o CHECK não a afeta).
--
-- ROLLBACK (só passa se não houver linha com o kind novo — apagar antes se houver):
--   delete from public.notification_outbox where kind = 'stock_expiry_alert';
--   alter table public.notification_outbox drop constraint notification_outbox_kind_check;
--   alter table public.notification_outbox
--     add constraint notification_outbox_kind_check
--     check (kind = any (array['daily_adherence','weekly_adherence','monthly_report','daily_digest','stock_alert']));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;

alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind = any (array[
    'daily_adherence',
    'weekly_adherence',
    'monthly_report',
    'daily_digest',
    'stock_alert',
    'stock_expiry_alert'
  ]));
