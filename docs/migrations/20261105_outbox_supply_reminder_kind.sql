-- Migration: notification_outbox aceita o kind `supply_reminder`
-- Created: 2026-11-05
-- Spec: 105 (Fatia A) · ADR-120 · INV-5
-- Purpose: kind único para o aviso de dose mensal (reason `monthly_dose`, subject = dose_instance.id)
--          e o lembrete de compra (reason `purchase`, subject = medicine_id). Os dois subjects são
--          UUIDs de tabelas diferentes: não colidem na UNIQUE (user_id, kind, period_key, subject_id).
--
-- 🔴 ORDEM (INV-5): esta migração entra ANTES de qualquer deploy que enfileire o kind. Código antes
-- do CHECK ⇒ 23514 no upsert, e o `repo.enqueue` do estoque é UM lote: volume e validade do dia
-- falhariam junto. Sequência: QA → prod → deploy → `OUTBOX_KINDS` += supply_reminder.
--
-- Tabela EXISTENTE → nenhum grant novo (os grants de notification_outbox já existem).
-- Nenhuma coluna nova: só o CHECK de `kind` é recriado com um valor a mais.
-- claim_notification_outbox NÃO é tocada (RETURNS SETOF notification_outbox; o CHECK não a afeta).
--
-- ROLLBACK (só passa se não houver linha com o kind novo — apagar antes se houver):
--   delete from public.notification_outbox where kind = 'supply_reminder';
--   alter table public.notification_outbox drop constraint notification_outbox_kind_check;
--   alter table public.notification_outbox
--     add constraint notification_outbox_kind_check
--     check (kind = any (array['daily_adherence','weekly_adherence','monthly_report','daily_digest','stock_alert','stock_expiry_alert']));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;

alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind = any (array[
    'daily_adherence',
    'weekly_adherence',
    'monthly_report',
    'daily_digest',
    'stock_alert',
    'stock_expiry_alert',
    'supply_reminder'
  ]));
