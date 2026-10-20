// pruneEnqueue.ts — job diário que alimenta a fila de exclusão (spec 107 FR-002).
//
// Faz quatro coisas, nesta ordem, e NENHUMA delas apaga nada:
//   1. abre linha na fila no INÍCIO de cada relógio (revogado · legado após onda 2 · onboarding);
//      para quem nunca consentiu grava antes o ato do controlador `scheduled_deletion` (INV-3);
//   2. reavalia as linhas vivas: autorizou ⇒ void('granted'); conta sumiu ⇒ void('self_deleted');
//      adiada com reevaluate_at vencido ⇒ volta a pending;
//   3. avisos D+60/D+83: push para quem tem aparelho ativo; quem não tem entra na contagem de
//      "avisos por e-mail devidos" (envio manual assistido, RC3 E-3) — NUNCA grava notice_sent
//      sem envio real (F-6);
//   4. alerta ao admin por push (só contagens, S-7); falha ⇒ Sentry, nunca silêncio (AS-2.1).
//
// Volumes (AP-186): revogados, contas sem consentimento e linhas vivas são dezenas hoje; os
// selects abaixo não paginam e o teto de avisos (50) aborta antes de um volume anômalo agir.

import { createLogger } from '../../server/bot/logger.js';
import {
  checkEligibility,
  countNoticesSince,
  sendDueNotice,
  isPruneEnabled,
  resolveCap,
  PRUNE_DEFAULT_NOTICE_CAP,
  type ConsentPruneClient,
} from '../../server/bot/consentPrune.js';
import {
  addDays,
  alertState,
  dueNoticeStage,
  daysBetween,
  isApprovable,
  noticesComplete,
  d83Start,
  REQUIRED_NOTICES,
  ONBOARDING_GRACE_DAYS,
  ONBOARDING_RULE_START,
  PRUNE_CLOCK_DAYS,
  WAVE2_GRACE_DAYS,
} from './pruneRules.js';

const logger = createLogger('PruneEnqueue');

const LIVE = ['pending', 'approved', 'deferred'];

export interface PruneEnqueueDeps {
  supabase: ConsentPruneClient;
  dispatcher: { dispatch(input: any): Promise<any> };
  adminUserId: string | undefined;
  env?: Record<string, string | undefined>;
  now?: Date;
  correlationId?: string;
  /** Sentry do servidor. Injetado nos testes. */
  capture?: (error: unknown, context?: Record<string, unknown>) => void;
}

export interface PruneEnqueueResult {
  enabled: boolean;
  enqueued: number;
  voided: number;
  reactivated: number;
  pushNoticed: number;
  emailsDue: number;
  overdue: number;
  red: number;
  adminAlerted: boolean;
  aborted?: string;
}

interface LiveRow {
  id: string;
  user_id: string;
  reason: 'revoked_90d' | 'legacy_no_consent' | 'onboarding_no_consent';
  scheduled_at: string;
  eligible_at: string;
  decision: string;
  reevaluate_at: string | null;
  executed_at: string | null;
}

async function audit(supabase: ConsentPruneClient, row: { queue_id?: string | null; user_id: string; action: string; detail?: object }) {
  const { error } = await supabase.from('prune_queue_audit').insert({
    queue_id: row.queue_id ?? null,
    user_id: row.user_id,
    action: row.action,
    actor: 'job:prune_enqueue',
    detail: row.detail ?? {},
  });
  if (error) logger.error('Auditoria da fila falhou', error, { userId: row.user_id, action: row.action });
}

/** Abre a linha. `scheduled_deletion` (quando exigido) é gravado ANTES: sem prova, sem relógio. */
async function openRow(
  supabase: ConsentPruneClient,
  input: { user_id: string; reason: LiveRow['reason']; scheduled_at: string },
): Promise<boolean> {
  if (input.reason !== 'revoked_90d') {
    const { error } = await supabase.rpc('consent_controller_event', {
      p_user_id: input.user_id,
      p_action: 'scheduled_deletion',
      p_consent_type: 'health_data',
    });
    if (error) {
      logger.error('scheduled_deletion não gravado — linha NÃO aberta (sem prova, sem relógio)', error, { userId: input.user_id });
      return false;
    }
  }
  const { data, error } = await supabase
    .from('prune_queue')
    .insert({
      user_id: input.user_id,
      reason: input.reason,
      scheduled_at: input.scheduled_at,
      eligible_at: addDays(input.scheduled_at, PRUNE_CLOCK_DAYS),
    })
    .select('id')
    .single();
  if (error) {
    // 23505 = já existe linha viva (corrida entre pings): inofensivo.
    if (error.code !== '23505') logger.error('Linha da fila não aberta', error, { userId: input.user_id });
    return false;
  }
  await audit(supabase, { queue_id: data?.id, user_id: input.user_id, action: 'enqueue', detail: { reason: input.reason } });
  return true;
}

