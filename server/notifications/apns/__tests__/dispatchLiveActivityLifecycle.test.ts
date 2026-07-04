import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { dispatchLiveActivityLifecycle } from '../dispatchLiveActivityLifecycle';

const TEST_P8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const NOW = new Date(Date.UTC(2026, 6, 1, 12, 0, 0));
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// Mock supabase: select(...).not(...) resolve a lista; update(...).eq(...) registra o patch.
function makeSupabase(rows) {
  const updates = [];
  const from = () => {
    const b = {
      _update: null,
      select() { return b; },
      not() { return b; },
      gte() { return b; },
      update(p) { b._update = p; return b; },
      eq() {
        if (b._update) { updates.push(b._update); return Promise.resolve({ data: null, error: null }); }
        return b;
      },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return b;
  };
  return { from, _updates: updates };
}

// scheduled_for relativo a NOW p/ cair no estado desejado (SURFACE_WINDOWS: now ±10, late < -10).
const at = (min) => new Date(NOW.getTime() + min * 60000).toISOString();
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
    const supabase = makeSupabase([row({ scheduled_for: at(0), la_push_state: null })]); // now
    const updateFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const endFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn });
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn.mock.calls[0][0].contentState.state).toBe('now');
    expect(r.updated).toBe(1);
    expect(supabase._updates).toContainEqual({ la_push_state: 'now' });
  });

  it('estado igual ao já empurrado → skip (não spammar APNs)', async () => {
    const supabase = makeSupabase([row({ scheduled_for: at(0), la_push_state: 'now' })]);
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });
    expect(updateFn).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
  });

  it('dose taken → end (done) + limpa token/estado', async () => {
    const supabase = makeSupabase([row({ status: 'taken', la_push_state: 'late' })]);
    const endFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const updateFn = vi.fn();
    const r = await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn });
    expect(updateFn).not.toHaveBeenCalled();
    expect(endFn).toHaveBeenCalledTimes(1);
    expect(endFn.mock.calls[0][0].contentState.state).toBe('done');
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
