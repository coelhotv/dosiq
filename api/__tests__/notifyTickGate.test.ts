// Spec 109 Slice A — gate do tick no handler REAL de api/notify.ts (PO-1, PO-2, PO-5, PO-SEC-2)
// + guarda estrutural predicado do gate × query do job (T012, INV-4).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));

// ─── Client espião: conta TODA requisição ao Supabase feita pelo handler ────────────────────
const spy = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  rpcResult: null as null | (() => Promise<{ data: unknown; error: unknown }>),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (...a: unknown[]) => {
      spy.rpc(...a);
      return { abortSignal: () => (spy.rpcResult ? spy.rpcResult() : Promise.resolve({ data: null, error: null })) };
    },
    from: (...a: unknown[]) => {
      spy.from(...a);
      throw new Error('from() inesperado no teste');
    },
  }),
}));
vi.mock('ws', () => ({ default: {} }));
vi.mock('expo-server-sdk', () => ({ Expo: class {} }));

const jobs = vi.hoisted(() => ({
  checkReminders: vi.fn(async (_bot: unknown, _opts: unknown) => undefined),
  runDailyDigest: vi.fn(async () => undefined),
  runDailyAdherenceReport: vi.fn(async () => undefined),
  checkStockAlerts: vi.fn(async () => undefined),
  checkAdherenceReports: vi.fn(async () => undefined),
  checkTitrationAlerts: vi.fn(async () => undefined),
  checkPrescriptionAlerts: vi.fn(async () => undefined),
  checkMonthlyReport: vi.fn(async () => undefined),
  sendDLQDigest: vi.fn(async () => undefined),
  runOutboxCycle: vi.fn(async (_params: unknown) => ({ enqueuedByKind: {}, drain: {} })),
  enqueueStockAlerts: vi.fn(async () => ({ usersInWindow: 0, attempted: 0, attemptedExpiry: 0 })),
  captureServerException: vi.fn(),
}));

vi.mock('../../server/bot/tasks.js', () => ({
  checkReminders: jobs.checkReminders,
  runDailyDigest: jobs.runDailyDigest,
  runDailyAdherenceReport: jobs.runDailyAdherenceReport,
  checkStockAlerts: jobs.checkStockAlerts,
  checkAdherenceReports: jobs.checkAdherenceReports,
  checkTitrationAlerts: jobs.checkTitrationAlerts,
  checkPrescriptionAlerts: jobs.checkPrescriptionAlerts,
  checkMonthlyReport: jobs.checkMonthlyReport,
  sendDLQDigest: jobs.sendDLQDigest,
}));
vi.mock('../../server/notifications/outbox/runOutboxCycle.js', () => ({ runOutboxCycle: jobs.runOutboxCycle }));
vi.mock('../../server/notifications/outbox/outboxRepository.js', () => ({ createOutboxRepository: () => ({}) }));
vi.mock('../../server/bot/outbox/enqueueStockAlerts.js', () => ({ enqueueStockAlerts: jobs.enqueueStockAlerts }));
vi.mock('../../server/bot/outbox/stockExpiryContent.js', () => ({ buildStockExpiryContent: vi.fn() }));
vi.mock('../../server/bot/outbox/stockAlertContent.js', () => ({ buildStockAlertContent: vi.fn() }));
vi.mock('../../server/bot/_adherenceHelpers.js', () => ({
  buildDailyAdherenceData: vi.fn(), buildWeeklyAdherenceData: vi.fn(), buildMonthlyReportData: vi.fn(),
}));
vi.mock('../../server/bot/reminders/dailyDigest.js', () => ({ buildDailyDigestData: vi.fn() }));
vi.mock('../_shared/cronDispatcher.js', () => ({
  createCronDispatcher: () => ({ dispatch: vi.fn() }),
  createNotifyBotAdapter: () => ({}),
}));
vi.mock('../../server/observability/sentry.js', () => ({
  initSentry: vi.fn(),
  captureServerException: jobs.captureServerException,
  flushSentry: vi.fn(async () => undefined),
  withServerIsolation: (fn: () => Promise<unknown>) => fn(),
  withServerMonitor: (_m: unknown, fn: () => Promise<unknown>) => fn(),
  CRITICAL_DELIVERY_AUDIT_MONITOR: {},
}));
vi.mock('../../server/observability/criticalDeliveryAudit.js', () => ({ runCriticalDeliveryAudit: vi.fn() }));
vi.mock('../../server/observability/accessLogHealth.js', () => ({ runAccessLogHealth: vi.fn() }));