type Ctx = Required<Pick<PruneEnqueueDeps, 'supabase' | 'dispatcher'>> & {
  env: Record<string, string | undefined>;
  now: Date;
  correlationId?: string;
  adminUserId?: string;
  capture: NonNullable<PruneEnqueueDeps['capture']>;
  result: PruneEnqueueResult;
};

const LIVE_SELECT = 'id, user_id, reason, scheduled_at, eligible_at, decision, reevaluate_at, executed_at';

async function fetchLive(supabase: ConsentPruneClient): Promise<LiveRow[]> {
  const { data, error } = await supabase.from('prune_queue').select(LIVE_SELECT).in('decision', LIVE).is('executed_at', null);
  if (error) throw new Error(`prune_queue ilegível: ${error.message}`);
  return (data ?? []) as LiveRow[];
}

/** Menor data de marcação da onda 2 por conta (auditoria do admin, G-3). */
async function fetchWave2Marks(supabase: ConsentPruneClient): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('prune_queue_audit')
    .select('user_id, created_at')
    .eq('action', 'mark_notice')
    .eq('detail->>milestone', 'wave2');
  if (error) throw new Error(`auditoria da onda 2 ilegível: ${error.message}`);
  const marks = new Map<string, string>();
  for (const m of (data ?? []) as Array<{ user_id: string; created_at: string }>) {
    const prev = marks.get(m.user_id);
    if (!prev || m.created_at < prev) marks.set(m.user_id, m.created_at);
  }
  return marks;
}

/** Onde começa o relógio de quem nunca consentiu — ou `null` se ainda não começou. */
function unconsentedClock(
  acc: { created_at: string },
  markedAt: string | undefined,
  now: Date,
): { reason: LiveRow['reason']; scheduled_at: string } | null {
  if (acc.created_at >= ONBOARDING_RULE_START) {
    if (daysBetween(acc.created_at, now) < ONBOARDING_GRACE_DAYS) return null;
    return { reason: 'onboarding_no_consent', scheduled_at: addDays(acc.created_at, ONBOARDING_GRACE_DAYS) };
  }
  // Legado: SÓ depois do e-mail da onda 2 marcado + 7 dias (FR-007, INV-6).
  if (!markedAt || daysBetween(markedAt, now) < WAVE2_GRACE_DAYS) return null;
  return { reason: 'legacy_no_consent', scheduled_at: addDays(markedAt, WAVE2_GRACE_DAYS) };
}

/** Etapa 1 — abre a linha no início de cada relógio. */
async function openNewRows(ctx: Ctx): Promise<void> {
  const { supabase, now, result } = ctx;
  const hasLive = new Set((await fetchLive(supabase)).map((r) => r.user_id));
  const open = async (user_id: string, clock: { reason: LiveRow['reason']; scheduled_at: string }) => {
    if (await openRow(supabase, { user_id, ...clock })) {
      result.enqueued += 1;
      hasLive.add(user_id);
    }
  };

  const revoked = await supabase.from('user_settings').select('user_id, consent_revoked_at').not('consent_revoked_at', 'is', null);
  if (revoked.error) throw new Error(`user_settings ilegível: ${revoked.error.message}`);
  for (const r of (revoked.data ?? []) as Array<{ user_id: string; consent_revoked_at: string }>) {
    if (!hasLive.has(r.user_id)) await open(r.user_id, { reason: 'revoked_90d', scheduled_at: r.consent_revoked_at });
  }

  const unconsented = await supabase.rpc('prune_unconsented_accounts');
  if (unconsented.error) throw new Error(`prune_unconsented_accounts falhou: ${unconsented.error.message}`);
  const marks = await fetchWave2Marks(supabase);
  for (const acc of (unconsented.data ?? []) as Array<{ user_id: string; created_at: string }>) {
    if (hasLive.has(acc.user_id)) continue;
    const clock = unconsentedClock(acc, marks.get(acc.user_id), now);
    if (clock) await open(acc.user_id, clock);
  }
}

