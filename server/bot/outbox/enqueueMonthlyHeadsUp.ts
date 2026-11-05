// Spec 105 (US-1) — aviso D-2 de dose mensal na notification_outbox.
//
// Eixo SEPARADO do estoque por desenho (RC3 r2): o aviso é de DOSE, não de estoque — sai para toda
// paciente com protocolo `interval_days ≥ 28`, inclusive quem desligou o controle de estoque
// (FR-014, INV-6). Por isso NÃO usa `_fetchStockTrackingUsers`. O consentimento é o gate central do
// dispatcher (`silent`/`digest_morning`/quiet hours/canal none), como todo kind (FR-008).
//
// SEC-1 (ADR-078): a fila guarda só a referência (`subject_id` = dose_instance.id); texto e
// elegibilidade nascem no envio (`supplyReminderContent.ts`).
//
// C-7 (cruzamento com a 116): roda a cada minuto da janela 10:00–10:09, então a leitura é estreita —
// usuários na janela → protocolos ESPARSOS deles → doses pendentes só desses protocolos, num
// intervalo de 4 dias. Fora da janela: zero requisição.
// C-6: `now` vem do handler (relógio do tick; na recuperação da 116, o minuto-alvo).

import { periodKey } from '../../notifications/outbox/periodKey.js';
import { isInStockAlertWindow as isInAlertWindow } from '../../notifications/windows.js';
import { _fetchAllPages, _fetchAllPagesByUsers } from '../reminders/_pagination.js';
import { DOSE_INSTANCE_SCAN_COLUMNS, MONTHLY_HEADS_UP_DAYS, daysBetween, localDate } from '../reminders/supplyPlan.js';
import { SPARSE_INTERVAL_DAYS_MIN } from '@dosiq/core';

const DEFAULT_TZ = 'America/Sao_Paulo';
const MS_DAY = 86400000;

export interface EnqueueMonthlyHeadsUpResult {
  usersInWindow: number;
  /** Linhas TENTADAS (o upsert com ignoreDuplicates não diz quantas entraram). */
  attempted: number;
}

/**
 * Enfileira 1 `supply_reminder` (reason monthly_dose) por DOSE mensal cuja data local é hoje + 2.
 * @param kinds OUTBOX_KINDS — sem `supply_reminder`, no-op total (sem legado: não há dobra).
 */
export async function enqueueMonthlyHeadsUp(
  { repo, kinds, now, correlationId, logger }:
  {
    repo: { enqueue(entries: any[]): Promise<number> };
    kinds: Set<string>;
    now: Date;
    correlationId?: string;
    logger?: { info: (...a: any[]) => void; error: (...a: any[]) => void };
  }
): Promise<EnqueueMonthlyHeadsUpResult> {
  const empty = { usersInWindow: 0, attempted: 0 };
  if (!kinds.has('supply_reminder')) return empty;

  const users = await _fetchAllPages('user_settings', 'user_id, timezone');
  const tzByUser = new Map<string, string>();
  for (const u of users || []) {
    const tz = u.timezone || DEFAULT_TZ;
    try {
      if (isInAlertWindow(now, tz)) tzByUser.set(u.user_id, tz);
    } catch (err: any) {
      // tz corrompida → Intl lança: isola o usuário (mesmo padrão de `enqueueStockAlerts`).
      logger?.error('[enqueueMonthlyHeadsUp] tz inválida — usuário pulado', err, { userId: u.user_id, correlationId });
    }
  }
  if (tzByUser.size === 0) return empty;
  const userIds = [...tzByUser.keys()];

  // Data local "hoje" (para `end_date`) — uma por usuário seria exato, mas `end_date ≥ ontem-em-SP`
  // só alarga a janela em ≤ 1 dia; o builder revalida por usuário no envio (FR-005).
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto (ms), não date-only
  const todaySp = localDate(new Date(now.getTime() - MS_DAY), DEFAULT_TZ);
  const protocols = await _fetchAllPagesByUsers(
    'protocols',
    'id, user_id, interval_days',
    userIds,
    (q) => q
      .eq('active', true)
      .is('paused_at', null)
      .gte('interval_days', SPARSE_INTERVAL_DAYS_MIN)
      .or(`end_date.is.null,end_date.gte.${todaySp}`)
  );
  if (protocols.length === 0) return { usersInWindow: userIds.length, attempted: 0 };

  const protocolIds = protocols.map((p: any) => p.id);
  // Hoje+1..hoje+3 local cabe em [now, now + 4d) em qualquer fuso.
  const instances = await _fetchAllPagesByUsers(
    'dose_instances',
    DOSE_INSTANCE_SCAN_COLUMNS,
    userIds,
    (q) => q
      .eq('status', 'pending')
      .in('protocol_id', protocolIds)
      .gte('scheduled_for', now.toISOString())
      // eslint-disable-next-line no-restricted-syntax -- instante absoluto (ms), não date-only
      .lt('scheduled_for', new Date(now.getTime() + 4 * MS_DAY).toISOString())
  );

  const entries: any[] = [];
  for (const inst of instances) {
    const tz = tzByUser.get(inst.user_id) || DEFAULT_TZ;
    const days = daysBetween(localDate(now, tz), localDate(inst.scheduled_for, tz));
    if (days !== MONTHLY_HEADS_UP_DAYS) continue;
    entries.push({
      userId: inst.user_id,
      kind: 'supply_reminder',
      periodKey: periodKey('supply_reminder', now, tz),
      subjectId: inst.id,
    });
  }

  const result = { usersInWindow: userIds.length, attempted: entries.length };
  if (entries.length === 0) return result;
  await repo.enqueue(entries);
  logger?.info('[enqueueMonthlyHeadsUp] linhas tentadas na fila', { correlationId, ...result });
  return result;
}
