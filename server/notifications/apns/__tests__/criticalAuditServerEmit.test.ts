// Spec 042 (detailShape / PO-3 / SEC-3) — prova que os dispatchers server de Live Activity
// (dispatchLiveActivityStarts + dispatchLiveActivityLifecycle) emitem auditoria de dose
// crítica com shape correto (user_id derivado da instância, platform/actor 'server') e
// SEM vazamento de PII (nome de medicamento/token) em nenhum payload de `detail`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { dispatchLiveActivityStarts } from '../dispatchLiveActivityStarts';
import { dispatchLiveActivityLifecycle } from '../dispatchLiveActivityLifecycle';

const TEST_P8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const NOW = new Date('2026-07-01T12:00:00.000Z');
const inUpcoming = '2026-07-01T13:00:00.000Z'; // now + 60min (lead default / janela da query)

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// Mock supabase: builder encadeável/awaitable (mesmo padrão de dispatchLiveActivityStarts.test.js),
// mas com `insert` dedicado p/ capturar payloads de auditoria (tabela dose_critical_events) e
// `not` p/ suportar a query de lifecycle (.not('la_push_token', 'is', null)).
function makeSupabase(selectQueue) {
  const captured = [];
  let i = 0;
  const builder = () => {
    const b = {
      _update: null,
      select() { return b; },
      eq() { return b; },
      is() { return b; },
      gte() { return b; },
      lt() { return b; }, lte() { return b; },
      not() { return b; },
      update(payload) { b._update = payload; return b; },
      insert(payload) {
        captured.push(payload);
        return Promise.resolve({ error: null });
      },
      then(resolve) {
        if (b._update) return Promise.resolve({ data: [{ id: 'inst-1' }], error: null }).then(resolve);
        const res = selectQueue[i++] ?? { data: [], error: null };
        return Promise.resolve(res).then(resolve);
      },
    };
    return b;
  };
  return { from: () => builder(), _captured: captured };
}

// userId/doseInstanceId validados como UUID pelo criticalAuditEventSchema (espelha CHECK SQL).
const USER_A = '11111111-1111-4111-8111-111111111111';
const INST_1 = '22222222-2222-4222-8222-222222222222';

const doseRow = (userId = USER_A, id = INST_1) => ({
  id, user_id: userId, scheduled_for: inUpcoming, critical_alarm: true,
  protocol: { id: 'p1', name: 'Selozok', treatment_plan_id: 'plan1', medicine: { name: 'Selozok', dosage_unit: 'mg' } },
});

const lifecycleRow = (userId = USER_A, id = INST_1) => ({
  id, user_id: userId, scheduled_for: inUpcoming, critical_alarm: true,
  status: 'pending', la_push_token: 'la-tok-1', la_push_state: null,
  protocol: { id: 'p1', name: 'Selozok', treatment_plan_id: 'plan1', medicine: { name: 'Selozok' } },
});

// Guard PII (SEC-3): nenhuma chave/valor sensível pode vazar pro trail de auditoria.
function assertNoPii(payload) {
  const json = JSON.stringify(payload);
  expect(json).not.toContain('Selozok');
  expect(json).not.toContain('push_token');
  expect(json).not.toContain('la_push_token');
  expect(json).not.toContain('medicineName');
}

