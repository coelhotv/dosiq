import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { dispatchLiveActivityStarts, startSnoozedLiveActivity } from '../dispatchLiveActivityStarts';

const TEST_P8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const NOW = new Date('2026-07-01T12:00:00.000Z');
const inUpcoming = '2026-07-01T13:00:00.000Z'; // now + 60min (lead default)

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// Mock supabase: builder encadeável + awaitable. Fila de resultados por ordem de execução.
type QueryResult = { data: unknown[] | null; error: { message: string } | null };
type Resolve = (value: unknown) => unknown;
function makeSupabase(queue: QueryResult[]) {
  const updates: Array<Record<string, unknown>> = [];
  let i = 0;
  const builder = () => {
    const b = {
      _update: null as Record<string, unknown> | null,
      select() { return b; },
      eq() { return b; },
      is() { return b; },
      gte() { return b; },
      lt() { return b; }, lte() { return b; },
      update(payload: Record<string, unknown>) { b._update = payload; return b; },
      then(resolve: Resolve) {
        if (b._update) { updates.push(b._update); return Promise.resolve({ data: [{ id: 'inst-1' }], error: null }).then(resolve); }
        const res = queue[i++] ?? { data: [], error: null };
        return Promise.resolve(res).then(resolve);
      },
    };
    return b;
  };
  return { from: () => builder(), _updates: updates };
}

const doseRow = (userId = 'userA', id = 'inst-1') => ({
  id, user_id: userId, scheduled_for: inUpcoming, critical_alarm: true,
  protocol: { id: 'p1', name: 'Selozok', treatment_plan_id: 'plan1', medicine: { name: 'Selozok', dosage_unit: 'mg' } },
});

