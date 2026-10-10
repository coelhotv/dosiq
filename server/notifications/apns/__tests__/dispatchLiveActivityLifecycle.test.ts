import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { dispatchLiveActivityLifecycle } from '../dispatchLiveActivityLifecycle';

const TEST_P8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const NOW = new Date(Date.UTC(2026, 6, 1, 12, 0, 0));
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// Mock supabase: select(...).not(...) resolve a lista; update(...).eq(...) registra o patch.
function makeSupabase(rows: unknown[]) {
  const updates: Array<Record<string, unknown>> = [];
  const from = () => {
    const b = {
      _update: null as Record<string, unknown> | null,
      select() { return b; },
      not() { return b; },
      gte() { return b; },
      update(p: Record<string, unknown>) { b._update = p; return b; },
      eq() {
        if (b._update) { updates.push(b._update); return Promise.resolve({ data: null, error: null }); }
        return b;
      },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return b;
  };
  return { from, _updates: updates };
}

// scheduled_for relativo a NOW p/ cair no estado desejado (SURFACE_WINDOWS: now ±10, late < -10).
const at = (min: number) => new Date(NOW.getTime() + min * 60000).toISOString();
const row = (over = {}) => ({
  id: 'inst-1', user_id: 'userA', scheduled_for: at(0), critical_alarm: true,
  status: 'pending', la_push_token: 'tok-activity', la_push_state: null,
  protocol: { id: 'p1', name: 'TAG', treatment_plan_id: 'plan1', medicine: { name: 'TAG' } },
  ...over,
});

describe('dispatchLiveActivityLifecycle', () => {
  beforeEach(() => {
    process.env.APNS_AUTH_KEY = Buffer.from(TEST_P8).toString('base64');
    process.env.APNS_KEY_ID = 'KEY123';
    process.env.APNS_TEAM_ID = 'TEAM123';
    process.env.APNS_BUNDLE_ID = 'com.x.dosiq';
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete process.env.APNS_AUTH_KEY; delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID; delete process.env.APNS_BUNDLE_ID;
  });

  it('sem APNs configurado → no-op', async () => {
    delete process.env.APNS_AUTH_KEY;
    const supabase = makeSupabase([row()]);
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW });
    expect(r).toEqual({ processed: 0, updated: 0, ended: 0, skipped: 0, failed: 0 });
  });

  it('estado mudou (now) e la_push_state=null → 1 update + marca la_push_state', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(5), la_push_state: null })]); // now, antes de T0
    const updateFn = vi.fn((_p: { pushToken: string | null | undefined; contentState: Record<string, unknown> }) => Promise.resolve({ ok: true, status: 200 }));
    const endFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn });
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn.mock.calls[0]![0].contentState.state).toBe('now');
    expect(r.updated).toBe(1);
    expect(supabase._updates).toContainEqual({ la_push_state: 'now' });
  });

  it('estado igual ao já empurrado → skip (não spammar APNs)', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(5), la_push_state: 'now' })]);
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });
    expect(updateFn).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
  });

  it('🔴 C-19: `now` empurrado antes de T0 ⇒ em T0 manda UM update (widget troca contador por "agora")', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(0), la_push_state: 'now' })]);
    const updateFn = vi.fn((_p: { pushToken: string | null | undefined; contentState: Record<string, unknown> }) => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn.mock.calls[0]![0].contentState.state).toBe('now'); // widget nunca vê `now_due`
    expect(r.updated).toBe(1);
    expect(supabase._updates).toContainEqual({ la_push_state: 'now_due' });
  });

  it('C-19: `now_due` já empurrado ⇒ skip até virar `late`', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(-3), la_push_state: 'now_due' })]);
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });
    expect(updateFn).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
  });

  it.each(['skipped_user', 'skipped_paused', 'missed'])('🔴 C-29: status real %s ⇒ end (não update)', async (status) => {
    // Smoke iOS 2026-10-10 18:21: "Pular" gravou skipped_user e o lifecycle mandou update `now`.
    const supabase = makeSupabase([row({ status, la_push_state: 'now' })]);
    const endFn = vi.fn((_p: { pushToken: string | null | undefined; contentState: Record<string, unknown> }) => Promise.resolve({ ok: true, status: 200 }));
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn });
    expect(updateFn).not.toHaveBeenCalled();
    expect(endFn).toHaveBeenCalledTimes(1);
    expect(endFn.mock.calls[0]![0].contentState.state).toBe('missed');
    expect(r.ended).toBe(1);
  });

  it('dose taken → end (done) + limpa token/estado', async () => {
    const supabase = makeSupabase([row({ status: 'taken', la_push_state: 'late' })]);
    const endFn = vi.fn((_p: { pushToken: string | null | undefined; contentState: Record<string, unknown> }) => Promise.resolve({ ok: true, status: 200 }));
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn });
    expect(updateFn).not.toHaveBeenCalled();
    expect(endFn).toHaveBeenCalledTimes(1);
    expect(endFn.mock.calls[0]![0].contentState.state).toBe('done');
    expect(r.ended).toBe(1);
    expect(supabase._updates).toContainEqual({ la_push_token: null, la_push_state: null });
  });

  it('410 no update → limpa token (LA morta), não conta como update', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(0) })]);
    const updateFn = vi.fn(() => Promise.resolve({ ok: false, status: 410, deactivate: true }));
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });
    expect(r.updated).toBe(0);
    expect(r.skipped).toBe(1);
    expect(supabase._updates).toContainEqual({ la_push_token: null, la_push_state: null });
  });

  it('fail-open: erro no update não derruba o loop', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(0) })]);
    const updateFn = vi.fn(() => { throw new Error('boom'); });
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });
    expect(r.failed).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });
});

