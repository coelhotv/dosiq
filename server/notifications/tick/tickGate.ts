// Spec 109 Slice A — gate do tick do cron de notificação (ADR-115).
//
// Uma chamada (`public.notify_tick_work`) diz, por categoria, se há trabalho neste minuto; `planTick`
// (puro, sem I/O) traduz isso em quais jobs por minuto rodam. Os jobs de hora fixa ficam fora (FR-003).
//
// INV-1: em dúvida, roda tudo. Erro, timeout ou resposta malformada ⇒ `FAIL_OPEN_PLAN` — quem chama
// captura no Sentry (AP-325). INV-4: o gate só decide SE um job roda; as regras de janela vêm de
// `../windows.ts`, as MESMAS dos jobs.
//
// Nível A (server/notifications): sem import de server/bot (R-283/R-284).

import {
  DEFAULT_TIMEZONE,
  REPORT_KINDS,
  localParts,
  isReportEligible,
  isInStockAlertWindow,
  hhmmInTimezone,
  isLegacyDigestMinute,
} from '../windows.js';

export const TICK_GATE_TIMEOUT_MS = 3000;
// Mesmo default de `dispatchLiveActivityStarts` (DEFAULT_LEAD_MINUTES) — a janela do gate é a do job.
const DEFAULT_LA_LEAD_MINUTES = 60;

export interface TickProfile {
  timezone: string | null;
  notification_mode: string | null;
  digest_time: string | null;
}

export interface TickWork {
  remindersDue: boolean;
  laStartDue: boolean;
  laActive: boolean;
  outboxPending: boolean;
  profiles: TickProfile[];
}

export interface TickPlan {
  reminders: boolean;
  laStart: boolean;
  laLifecycle: boolean;
  /** Ciclo da outbox (enqueue + drain). */
  outboxCycle: boolean;
  reportEnqueue: boolean;
  stockEnqueue: boolean;
  /** Digest LEGADO (`runDailyDigest`), só relevante quando `daily_digest` não está em OUTBOX_KINDS. */
  legacyDigest: boolean;
  failOpen: boolean;
}

export const FAIL_OPEN_PLAN: Readonly<TickPlan> = Object.freeze({
  reminders: true,
  laStart: true,
  laLifecycle: true,
  outboxCycle: true,
  reportEnqueue: true,
  stockEnqueue: true,
  legacyDigest: true,
  failOpen: true,
});

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface TickGateClient {
  rpc(fn: string, args: Record<string, unknown>): { abortSignal(signal: AbortSignal): PromiseLike<RpcResult> };
}

/** Lead da Live Activity com a MESMA expressão do job (`dispatchLiveActivityStarts.ts`). */
export function resolveLaLeadMinutes(raw: string | undefined): number {
  return Number(raw) || DEFAULT_LA_LEAD_MINUTES;
}

function parseWork(data: unknown): TickWork {
  const d = data as Record<string, unknown> | null;
  const bools = ['reminders_due', 'la_start_due', 'la_active', 'outbox_pending'];
  if (!d || typeof d !== 'object' || bools.some((k) => typeof d[k] !== 'boolean') || !Array.isArray(d.profiles)) {
    throw new Error('notify_tick_work falhou: resposta malformada');
  }
  return {
    remindersDue: d.reminders_due as boolean,
    laStartDue: d.la_start_due as boolean,
    laActive: d.la_active as boolean,
    outboxPending: d.outbox_pending as boolean,
    profiles: (d.profiles as TickProfile[]).map((p) => ({
      timezone: p?.timezone ?? null,
      notification_mode: p?.notification_mode ?? null,
      digest_time: p?.digest_time ?? null,
    })),
  };
}

/**
 * Lê o trabalho do minuto. LANÇA em erro, abort por timeout ou resposta malformada — quem chama
 * cai para `FAIL_OPEN_PLAN` e captura (FR-008).
 */
export async function fetchTickWork(params: {
  supabase: TickGateClient;
  now: Date;
  laLeadMinutes: number;
  timeoutMs?: number;
}): Promise<TickWork> {
  const { supabase, now, laLeadMinutes, timeoutMs = TICK_GATE_TIMEOUT_MS } = params;
  let result: RpcResult;
  try {
    result = await supabase
      .rpc('notify_tick_work', { p_now: now.toISOString(), p_la_lead_minutes: laLeadMinutes })
      .abortSignal(AbortSignal.timeout(timeoutMs));
  } catch (err) {
    // Abort chega como DOMException (não é Error no Node) — normaliza p/ o Sentry agrupar pelo nome.
    throw new Error(`notify_tick_work falhou: ${(err as { message?: string })?.message ?? String(err)}`);
  }
  const { data, error } = result;
  if (error) throw new Error(`notify_tick_work falhou: ${error.message ?? String(error)}`);
  return parseWork(data);
}

// Perfil com fuso inválido não pode derrubar a decisão dos outros (FM-2) — e, em dúvida, abre a
// janela: o job roda e isola o usuário como já faz hoje.
function anyProfile(profiles: TickProfile[], test: (p: TickProfile, tz: string) => boolean): boolean {
  return profiles.some((p) => {
    try {
      return test(p, p.timezone || DEFAULT_TIMEZONE);
    } catch {
      return true;
    }
  });
}

/** Traduz o trabalho do minuto em quais jobs por minuto rodam. Puro. */
export function planTick(
  work: TickWork,
  opts: { now: Date; outboxKinds: ReadonlySet<string>; reminderSource?: string },
): TickPlan {
  const { now, outboxKinds, reminderSource } = opts;

  // O gate de lembrete espelha `dose_instances`; o ramo legado lê `protocols` (CP-3) ⇒ roda sempre.
  const instances = reminderSource === 'instances';

  const migratedReports = REPORT_KINDS.filter((k) => outboxKinds.has(k));
  const reportEnqueue = migratedReports.length > 0 &&
    anyProfile(work.profiles, (p, tz) => {
      const parts = localParts(now, tz);
      return migratedReports.some((k) => isReportEligible(k, parts, p));
    });

  // `enqueueStockAlerts` é no-op sem os DOIS kinds (CP-5).
  const stockEnqueue = outboxKinds.has('stock_alert') && outboxKinds.has('stock_expiry_alert') &&
    anyProfile(work.profiles, (_p, tz) => isInStockAlertWindow(now, tz));

  const legacyDigest = !outboxKinds.has('daily_digest') &&
    anyProfile(work.profiles, (p, tz) =>
      p.notification_mode === 'digest_morning' && isLegacyDigestMinute(hhmmInTimezone(now, tz), p.digest_time));

  return {
    reminders: instances ? work.remindersDue : true,
    laStart: instances ? work.laStartDue : true,
    laLifecycle: instances ? work.laActive : true,
    outboxCycle: work.outboxPending || reportEnqueue || stockEnqueue,
    reportEnqueue,
    stockEnqueue,
    legacyDigest,
    failOpen: false,
  };
}

/** Linha de log do tick (E-5). SÓ booleanos e contagens — nunca os perfis (RC-SEC S-3). */
export function summarizeTick(plan: TickPlan, work: TickWork | null): Record<string, unknown> {
  return {
    ...plan,
    profileCount: work ? work.profiles.length : null,
  };
}