const ALL_KINDS = 'daily_adherence,weekly_adherence,monthly_report,daily_digest,stock_alert,stock_expiry_alert';
// terça 2026-10-27 03:17 SP — fora de hora fixa e de qualquer janela
const IDLE_INSTANT = new Date('2026-10-27T06:17:00Z');
const PROFILE = { timezone: 'Asia/Kathmandu', notification_mode: 'realtime', digest_time: '05:45:00' };
const work = (over: Record<string, unknown> = {}) => ({
  reminders_due: false, la_start_due: false, la_active: false, outbox_pending: false, profiles: [PROFILE], ...over,
});

const ENV_KEYS = ['TICK_GATE', 'OUTBOX_KINDS', 'REMINDER_SOURCE', 'CRON_SECRET', 'TELEGRAM_BOT_TOKEN'] as const;
const savedEnv: Record<string, string | undefined> = {};

async function runTick(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  process.env.CRON_SECRET = 'segredo';
  process.env.TELEGRAM_BOT_TOKEN = 'tok';
  process.env.OUTBOX_KINDS = ALL_KINDS;
  process.env.REMINDER_SOURCE = 'instances';
  delete process.env.TICK_GATE;
  Object.assign(process.env, env);
  vi.resetModules(); // OUTBOX_KINDS é lido no carregamento do módulo
  const { default: handler } = await import('../notify.js');
  const res = { statusCode: 0, body: null as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  await handler({ method: 'POST', url: '/api/notify', headers: { authorization: 'Bearer segredo' } }, res);
  return res;
}

const requests = () => spy.rpc.mock.calls.length + spy.from.mock.calls.length;

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(IDLE_INSTANT);
  spy.rpcResult = () => Promise.resolve({ data: work(), error: null });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('tick com TICK_GATE=on', () => {
  it('PO-1: minuto ocioso faz ≤ 2 requisições (alvo 1) e nenhum job por minuto roda', async () => {
    const res = await runTick({ TICK_GATE: 'on' });
    expect(res.statusCode).toBe(200);
    expect(requests()).toBeLessThanOrEqual(2);
    expect(spy.rpc).toHaveBeenCalledTimes(1);
    expect(spy.rpc.mock.calls[0][0]).toBe('notify_tick_work');
    expect(jobs.checkReminders).not.toHaveBeenCalled();
    expect(jobs.runOutboxCycle).not.toHaveBeenCalled();
    expect(jobs.enqueueStockAlerts).not.toHaveBeenCalled();
    expect(jobs.runDailyDigest).not.toHaveBeenCalled();
    expect(jobs.captureServerException).not.toHaveBeenCalled();
  });

  it('PO-2: dose devida ⇒ reminders roda com o plano', async () => {
    spy.rpcResult = () => Promise.resolve({ data: work({ reminders_due: true }), error: null });
    await runTick({ TICK_GATE: 'on' });
    expect(jobs.checkReminders).toHaveBeenCalledTimes(1);
    const opts = jobs.checkReminders.mock.calls[0][1] as { gate: { reminders: boolean; laStart: boolean } };
    expect(opts.gate.reminders).toBe(true);
    expect(opts.gate.laStart).toBe(false);
    expect(jobs.runOutboxCycle).not.toHaveBeenCalled();
  });

  it.each(['la_start_due', 'la_active'])('PO-2: %s ⇒ reminders roda (LA mora dentro dele)', async (flag) => {
    spy.rpcResult = () => Promise.resolve({ data: work({ [flag]: true }), error: null });
    await runTick({ TICK_GATE: 'on' });
    expect(jobs.checkReminders).toHaveBeenCalledTimes(1);
  });

  it('PO-2: outbox pendente fora de janela ⇒ só o drain (sem enqueue de relatório nem de estoque)', async () => {
    spy.rpcResult = () => Promise.resolve({ data: work({ outbox_pending: true }), error: null });
    await runTick({ TICK_GATE: 'on' });
    expect(jobs.runOutboxCycle).toHaveBeenCalledTimes(1);
    expect((jobs.runOutboxCycle.mock.calls[0][0] as { skipReportEnqueue: boolean }).skipReportEnqueue).toBe(true);
    expect(jobs.enqueueStockAlerts).not.toHaveBeenCalled();
    expect(jobs.checkReminders).not.toHaveBeenCalled();
  });

  it('PO-3: janela de estoque (10:00 local) ⇒ enqueue de estoque + ciclo', async () => {
    vi.setSystemTime(new Date('2026-10-27T13:02:00Z'));
    spy.rpcResult = () => Promise.resolve({ data: work({ profiles: [{ ...PROFILE, timezone: 'America/Sao_Paulo' }] }), error: null });
    await runTick({ TICK_GATE: 'on' });
    expect(jobs.enqueueStockAlerts).toHaveBeenCalledTimes(1);
    expect(jobs.runOutboxCycle).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['erro da RPC', () => Promise.resolve({ data: null, error: { message: 'Could not find the function' } })],
    ['abort por timeout', () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))],
    ['resposta malformada', () => Promise.resolve({ data: { reminders_due: 'sim' }, error: null })],
  ])('PO-5: %s ⇒ falha aberta (todos os jobs por minuto) + Sentry', async (_l, result) => {
    spy.rpcResult = result;
    const res = await runTick({ TICK_GATE: 'on', OUTBOX_KINDS: 'daily_adherence' });
    expect(res.statusCode).toBe(200);
    expect(jobs.checkReminders).toHaveBeenCalledTimes(1);
    expect((jobs.checkReminders.mock.calls[0][1] as { gate: { failOpen: boolean } }).gate.failOpen).toBe(true);
    expect(jobs.runOutboxCycle).toHaveBeenCalledTimes(1);
    expect((jobs.runOutboxCycle.mock.calls[0][0] as { skipReportEnqueue: boolean }).skipReportEnqueue).toBe(false);
    expect(jobs.runDailyDigest).toHaveBeenCalledTimes(1); // legado (daily_digest fora da outbox)
    expect(jobs.captureServerException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ job: 'tick_gate' }));
  });

  it('PO-SEC-2: log do plano não carrega perfis/fusos', async () => {
    const logs: string[] = [];
    const orig = console.log;
    const capture = (...a: unknown[]) => { logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(capture));
    try {
      await runTick({ TICK_GATE: 'on' });
    } finally {
      spies.forEach((s) => s.mockRestore());
      console.log = orig;
    }
    const all = logs.join('\n');
    expect(all).toContain('[tick_gate] plano');
    expect(all).not.toContain('Kathmandu');
    expect(all).not.toContain('05:45');
  });
});

