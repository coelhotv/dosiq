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
import { _fetchAllPagesByUsers } from '../reminders/_pagination.js';
import { _fetchEnqueueSettings } from '../reminders/stockAlerts.js';
import { DOSE_INSTANCE_SCAN_COLUMNS, MONTHLY_HEADS_UP_DAYS, daysBetween, localDate } from '../reminders/supplyPlan.js';
import { SPARSE_INTERVAL_DAYS_MIN } from '@dosiq/core';

const DEFAULT_TZ = 'America/Sao_Paulo';
const MS_DAY = 86400000;

export interface EnqueueMonthlyHeadsUpResult {
  usersInWindow: number;
  /** Linhas TENTADAS (o upsert com ignoreDuplicates não diz quantas entraram). */
  attempted: number;
  /** FR-018: avisos do D-1 enfileirados porque o D-2 não saiu. */
  recoveredD1?: number;
}

type Log = { info: (...a: any[]) => void; error: (...a: any[]) => void };
type Due = { inst: any; tz: string; days: number };

/** Fuso de cada usuário cuja hora local está na janela; tz corrompida isola só aquele usuário. */
function usersInWindow(users: any[], now: Date, logger?: Log, correlationId?: string): Map<string, string> {
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
  return tzByUser;
}

/**
 * Doses mensais pendentes em D-2 ou D-1 locais. Leitura estreita (C-7): protocolos ESPARSOS dos
 * usuários na janela → doses só desses protocolos, num intervalo de 4 dias.
 */
async function fetchDueDoses(tzByUser: Map<string, string>, now: Date): Promise<Due[]> {
  const userIds = [...tzByUser.keys()];
  // `end_date ≥ ontem-em-SP` só alarga a janela em ≤ 1 dia; o builder revalida por usuário (FR-005).
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto (ms), não date-only
  const todaySp = localDate(new Date(now.getTime() - MS_DAY), DEFAULT_TZ);
  const protocols = await _fetchAllPagesByUsers('protocols', 'id, user_id, interval_days', userIds, (q) => q
    .eq('active', true)
    .is('paused_at', null)
    .gte('interval_days', SPARSE_INTERVAL_DAYS_MIN)
    .or(`end_date.is.null,end_date.gte.${todaySp}`));
  if (protocols.length === 0) return [];

  // Hoje+1..hoje+3 local cabe em [now, now + 4d) em qualquer fuso.
  const instances = await _fetchAllPagesByUsers('dose_instances', DOSE_INSTANCE_SCAN_COLUMNS, userIds, (q) => q
    .eq('status', 'pending')
    .in('protocol_id', protocols.map((p: any) => p.id))
    .gte('scheduled_for', now.toISOString())
    // eslint-disable-next-line no-restricted-syntax -- instante absoluto (ms), não date-only
    .lt('scheduled_for', new Date(now.getTime() + 4 * MS_DAY).toISOString()));

  const due: Due[] = [];
  for (const inst of instances) {
    const tz = tzByUser.get(inst.user_id) || DEFAULT_TZ;
    const days = daysBetween(localDate(now, tz), localDate(inst.scheduled_for, tz));
    if (days === MONTHLY_HEADS_UP_DAYS || days === 1) due.push({ inst, tz, days });
  }
  return due;
}

/**
 * FR-018: o aviso mensal só tem D-2 — perder a janela desse dia inteira (≥ 10 min sem tick) o
 * perderia para sempre. No D-1 a dose entra SÓ se nenhuma linha da fila tem essa dose como assunto,
 * em qualquer dia (a fila guarda 90 dias): INV-3 (1 aviso por dose) segue valendo.
 */
async function alreadyQueuedD1(due: Due[], userIds: string[]): Promise<Set<string>> {
  const d1 = due.filter((d) => d.days === 1).map((d) => d.inst.id);
  if (d1.length === 0) return new Set();
  const rows = await _fetchAllPagesByUsers('notification_outbox', 'id, subject_id', userIds, (q) => q
    .eq('kind', 'supply_reminder')
    .in('subject_id', d1));
  return new Set(rows.map((r: any) => r.subject_id));
}

/**
 * Enfileira 1 `supply_reminder` (reason monthly_dose) por DOSE mensal cuja data local é hoje + 2
 * (ou hoje + 1, se o D-2 não saiu — FR-018).
 * @param kinds OUTBOX_KINDS — sem `supply_reminder`, no-op total (sem legado: não há dobra).
 */
export async function enqueueMonthlyHeadsUp(
  { repo, kinds, now, correlationId, logger, settings }:
  {
    repo: { enqueue(entries: any[]): Promise<number> };
    kinds: Set<string>;
    now: Date;
    /** `user_settings` já lido no tick (105 perf b); ausente ⇒ lê aqui. NÃO filtra estoque (FR-014). */
    settings?: any[];
    correlationId?: string;
    logger?: Log;
  }
): Promise<EnqueueMonthlyHeadsUpResult> {
  const empty = { usersInWindow: 0, attempted: 0 };
  if (!kinds.has('supply_reminder')) return empty;

  const tzByUser = usersInWindow(settings ?? await _fetchEnqueueSettings(), now, logger, correlationId);
  if (tzByUser.size === 0) return empty;
  const userIds = [...tzByUser.keys()];

  const due = await fetchDueDoses(tzByUser, now);
  const queued = await alreadyQueuedD1(due, userIds);
  const picked = due.filter((d) => !(d.days === 1 && queued.has(d.inst.id)));
  const entries = picked.map(({ inst, tz }) => ({
    userId: inst.user_id,
    kind: 'supply_reminder',
    periodKey: periodKey('supply_reminder', now, tz),
    subjectId: inst.id,
  }));

  const result = {
    usersInWindow: userIds.length,
    attempted: entries.length,
    // Recuperações do D-1 (FR-018) — no dia normal é 0; > 0 indica janela do D-2 perdida.
    recoveredD1: picked.filter((d) => d.days === 1).length,
  };
  if (entries.length === 0) return result;
  await repo.enqueue(entries);
  logger?.info('[enqueueMonthlyHeadsUp] linhas tentadas na fila', { correlationId, ...result });
  return result;
}