/** Etapa 2 — autorizou/sumiu ⇒ void; adiada vencida ⇒ pending. Devolve as que seguem vivas. */
async function reevaluate(ctx: Ctx): Promise<LiveRow[]> {
  const { supabase, now, result } = ctx;
  const stillLive: LiveRow[] = [];
  for (const row of await fetchLive(supabase)) {
    const state = await checkEligibility(supabase, { user_id: row.user_id, reason: row.reason });
    if (state === 'resolved' || state === 'gone') {
      const voidReason = state === 'resolved' ? 'granted' : 'self_deleted';
      const { error } = await supabase.from('prune_queue').update({ decision: 'void', void_reason: voidReason }).eq('id', row.id).is('executed_at', null);
      if (!error) {
        result.voided += 1;
        await audit(supabase, { queue_id: row.id, user_id: row.user_id, action: 'void', detail: { void_reason: voidReason } });
      }
      continue;
    }
    // 'unknown' não decide nada aqui — só o executor precisa de certeza, e ele reconfere.
    if (row.decision === 'deferred' && row.reevaluate_at && Date.parse(row.reevaluate_at) <= now.getTime()) {
      const { error } = await supabase.from('prune_queue').update({ decision: 'pending' }).eq('id', row.id).eq('decision', 'deferred');
      if (!error) { result.reactivated += 1; row.decision = 'pending'; }
    }
    stillLive.push(row);
  }
  return stillLive;
}

/**
 * Aviso por e-mail ainda pendente? Mesma regra da tela (`pruneSection`): D+60 se nada foi enviado;
 * D+83 se nada foi enviado desde o D+83 e ainda não há 2. Leitura falhou ⇒ não conta (não incomoda).
 */
async function emailNoticeMissing(
  supabase: ConsentPruneClient,
  row: LiveRow,
  notice: { stage: 'd60' | 'd83' } | null,
): Promise<boolean> {
  if (!notice) return false;
  const sent = await countNoticesSince(supabase, row.user_id, row.scheduled_at);
  if (sent === null) return false;
  if (notice.stage === 'd60') return sent < 1;
  const fromD83 = await countNoticesSince(supabase, row.user_id, d83Start(row.scheduled_at));
  return fromD83 !== null && fromD83 < 1 && sent < REQUIRED_NOTICES;
}

/** Etapa 3 — push para quem tem aparelho; sem push vira "e-mail devido" (F-6, nunca notice_sent sem envio). */
async function sendNotices(ctx: Ctx, rows: LiveRow[]): Promise<void> {
  const { supabase, dispatcher, env, now, correlationId, result } = ctx;
  const due = rows.map((row) => ({ row, notice: dueNoticeStage(row.scheduled_at, now) })).filter((x) => x.notice !== null);
  if (due.length === 0) return;
  const noticeCap = resolveCap(env.CONSENT_PRUNE_NOTICE_CAP, PRUNE_DEFAULT_NOTICE_CAP);
  if (due.length > noticeCap) {
    logger.error('Avisos acima do teto — nenhum enviado neste run', null, { correlationId, due: due.length, noticeCap });
    result.aborted = 'notice_cap_exceeded';
    return;
  }
  const devices = await supabase.from('notification_devices').select('user_id').in('user_id', due.map((x) => x.row.user_id)).eq('is_active', true);
  if (devices.error) throw new Error(`notification_devices ilegível: ${devices.error.message}`);
  const withPush = new Set(((devices.data ?? []) as Array<{ user_id: string }>).map((d) => d.user_id));

  for (const { row, notice } of due) {
    if (withPush.has(row.user_id)) {
      const outcome = await sendDueNotice(supabase, dispatcher, {
        userId: row.user_id, days: daysBetween(row.scheduled_at, now), since: row.scheduled_at, correlationId,
      });
      if (outcome === 'noticed') result.pushNoticed += 1;
      continue;
    }
    if (await emailNoticeMissing(supabase, row, notice)) result.emailsDue += 1;
  }
}