describe('dispatchLiveActivityStarts', () => {
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

  it('sem APNs configurado → skip total (fail-closed, alarme intacto)', async () => {
    delete process.env.APNS_AUTH_KEY;
    const supabase = makeSupabase([]);
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW });
    expect(r).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
  });

  it('dose crítica + token válido → envia start e marca la_push_started_at', async () => {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },                                  // instâncias
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null }, // devices
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(r.sent).toBe(1);
    expect(supabase._updates).toContainEqual({ la_push_started_at: NOW.toISOString() });
  });

  it('🔴 101 C-18: dose com soneca vigente não ganha LA da janela (estava escondida pelo Adiar)', async () => {
    // Smoke iOS 2026-10-10: Adiar às 13:50:44 (soneca 14:05); start da janela às 13:51:03 criou LA nova,
    // sem token, contador parado em zero.
    const snoozed = { ...doseRow(), snoozed_until: '2026-07-01T13:05:00.000Z' };
    const supabase = makeSupabase([
      { data: [snoozed], error: null },
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(sendFn).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
  });

  it('C-18: soneca já vencida não bloqueia o start', async () => {
    const past = { ...doseRow(), snoozed_until: '2026-07-01T11:00:00.000Z' };
    const supabase = makeSupabase([
      { data: [past], error: null },
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(r.sent).toBe(1);
  });

  it('S-1 IDOR: token de outro user_id → não envia (guard)', async () => {
    const supabase = makeSupabase([
      { data: [doseRow('userA')], error: null },
      { data: [{ id: 'dev1', user_id: 'userB', push_token: 'tok', is_active: true }], error: null }, // dono ERRADO
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(sendFn).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('owner mismatch'), expect.anything());
  });

  it('410 → desativa token, não marca', async () => {
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
    ]);
    const sendFn = vi.fn(() => Promise.resolve({ ok: false, status: 410, deactivate: true }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(r.failed).toBe(1);
    expect(supabase._updates).toContainEqual({ is_active: false });
    expect(supabase._updates).not.toContainEqual({ la_push_started_at: NOW.toISOString() });
  });

  it('trava de idempotência já adquirida por outro cron (UPDATE ...is null → 0 linhas) → skipped, não conta como enviado', async () => {
    // Corrida: 2 execuções no mesmo minuto. O UPDATE condicional .is('la_push_started_at', null)
    // afeta 0 linhas na 2ª → data vazio → skipped (o start já saiu na 1ª).
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
    ]);
    // update-branch retorna 0 linhas (trava perdida)
    const raceQueue: QueryResult[] = [
      { data: [doseRow()], error: null },
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
    ];
    let raceIdx = 0;
    supabase.from = () => {
      const b = {
        _update: null as Record<string, unknown> | null,
        select() { return b; }, eq() { return b; }, is() { return b; }, gte() { return b; }, lt() { return b; }, lte() { return b; },
        update(p: Record<string, unknown>) { b._update = p; return b; },
        then(resolve: Resolve) {
          if (b._update) return Promise.resolve({ data: [], error: null }).then(resolve);
          const res = raceQueue[raceIdx++] ?? { data: [], error: null };
          return Promise.resolve(res).then(resolve);
        },
      };
      return b;
    };
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(r.sent).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it('fail-open: erro na query de instâncias → não lança, retorna zero', async () => {
    const supabase = makeSupabase([{ data: null, error: { message: 'db down' } }]);
    const sendFn = vi.fn();
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(sendFn).not.toHaveBeenCalled();
    expect(r.processed).toBe(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it('sem device apns_liveactivity → skip (degrada p/ 039 foreground)', async () => {
    // O mock NÃO expõe `.limit()` de propósito: prova que uma exceção no caminho da auditoria
    // (067 C.1) não contamina o desfecho do dispatch — continua `skipped`, nunca `failed`.
    const supabase = makeSupabase([
      { data: [doseRow()], error: null },
      { data: [], error: null }, // sem token
    ]);
    const sendFn = vi.fn();
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });
    expect(sendFn).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
  });

  it('janela = [now, now+lead] inclusiva: dose criada p/ <lead min (não é fatia de T−60) é pega', async () => {
    // Captura os limites de scheduled_for aplicados na query de instâncias e filtra por eles —
    // prova que uma dose a 18min (dentro do horizonte, fora da antiga fatia de T−60) entra.
    const bounds: { gte?: string; lte?: string } = {};
    const near = new Date(NOW.getTime() + 18 * 60000).toISOString(); // now + 18min
    const supabase = (() => {
      let i = 0;
      const rows: QueryResult[] = [
        { data: [{ ...doseRow(), scheduled_for: near }], error: null }, // instâncias
        { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
      ];
      const updates: Array<Record<string, unknown>> = [];
      const builder = () => {
        const b = {
          _update: null as Record<string, unknown> | null,
          select() { return b; }, eq() { return b; }, is() { return b; },
          gte(_c: string, v: string) { bounds.gte = v; return b; },
          lte(_c: string, v: string) { bounds.lte = v; return b; },
          lt() { return b; },
          update(p: Record<string, unknown>) { b._update = p; return b; },
          then(resolve: Resolve) {
            if (b._update) { updates.push(b._update); return Promise.resolve({ data: [{ id: 'inst-1' }], error: null }).then(resolve); }
            // só devolve a dose se ela está dentro de [gte, lte] (a janela real).
            const res = rows[i++] ?? { data: [], error: null };
            if (i === 1 && !(near >= bounds.gte! && near <= bounds.lte!)) return Promise.resolve({ data: [], error: null }).then(resolve);
            return Promise.resolve(res).then(resolve);
          },
        };
        return b;
      };
      return { from: () => builder() };
    })();
    const sendFn = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const r = await dispatchLiveActivityStarts({ supabase, logger, now: NOW, sendFn });

    expect(bounds.gte).toBe(NOW.toISOString());                                  // início = now
    expect(bounds.lte).toBe(new Date(NOW.getTime() + 60 * 60000).toISOString()); // fim = now + 60min
    expect(sendFn).toHaveBeenCalledTimes(1);                                      // dose a 18min ENTROU
    expect(r.sent).toBe(1);
  });
});

// Spec 101 FR-008/FR-011: recriação da LA no claim da soneca. Sem trava `la_push_started_at` (a
// idempotência é o próprio claim) e só para device apns_liveactivity em app_version ≥ 0.34.0.
describe('startSnoozedLiveActivity (spec 101)', () => {
  const CLAIM = new Date('2026-07-01T12:35:00.000Z');
  const item = {
    instanceId: 'inst-1', scheduledFor: '2026-07-01T12:00:00.000Z', snoozedUntil: '2026-07-01T12:35:00.000Z',
    critical_alarm: true, medicineName: 'Lantus', treatmentPlanId: 'plan1', toleranceMinutes: 120,
  };
  const dev = (app_version: string | null) => ({ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true, app_version });
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

  it('🔴 PO-101-12: device em 0.33.14 (1º build com a 101 completa) ⇒ 1 push-to-start em `now` com nowUntil, sem tocar la_push_started_at', async () => {
    const supabase = makeSupabase([{ data: [dev('0.33.14')], error: null }]);
    const sendFn = vi.fn((_p: any) => Promise.resolve({ ok: true, status: 200 }));
    const r = await startSnoozedLiveActivity({ supabase, logger, userId: 'userA', item, now: CLAIM, sendFn });
    expect(r).toBe('sent');
    expect(sendFn).toHaveBeenCalledTimes(1);
    const cs = sendFn.mock.calls[0]![0].contentState;
    expect(cs.state).toBe('now');
    expect(cs.nowUntil).toBe(Math.floor(CLAIM.getTime() / 1000) + 600 - 978307200); // Date do ActivityKit = s desde 2001
    expect(supabase._updates).not.toContainEqual(expect.objectContaining({ la_push_started_at: expect.anything() }));
  });

  it('🔴 C-14: claim do minuto ANTES da âncora com segundos (soneca agora+5) ⇒ recria em `now` mesmo assim', async () => {
    // Smoke iOS 2026-10-09: soneca 16:41:29.738, claim 16:41:03 ⇒ core devolvia null (antes da âncora) e
    // a recriação saía `skipped` em silêncio.
    const anchored = { ...item, snoozedUntil: '2026-07-01T12:35:29.738Z' };
    const supabase = makeSupabase([{ data: [dev('0.33.14')], error: null }]);
    const sendFn = vi.fn((_p: any) => Promise.resolve({ ok: true, status: 200 }));
    const r = await startSnoozedLiveActivity({ supabase, logger, userId: 'userA', item: anchored, now: new Date('2026-07-01T12:35:03.000Z'), sendFn });
    expect(r).toBe('sent');
    const cs = sendFn.mock.calls[0]![0].contentState;
    expect(cs.state).toBe('now');
    expect(cs.nowUntil).toBe(Math.floor(Date.parse('2026-07-01T12:35:29.738Z') / 1000) + 600 - 978307200);
  });

  it('C-14: âncora longe no futuro (claim fora de hora) ⇒ não antecipa a superfície', async () => {
    const far = { ...item, snoozedUntil: '2026-07-01T12:40:00.000Z' };
    const supabase = makeSupabase([{ data: [dev('0.33.14')], error: null }]);
    const sendFn = vi.fn((_p: any) => Promise.resolve({ ok: true, status: 200 }));
    const r = await startSnoozedLiveActivity({ supabase, logger, userId: 'userA', item: far, now: CLAIM, sendFn });
    expect(r).toBe('skipped');
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('🔴 PO-101-12: device em 0.30.0 ou sem versão ⇒ 0 envios (cliente antigo = comportamento de hoje)', async () => {
    for (const v of ['0.30.0', '0.33.11', '0.33.12', '0.33.13', null, 'lixo']) {
      const supabase = makeSupabase([{ data: [dev(v)], error: null }]);
      const sendFn = vi.fn((_p: any) => Promise.resolve({ ok: true, status: 200 }));
      const r = await startSnoozedLiveActivity({ supabase, logger, userId: 'userA', item, now: CLAIM, sendFn });
      expect(r).toBe('skipped');
      expect(sendFn).not.toHaveBeenCalled();
    }
  });

  it('erro do APNs ⇒ `failed`, nunca lança (INV-5)', async () => {
    const supabase = makeSupabase([{ data: [dev('0.34.0')], error: null }]);
    const sendFn = vi.fn((_p: any) => Promise.resolve({ ok: false, status: 500, reason: 'boom' }));
    await expect(startSnoozedLiveActivity({ supabase, logger, userId: 'userA', item, now: CLAIM, sendFn })).resolves.toBe('failed');
  });

  it('busca de devices falha ⇒ `skipped` (fail-open)', async () => {
    const supabase = makeSupabase([{ data: null, error: { message: 'x' } }]);
    const sendFn = vi.fn();
    await expect(startSnoozedLiveActivity({ supabase, logger, userId: 'userA', item, now: CLAIM, sendFn })).resolves.toBe('skipped');
    expect(sendFn).not.toHaveBeenCalled();
  });
});
