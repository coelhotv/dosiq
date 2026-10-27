// Spec 109 Slice A — gate do tick (PO-2 plano, PO-3 janelas, PO-5 falha aberta, PO-SEC-2 log).
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  fetchTickWork,
  planTick,
  summarizeTick,
  resolveLaLeadMinutes,
  FAIL_OPEN_PLAN,
  type TickWork,
  type TickGateClient,
} from '../tickGate.js';

const ALL_KINDS = new Set(['daily_adherence', 'weekly_adherence', 'monthly_report', 'daily_digest', 'stock_alert', 'stock_expiry_alert']);
const SP_PROFILE = { timezone: 'America/Sao_Paulo', notification_mode: 'realtime', digest_time: '07:00:00' };
// terça 2026-10-27 03:17 SP — fora de qualquer janela
const IDLE_NOW = new Date('2026-10-27T06:17:00Z');

const work = (over: Partial<TickWork> = {}): TickWork => ({
  remindersDue: false, laStartDue: false, laActive: false, outboxPending: false,
  profiles: [SP_PROFILE], ...over,
});
const plan = (w: TickWork, now = IDLE_NOW, kinds: Set<string> = ALL_KINDS, reminderSource = 'instances') =>
  planTick(w, { now, outboxKinds: kinds, reminderSource });