/**
 * Etapa 3b — linhas no prazo SEM os 2 avisos (cron caiu na janela, e-mail não marcado): o admin
 * precisa mandar o reaviso (FR-014). Entram na contagem de e-mails a enviar do alerta.
 */
async function countBlocked(ctx: Ctx, rows: LiveRow[]): Promise<void> {
  const { supabase, now, result } = ctx;
  const candidates = rows.filter((r) => r.decision !== 'approved' && dueNoticeStage(r.scheduled_at, now) === null && isApprovable(r, now));
  if (candidates.length === 0) return;
  const marks = await supabase
    .from('prune_queue_audit')
    .select('queue_id')
    .in('queue_id', candidates.map((r) => r.id))
    .eq('action', 'mark_notice')
    .eq('detail->>milestone', 'reaviso');
  if (marks.error) throw new Error(`auditoria do reaviso ilegível: ${marks.error.message}`);
  const withReaviso = new Set(((marks.data ?? []) as Array<{ queue_id: string }>).map((m) => m.queue_id));
  for (const row of candidates) {
    if (withReaviso.has(row.id)) continue;
    const sent = await countNoticesSince(supabase, row.user_id, row.scheduled_at);
    const fromD83 = await countNoticesSince(supabase, row.user_id, d83Start(row.scheduled_at));
    if (sent !== null && fromD83 !== null && !noticesComplete(sent, false, fromD83)) result.emailsDue += 1;
  }
}

/** Etapa 4 — alerta ao admin por push (só contagens, S-7); falha ⇒ Sentry (AS-2.1). */
async function alertAdmin(ctx: Ctx, rows: LiveRow[]): Promise<void> {
  const { dispatcher, now, correlationId, adminUserId, capture, result } = ctx;
  for (const row of rows) {
    const s = alertState(row, now);
    if (s.overdue) result.overdue += 1;
    if (s.red) result.red += 1;
  }
  if (result.overdue + result.red + result.emailsDue === 0) return;
  if (!adminUserId) {
    capture(new Error('prune_admin_alert sem ADMIN_USER_ID'), { job: 'prune_enqueue', correlationId });
    return;
  }
  try {
    const sent = await dispatcher.dispatch({
      userId: adminUserId,
      kind: 'prune_admin_alert',
      data: { overdue: result.overdue, red: result.red, emailsDue: result.emailsDue },
      context: { correlationId },
    });
    result.adminAlerted = sent?.success === true;
    if (!result.adminAlerted) capture(new Error('prune_admin_alert não entregue'), { job: 'prune_enqueue', correlationId });
  } catch (err) {
    capture(err, { job: 'prune_enqueue', correlationId });
  }
}

export async function runPruneEnqueue(deps: PruneEnqueueDeps): Promise<PruneEnqueueResult> {
  const env = deps.env ?? process.env;
  const result: PruneEnqueueResult = {
    enabled: isPruneEnabled(env), enqueued: 0, voided: 0, reactivated: 0,
    pushNoticed: 0, emailsDue: 0, overdue: 0, red: 0, adminAlerted: false,
  };
  if (!result.enabled) {
    logger.warn('Fila DESLIGADA por kill-switch (CONSENT_PRUNE_ENABLED)', { correlationId: deps.correlationId });
    return result;
  }
  const ctx: Ctx = {
    supabase: deps.supabase,
    dispatcher: deps.dispatcher,
    env,
    // eslint-disable-next-line no-restricted-syntax -- instante absoluto, não data civil (R-020)
    now: deps.now ?? new Date(),
    correlationId: deps.correlationId,
    adminUserId: deps.adminUserId,
    capture: deps.capture ?? (() => {}),
    result,
  };

  await openNewRows(ctx);
  const live = await reevaluate(ctx);
  await sendNotices(ctx, live);
  await countBlocked(ctx, live);
  await alertAdmin(ctx, live);

  logger.info('prune_enqueue concluído', { correlationId: ctx.correlationId, ...result });
  return result;
}
