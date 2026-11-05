// Spec 105 — content builder do `supply_reminder` no drain da notification_outbox.
//
// SEC-1 (ADR-078): a fila guarda só a referência. O MOTIVO sai do próprio assunto — os dois são UUIDs
// de tabelas diferentes, então não há ambiguidade:
//   subject = dose_instances.id → aviso de dose mensal (reason monthly_dose)
//   subject = medicines.id      → lembrete de compra   (reason monthly_purchase | step_switch)
//
// FR-005/E-10/E-15: tudo é revalidado AGORA. Sem conteúdo ⇒ `null` (o drain marca `sent` sem enviar,
// `skippedNoContent`) com `reason` no log — silêncio sem motivo seria falha silenciosa.
// FR-017/INV-7: o retorno NUNCA leva nome de remédio — o schema do payload é `.strict()`.

import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { computeSupplyDate, isSparseProtocol } from '@dosiq/core';
import { _scanStockAlertCandidates } from '../reminders/stockAlerts.js';
import {
  DOSE_INSTANCE_SCAN_COLUMNS,
  MONTHLY_HEADS_UP_DAYS,
  _fetchPendingInstances,
  daysBetween,
  eligiblePurchaseMedicines,
  localDate,
  planPurchasesForUser,
  runwayStocksOf,
} from '../reminders/supplyPlan.js';

const logger = createLogger('SupplyReminderContent');
const DEFAULT_TZ = 'America/Sao_Paulo';
const MS_DAY = 86400000;

type SupplyReminderData = {
  reason: 'monthly_dose' | 'monthly_purchase' | 'step_switch';
  daysUntil: number;
  withPurchaseLine: boolean;
  /** Tratamento de origem — id opaco para o toque abrir o detalhe (C-12). */
  protocolId?: string;
};

function skip(reason: string, ctx: Record<string, unknown>): null {
  logger.info('supply_reminder descartado no envio', { reason, ...ctx });
  return null;
}

async function readSettings(userId: string): Promise<{ tz: string; tracking: boolean }> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('timezone, stock_tracking_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  // AP-277: erro ou NULL ⇒ tracking LIGADO (a ausência de dado não cala aviso).
  if (error) logger.error('Falha ao reler settings no envio — seguindo com padrão', error, { userId });
  return { tz: data?.timezone || DEFAULT_TZ, tracking: data?.stock_tracking_enabled !== false };
}

/** Escopo de um usuário para o plano de compra — a MESMA varredura do enqueue (uma implementação). */
async function loadUserScope(userId: string, now: Date) {
  const scan = await _scanStockAlertCandidates([{ user_id: userId }], 'supply_reminder_content', { quiet: true });
  const steps = scan.stepsByUser?.[userId] || [];
  const eligible = eligiblePurchaseMedicines(scan.protocolsByMedicine, { [userId]: steps });
  const instances = await _fetchPendingInstances(
    [userId],
    eligible.map((e) => e.medicineId),
    // eslint-disable-next-line no-restricted-syntax -- instante absoluto (ms), não date-only
    new Date(now.getTime() - MS_DAY).toISOString(),
  );
  return { ...scan, steps, instances };
}

/** Ramo do aviso de dose mensal (subject = dose_instance.id). */
async function monthlyHeadsUpContent(
  inst: any, userId: string, tz: string, tracking: boolean, now: Date
): Promise<SupplyReminderData | null> {
  const subjectId = inst.id;
  const today = localDate(now, tz);
  if (inst.status !== 'pending') return skip('dose_resolved', { userId, subjectId });
  const doseDate = localDate(inst.scheduled_for, tz);
  const daysUntil = daysBetween(today, doseDate);
  // D-2 normal; D-1 só chega aqui pela recuperação da FR-018 (o enqueue garante 1 aviso por dose).
  if (daysUntil !== MONTHLY_HEADS_UP_DAYS && daysUntil !== 1) return skip('out_of_window', { userId, subjectId, daysUntil });

  const { data: protocol, error: pErr } = await supabase
    .from('protocols')
    .select('id, interval_days, active, paused_at, end_date')
    .eq('id', inst.protocol_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (pErr) throw new Error(`buildSupplyReminderContent.protocols: ${pErr.message}`);
  if (!protocol || protocol.active !== true || protocol.paused_at) return skip('protocol_inactive', { userId, subjectId });
  if (protocol.end_date && protocol.end_date < today) return skip('protocol_ended', { userId, subjectId });
  if (!isSparseProtocol(protocol)) return skip('not_sparse', { userId, subjectId });

  const base = { reason: 'monthly_dose' as const, daysUntil, protocolId: protocol.id };
  // Linha de compra (AC-2): só com estoque ligado e saldo que não cobre ESTA dose (FR-014). Sem
  // estoque ligado, a varredura do usuário nem roda (105 perf c).
  if (!tracking) return { ...base, withPurchaseLine: false };
  const scope = await loadUserScope(userId, now);
  const r = computeSupplyDate({
    medicineId: inst.medicine_id,
    protocols: scope.protocolsByMedicine[`${userId}_${inst.medicine_id}`],
    steps: scope.steps,
    instances: scope.instances,
    stocks: runwayStocksOf(userId, scope.stockByMedicine),
    tz,
    now,
  });
  return { ...base, withPurchaseLine: r.status === 'due' && r.date === doseDate };
}

/** Ramo do lembrete de compra (subject = medicamento a comprar). */
async function purchaseContent(
  subjectId: string, userId: string, tz: string, tracking: boolean, now: Date
): Promise<SupplyReminderData | null> {
  if (!tracking) return skip('stock_tracking_off', { userId, subjectId });
  const scope = await loadUserScope(userId, now);
  const planned = planPurchasesForUser({
    userId,
    protocolsByMedicine: scope.protocolsByMedicine,
    stockByMedicine: scope.stockByMedicine,
    steps: scope.steps,
    instances: scope.instances,
    tz,
    now,
  });
  const hit = planned.find((p) => p.medicineId === subjectId);
  // Compra registrada, protocolo pausado ou deixou de ser elegível: o plano de agora não o contém.
  if (!hit) return skip('purchase_no_longer_due', { userId, subjectId });
  return {
    reason: hit.reason === 'step_switch' ? 'step_switch' : 'monthly_purchase',
    daysUntil: hit.daysUntil,
    withPurchaseLine: false,
    protocolId: hit.protocolId,
  };
}

export async function buildSupplyReminderContent(
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto do envio
  { userId, subjectId, now = new Date() }: { userId: string; subjectId: string | null; now?: Date }
): Promise<Record<string, unknown> | null> {
  if (!subjectId) return null;
  // 105 perf: as duas leituras independem — em paralelo.
  const [{ tz, tracking }, instRes] = await Promise.all([
    readSettings(userId),
    supabase
      .from('dose_instances')
      .select(DOSE_INSTANCE_SCAN_COLUMNS)
      .eq('id', subjectId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const { data: inst, error: instErr } = instRes;
  if (instErr) throw new Error(`buildSupplyReminderContent.dose_instances: ${instErr.message}`);

  return inst
    ? monthlyHeadsUpContent(inst, userId, tz, tracking, now)
    : purchaseContent(subjectId, userId, tz, tracking, now);
}