function clientReturning(result: Promise<{ data: unknown; error: { message?: string } | null }>) {
  const abortSignal = vi.fn((_signal: AbortSignal) => result);
  const rpc = vi.fn(() => ({ abortSignal }));
  return { client: { rpc } as unknown as TickGateClient, rpc, abortSignal };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('planTick — minuto ocioso', () => {
  it('nenhum job por minuto roda', () => {
    expect(plan(work())).toEqual({
      reminders: false, laStart: false, laLifecycle: false, outboxCycle: false,
      reportEnqueue: false, stockEnqueue: false, legacyDigest: false, failOpen: false,
    });
  });
});

describe('planTick — cada categoria liga o seu job (PO-2)', () => {
  it.each([
    ['remindersDue', 'reminders'],
    ['laStartDue', 'laStart'],
    ['laActive', 'laLifecycle'],
    ['outboxPending', 'outboxCycle'],
  ] as const)('%s ⇒ %s', (flag, job) => {
    const p = plan(work({ [flag]: true }));
    expect(p[job]).toBe(true);
    const others = (['reminders', 'laStart', 'laLifecycle', 'outboxCycle'] as const).filter((j) => j !== job);
    for (const o of others) expect(p[o]).toBe(false);
  });

  it('ramo legado de lembrete (REMINDER_SOURCE ≠ instances) roda sempre — CP-3', () => {
    const p = plan(work(), IDLE_NOW, ALL_KINDS, 'protocols');
    expect(p.reminders && p.laStart && p.laLifecycle).toBe(true);
  });
});

describe('planTick — janelas de enfileiramento (PO-3)', () => {
  it.each([
    ['diário 09:00 terça', '2026-10-27T12:00:00Z'],
    ['semanal domingo 09:05', '2026-10-25T12:05:00Z'],
    ['mensal dia 1 09:09', '2026-11-01T12:09:00Z'],
  ])('%s ⇒ reportEnqueue e ciclo da outbox', (_l, iso) => {
    const p = plan(work(), new Date(iso));
    expect(p.reportEnqueue).toBe(true);
    expect(p.outboxCycle).toBe(true);
  });

  it('digest da outbox: digest_time 06:30 abre 06:30–06:39 só p/ digest_morning', () => {
    const w = work({ profiles: [{ timezone: 'America/Sao_Paulo', notification_mode: 'digest_morning', digest_time: '06:30:00' }] });
    expect(plan(w, new Date('2026-10-27T09:39:00Z')).reportEnqueue).toBe(true);
    expect(plan(w, new Date('2026-10-27T09:40:00Z')).reportEnqueue).toBe(false);
    const realtime = work({ profiles: [{ ...SP_PROFILE, digest_time: '06:30:00' }] });
    expect(plan(realtime, new Date('2026-10-27T09:35:00Z')).reportEnqueue).toBe(false);
  });

  it('estoque 10:00–10:09 local ⇒ stockEnqueue; sem os dois kinds ⇒ nunca (CP-5)', () => {
    const at10 = new Date('2026-10-27T13:03:00Z');
    expect(plan(work(), at10).stockEnqueue).toBe(true);
    expect(plan(work(), at10, new Set(['stock_alert'])).stockEnqueue).toBe(false);
    expect(plan(work(), new Date('2026-10-27T13:10:00Z')).stockEnqueue).toBe(false);
  });

  it('kinds não migrados ⇒ sem enqueue de relatório', () => {
    expect(plan(work(), new Date('2026-10-27T12:00:00Z'), new Set()).reportEnqueue).toBe(false);
  });

  it('digest legado: minuto exato, só quando daily_digest NÃO está na outbox', () => {
    const w = work({ profiles: [{ timezone: null, notification_mode: 'digest_morning', digest_time: null }] });
    const at7 = new Date('2026-10-27T10:00:20Z'); // 07:00 SP; tz NULL ⇒ SP, digest NULL ⇒ 07:00 (FM-3/FM-6)
    const legacyKinds = new Set(['daily_adherence']);
    expect(plan(w, at7, legacyKinds).legacyDigest).toBe(true);
    expect(plan(w, new Date('2026-10-27T10:01:00Z'), legacyKinds).legacyDigest).toBe(false);
    expect(plan(w, at7, ALL_KINDS).legacyDigest).toBe(false);
  });

  it('fuso inválido abre a janela em vez de derrubar o plano (FM-2)', () => {
    const w = work({ profiles: [SP_PROFILE, { timezone: 'Mars/Olympus', notification_mode: 'realtime', digest_time: null }] });
    const p = plan(w);
    expect(p.reportEnqueue).toBe(true);
    expect(p.stockEnqueue).toBe(true);
  });
});

describe('fetchTickWork', () => {
  const now = new Date('2026-10-27T06:17:00Z');
  const ok = { reminders_due: false, la_start_due: true, la_active: false, outbox_pending: false, profiles: [SP_PROFILE] };

  it('1 chamada com p_now do tick, lead e timeout de 3 s', async () => {
    const { client, rpc, abortSignal } = clientReturning(Promise.resolve({ data: ok, error: null }));
    const w = await fetchTickWork({ supabase: client, now, laLeadMinutes: 45 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('notify_tick_work', { p_now: now.toISOString(), p_la_lead_minutes: 45 });
    expect(abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(w.laStartDue).toBe(true);
    expect(w.profiles).toHaveLength(1);
  });

  it('erro da RPC (FM-5) lança com o nome da função', async () => {
    const { client } = clientReturning(Promise.resolve({ data: null, error: { message: 'Could not find the function' } }));
    await expect(fetchTickWork({ supabase: client, now, laLeadMinutes: 60 })).rejects.toThrow(/notify_tick_work falhou/);
  });

  it('abort por timeout (FM-11) propaga', async () => {
    const { client } = clientReturning(Promise.reject(new DOMException('aborted', 'TimeoutError')));
    await expect(fetchTickWork({ supabase: client, now, laLeadMinutes: 60, timeoutMs: 1 })).rejects.toThrow();
  });

  it.each([
    ['null', null],
    ['campo ausente', { reminders_due: true, profiles: [] }],
    ['profiles não-array', { ...ok, profiles: null }],
  ])('resposta malformada (%s) lança — FM-12', async (_l, data) => {
    const { client } = clientReturning(Promise.resolve({ data, error: null }));
    await expect(fetchTickWork({ supabase: client, now, laLeadMinutes: 60 })).rejects.toThrow(/malformada/);
  });
});

describe('falha aberta e log', () => {
  it('FAIL_OPEN_PLAN liga todos os jobs (INV-1)', () => {
    const { failOpen, ...jobs } = FAIL_OPEN_PLAN;
    expect(failOpen).toBe(true);
    expect(Object.values(jobs).every(Boolean)).toBe(true);
  });

  it('resolveLaLeadMinutes usa a expressão do job (FM-13)', () => {
    expect(resolveLaLeadMinutes(undefined)).toBe(60);
    expect(resolveLaLeadMinutes('abc')).toBe(60);
    expect(resolveLaLeadMinutes('30')).toBe(30);
  });

  it('resumo do tick não carrega perfis nem fusos (PO-SEC-2)', () => {
    const w = work({ profiles: [{ timezone: 'Asia/Kathmandu', notification_mode: 'digest_morning', digest_time: '05:45:00' }] });
    const serialized = JSON.stringify(summarizeTick(plan(w), w));
    expect(serialized).not.toContain('profiles');
    expect(serialized).not.toContain('Kathmandu');
    expect(serialized).not.toContain('05:45');
    expect(serialized).toContain('"profileCount":1');
  });
});