describe('criticalAuditService — emissão server (dispatchLiveActivityStarts/Lifecycle)', () => {
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

  it('starts: push_sent — dose crítica + device válido + sendFn ok', async () => {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null }, // instâncias
      { data: [{ id: 'dev1', user_id: USER_A, push_token: 'tok', is_active: true }], error: null }, // devices
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });

    expect(supabase._captured).toHaveLength(1);
    const payload = supabase._captured[0];
    expect(payload).toEqual({
      user_id: USER_A, dose_instance_id: INST_1, event: 'push_sent',
      platform: 'server', actor: 'server', detail: null,
    });
    assertNoPii(payload);
  });

  it('starts: push_skipped_no_token — sem device (query retorna [])', async () => {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [], error: null },
    ]);
    const sendFn = vi.fn();
    await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });

    expect(supabase._captured).toHaveLength(1);
    const payload = supabase._captured[0];
    expect(payload).toMatchObject({
      event: 'push_skipped_no_token', platform: 'server', actor: 'server',
      user_id: USER_A, dose_instance_id: INST_1,
    });
    assertNoPii(payload);
  });

  it('starts: push_failed — sendFn 410 (anySent=false)', async () => {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [{ id: 'dev1', user_id: USER_A, push_token: 'tok', is_active: true }], error: null },
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: false, status: 410, deactivate: true }));
    await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });

    expect(supabase._captured).toHaveLength(1);
    const payload = supabase._captured[0];
    expect(payload).toMatchObject({ event: 'push_failed', platform: 'server', actor: 'server' });
    assertNoPii(payload);
  });

  it('lifecycle: surface_transitioned — instância pendente com estado derivado diferente do persistido', async () => {
    const supabase = makeSupabase([
      { data: [lifecycleRow()], error: null }, // LAs ativas (la_push_token IS NOT NULL)
    ]);
    const updateFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const endFn = vi.fn();
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn });

    expect(supabase._captured).toHaveLength(1);
    const payload = supabase._captured[0];
    expect(payload.event).toBe('surface_transitioned');
    expect(payload.platform).toBe('server');
    expect(payload.actor).toBe('server');
    expect(payload.user_id).toBe(USER_A);
    expect(payload.dose_instance_id).toBe(INST_1);
    // scheduled_for = now+60min → deriveDoseActivityState resolve 'later' (janela upcomingMinutes=60 inclusiva)
    expect(payload.detail).toEqual({ from: null, to: 'later' });
    expect(updateFn).toHaveBeenCalledTimes(1);
    // O `to` emitido bate com o state realmente empurrado ao updateFn.
    expect(updateFn.mock.calls[0][0].contentState.state).toBe(payload.detail.to);
    assertNoPii(payload);
  });

  it('lifecycle: push_failed — token inválido (deactivate:true, BadDeviceToken) É auditado, não silencioso', async () => {
    const supabase = makeSupabase([{ data: [lifecycleRow()], error: null }]);
    // Prod: BadDeviceToken/Unregistered → _postToApns marca deactivate:true. Este é o caso REAL do
    // "a LA não atualiza" (token de simulador/morto) — DEVE emitir push_failed (não skip silencioso).
    const updateFn = vi.fn(() => Promise.resolve({ ok: false, status: 400, deactivate: true, reason: 'BadDeviceToken' }));
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });

    expect(supabase._captured).toHaveLength(1);
    const payload = supabase._captured[0];
    expect(payload).toMatchObject({
      event: 'push_failed', platform: 'server', actor: 'server',
      user_id: USER_A, dose_instance_id: INST_1,
      detail: { phase: 'update', status: 400, reason: 'BadDeviceToken' },
    });
    assertNoPii(payload);
  });

  it('lifecycle: push_failed — falha transitória (sem deactivate) também é auditada', async () => {
    const supabase = makeSupabase([{ data: [lifecycleRow()], error: null }]);
    const updateFn = vi.fn(() => Promise.resolve({ ok: false, status: 503, reason: 'ServiceUnavailable' }));
    await dispatchLiveActivityLifecycle({ supabase, logger, now: NOW, updateFn, endFn: vi.fn() });

    expect(supabase._captured).toHaveLength(1);
    expect(supabase._captured[0]).toMatchObject({
      event: 'push_failed', detail: { phase: 'update', status: 503, reason: 'ServiceUnavailable' },
    });
  });

  it('GUARD PII: nenhum payload capturado em nenhum cenário vaza dados sensíveis', async () => {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [{ id: 'dev1', user_id: USER_A, push_token: 'tok', is_active: true }], error: null },
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });

    const supabase2 = makeSupabase([{ data: [lifecycleRow()], error: null }]);
    const updateFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    await dispatchLiveActivityLifecycle({ supabase: supabase2, logger, now: NOW, updateFn, endFn: vi.fn() });

    for (const payload of [...supabase._captured, ...supabase2._captured]) {
      assertNoPii(payload);
    }
  });
});