// Spec 101: FR-009 (âncora da soneca no lifecycle), C-5 (limiar +2 min) e C-6 (encerrar a LA enquanto
// adiada). Tudo atrás do corte de versão FR-011 — cliente antigo vê exatamente o lifecycle de hoje.
describe('dispatchLiveActivityLifecycle — soneca (spec 101)', () => {
  beforeEach(() => {
    process.env.APNS_AUTH_KEY = Buffer.from(TEST_P8).toString('base64');
    process.env.APNS_KEY_ID = 'KEY123';
    process.env.APNS_TEAM_ID = 'TEAM123';
    process.env.APNS_BUNDLE_ID = 'com.x.dosiq';
  });
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.APNS_AUTH_KEY; delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID; delete process.env.APNS_BUNDLE_ID;
  });
  const capable = vi.fn(() => Promise.resolve(true));
  const old = vi.fn(() => Promise.resolve(false));
  const ok = (_p: any) => Promise.resolve({ ok: true, status: 200 });

  it('🔴 PO-101-10: claim de soneca (notified_at = t0+33) ⇒ update em `now` com nowUntil, não `late`', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(-35), notified_at: at(-2), la_push_state: 'late' })]);
    const updateFn = vi.fn(ok);
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn(), isCapableFn: capable });
    const cs = updateFn.mock.calls[0]![0].contentState;
    expect(cs.state).toBe('now');
    expect(cs.nowUntil).toBe(Math.floor((NOW.getTime() + 8 * 60000) / 1000) - 978307200);
  });

  it('PO-101-10: depois de âncora+10 ⇒ relógio original (late)', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(-45), notified_at: at(-11), la_push_state: 'now' })]);
    const updateFn = vi.fn(ok);
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn(), isCapableFn: capable });
    expect(updateFn.mock.calls[0]![0].contentState.state).toBe('late');
  });

  it('C-5: claim normal (notified_at segundos após scheduled_for) não vira âncora', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(-35), notified_at: new Date(NOW.getTime() - 35 * 60000 + 30_000).toISOString(), la_push_state: 'now' })]);
    const updateFn = vi.fn(ok);
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn(), isCapableFn: capable });
    expect(updateFn.mock.calls[0]![0].contentState.state).toBe('late');
  });

  it('🔴 C-6: dose adiada com LA viva ⇒ end imediato + limpa token (o claim a recria)', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(-30), snoozed_until: at(5), la_push_state: 'late' })]);
    const endFn = vi.fn(ok);
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn, isCapableFn: capable });
    expect(endFn).toHaveBeenCalledTimes(1);
    expect(endFn.mock.calls[0]![0].dismissEpochSec).toBe(Math.floor(NOW.getTime() / 1000));
    expect(updateFn).not.toHaveBeenCalled();
    expect(supabase._updates).toContainEqual({ la_push_token: null, la_push_state: null });
    expect(r.ended).toBe(1);
  });

  it('🔴 C-20: soneca a 1 min da âncora (dentro da folga) ⇒ NÃO encerra a LA que o app/claim acabou de criar', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(-30), snoozed_until: at(1), la_push_state: 'now' })]);
    const endFn = vi.fn(ok);
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn: vi.fn(ok), endFn, isCapableFn: capable });
    expect(endFn).not.toHaveBeenCalled();
  });

  it('🔴 PO-101-12: cliente antigo ⇒ lifecycle de hoje (sem end por soneca, sem âncora)', async () => {
    const supabase = makeSupabase([
      row({ id: 'a', scheduled_for: at(-30), snoozed_until: at(5), la_push_state: 'now' }),
      row({ id: 'b', scheduled_for: at(-35), notified_at: at(-2), la_push_state: 'now' }),
    ]);
    const endFn = vi.fn(ok);
    const updateFn = vi.fn(ok);
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn, isCapableFn: old });
    expect(endFn).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(updateFn.mock.calls.every((c: any[]) => c[0].contentState.state === 'late' && !('nowUntil' in c[0].contentState))).toBe(true);
  });

  it('linha sem soneca nem âncora não consulta a versão', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(0) })]);
    const isCapableFn = vi.fn(() => Promise.resolve(true));
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn: vi.fn(ok), endFn: vi.fn(), isCapableFn });
    expect(isCapableFn).not.toHaveBeenCalled();
  });
});