describe('tick sem TICK_GATE (deploy inerte)', () => {
  it('não chama a RPC e roda os jobs por minuto como antes', async () => {
    await runTick({});
    expect(spy.rpc).not.toHaveBeenCalled();
    expect(jobs.checkReminders).toHaveBeenCalledTimes(1);
    expect((jobs.checkReminders.mock.calls[0][1] as { gate?: unknown }).gate).toBeUndefined();
    expect(jobs.runOutboxCycle).toHaveBeenCalledTimes(1);
    expect(jobs.enqueueStockAlerts).toHaveBeenCalledTimes(1);
  });
});

// ─── T012: guarda estrutural — predicado do gate × filtro do job (INV-4) ────────────────────
// Pega remoção/alteração de filtro de um lado só. Não prova lógica: isso é a paridade no QA (E-3).
describe('INV-4: predicados do gate espelham os jobs', () => {
  const read = (p: string) => readFileSync(resolve(aqui, '..', '..', p), 'utf8');
  const migration = read('docs/migrations/20261023_109_notify_tick_work.sql');
  const reminders = read('server/bot/reminders/doseReminders.ts');
  const laStart = read('server/notifications/apns/dispatchLiveActivityStarts.ts');
  const laLife = read('server/notifications/apns/dispatchLiveActivityLifecycle.ts');
  const outbox = read('docs/migrations/20260707_notification_outbox.sql');
  const gate = read('server/notifications/tick/tickGate.ts');

  it.each([
    ['lembrete não-adiado', reminders, [".is('notified_at', null)", ".is('snoozed_until', null)", ".lt('scheduled_for', windowEnd)"],
      ['d.notified_at IS NULL AND d.snoozed_until IS NULL', 'd.scheduled_for < t.m0 + interval']],
    ['lembrete adiado', reminders, [".not('snoozed_until', 'is', null)", ".lt('snoozed_until', windowEnd)"],
      ['d.snoozed_until IS NOT NULL', 'd.snoozed_until < t.m0 + interval']],
    ['LA start', laStart, [".eq('critical_alarm', true)", ".is('la_push_started_at', null)", ".lte('scheduled_for', windowEnd)"],
      ['d.critical_alarm = true AND d.la_push_started_at IS NULL', 'd.scheduled_for <= t.now_ + make_interval']],
    ['LA lifecycle', laLife, [".not('la_push_token', 'is', null)", 'addMinutes(-24 * 60, now)'],
      ["d.la_push_token IS NOT NULL AND d.scheduled_for >= t.now_ - interval '24 hours'"]],
    ['claim da outbox', outbox, ["status = 'processing' AND claimed_at < now() - interval '15 minutes'"],
      ["o.status = 'processing' AND o.claimed_at < t.now_ - interval '15 minutes'"]],
  ])('%s', (_l, jobSrc, jobNeedles, gateNeedles) => {
    for (const n of jobNeedles as string[]) expect(jobSrc).toContain(n);
    for (const n of gateNeedles as string[]) expect(migration).toContain(n);
  });

  it('lead default da LA é o mesmo no job e no gate', () => {
    expect(laStart).toContain('const DEFAULT_LEAD_MINUTES = 60');
    expect(gate).toContain('const DEFAULT_LA_LEAD_MINUTES = 60');
  });
});
