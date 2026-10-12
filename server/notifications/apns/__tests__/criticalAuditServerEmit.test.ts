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
type QueryResult = { data: unknown[] | null; error: { message: string } | null };
interface AuditPayload {
  user_id?: string
  dose_instance_id?: string
  event?: string
  platform?: string
  actor?: string
  detail?: { from?: string | null; to?: string; phase?: string; status?: number; reason?: string; days_since_seen?: number } | null
}
function makeSupabase(selectQueue: QueryResult[]) {
  const captured: AuditPayload[] = [];
  let i = 0;
  const builder = () => {
    const b = {
      _update: null as Record<string, unknown> | null,
      select() { return b; },
      eq() { return b; },
      is() { return b; },
      gte() { return b; },
      lt() { return b; }, lte() { return b; },
      not() { return b; },
      limit() { return b; },
      update(payload: Record<string, unknown>) { b._update = payload; return b; },
      insert(payload: AuditPayload) {
        captured.push(payload);
        return Promise.resolve({ error: null });
      },
      then(resolve: (value: unknown) => unknown) {
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
function assertNoPii(payload: unknown) {
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
      // 067 C.2 (FR-042): o server emite no INSTANTE do evento (não há fila), então `created_at`
      // já é o instante do fato e a coluna nasce NULL — atualizado explicitamente, não por
      // conveniência: nenhum emissor server carimba occurred_at nesta fatia.
      occurred_at: null,
    });
    assertNoPii(payload);
  });

  // 067 C.1 / FR-040 + spec 083 — o sinal tem CANDIDATURA (device iOS visto em ≤ 30 d) e uma linha por
  // ocorrência. A ordem das queries no ramo "sem token" é:
  // [instâncias] → [devices apns_liveactivity ativos] → [linhas platform=ios] → [eventos já emitidos].
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
  const iosRow = (provider: string, seenDaysAgo: number, isActive = false) =>
    ({ provider, is_active: isActive, last_seen_at: daysAgo(seenDaysAgo) });

  async function runNoToken(iosResult: QueryResult, signaled: unknown[] = []) {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [], error: null },          // sem device apns_liveactivity ativo
      iosResult,                          // diagnóstico iOS
      { data: signaled, error: null },    // eventos já emitidos desta ocorrência
    ]);
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn: vi.fn() });
    return { supabase, r };
  }

  it('starts: push_skipped_no_token — só expo iOS visto há 3 d ⇒ never_registered (083 AC-1.1)', async () => {
    const { supabase } = await runNoToken({ data: [iosRow('expo', 3)], error: null });
    expect(supabase._captured).toHaveLength(1);
    const payload = supabase._captured[0];
    expect(payload).toMatchObject({
      event: 'push_skipped_no_token', platform: 'server', actor: 'server',
      user_id: USER_A, dose_instance_id: INST_1,
      detail: { reason: 'never_registered', days_since_seen: 3 },
    });
    // INV-4: só reason/days_since_seen — nenhum token, id de device ou versão.
    expect(Object.keys(payload.detail ?? {}).sort()).toEqual(['days_since_seen', 'reason']);
    assertNoPii(payload);
  });

  it('starts: só apns_liveactivity inativos, mais recente há 9 d ⇒ all_inactive (083 AC-1.2)', async () => {
    const { supabase } = await runNoToken({
      data: [iosRow('apns_liveactivity', 20), iosRow('apns_liveactivity', 9), iosRow('expo', 12, true)],
      error: null,
    });
    expect(supabase._captured).toHaveLength(1);
    expect(supabase._captured[0].detail).toEqual({ reason: 'all_inactive', days_since_seen: 9 });
  });

  it('starts: iOS mais recente visto há 31 d NÃO emite (083 AC-2.1 — aparelho abandonado)', async () => {
    const { supabase, r } = await runNoToken({ data: [iosRow('expo', 31), iosRow('expo', 120)], error: null });
    expect(supabase._captured).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('starts: iOS visto há 29 d EMITE (083 AC-2.2 — dentro da janela)', async () => {
    const { supabase } = await runNoToken({ data: [iosRow('expo', 29)], error: null });
    expect(supabase._captured).toHaveLength(1);
    expect(supabase._captured[0].detail).toEqual({ reason: 'never_registered', days_since_seen: 29 });
  });

  it('starts: erro na consulta iOS ⇒ EMITE com reason unknown (083 AC-1.3/AC-2.3, fail-open)', async () => {
    // Fail-open deliberado e assimétrico: ruído é bounded e reversível; perder o diagnóstico de
    // um iPhone real, não.
    const { supabase, r } = await runNoToken({ data: null, error: { message: 'boom' } });
    expect(supabase._captured).toHaveLength(1);
    expect(supabase._captured[0]).toMatchObject({ event: 'push_skipped_no_token' });
    expect(supabase._captured[0].detail).toEqual({ reason: 'unknown' });
    expect(r.skipped).toBe(1); // INV-2: o diagnóstico nunca vira `failed`
  });

  it('starts: usuário SEM nenhum device iOS (Android-only) NÃO gera push_skipped_no_token', async () => {
    // O caso que enchia a trilha: ~60 linhas/dose, para sempre, sobre um recurso que não existe
    // no aparelho. Medido em prod: 1079 linhas em 7 dias de um único usuário.
    const { supabase, r } = await runNoToken({ data: [], error: null });
    expect(supabase._captured).toHaveLength(0);
    expect(r.skipped).toBe(1); // o start segue degradando p/ o foreground (039) — só a linha some
  });

  it('starts: candidato iOS já sinalizado nesta ocorrência NÃO repete o evento (trava de idempotência)', async () => {
    const { supabase } = await runNoToken({ data: [iosRow('expo', 1)], error: null }, [{ id: 'evt-anterior' }]);
    expect(supabase._captured).toHaveLength(0);
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
    const updateFn = vi.fn((_p: { pushToken: string | null | undefined; contentState: Record<string, unknown> }) =>
      Promise.resolve({ ok: true, status: 200 }));
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
    expect(updateFn.mock.calls[0]![0].contentState.state).toBe(payload.detail!.to);
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
