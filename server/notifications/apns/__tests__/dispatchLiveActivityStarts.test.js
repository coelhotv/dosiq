import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { dispatchLiveActivityStarts } from '../dispatchLiveActivityStarts.js';

const TEST_P8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const NOW = new Date('2026-07-01T12:00:00.000Z');
const inUpcoming = '2026-07-01T13:00:00.000Z'; // now + 60min (lead default)

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// Mock supabase: builder encadeável + awaitable. Fila de resultados por ordem de execução.
function makeSupabase(queue) {
  const updates = [];
  let i = 0;
  const builder = () => {
    const b = {
      _update: null,
      select() { return b; },
      eq() { return b; },
      is() { return b; },
      gte() { return b; },
      lt() { return b; }, lte() { return b; },
      update(payload) { b._update = payload; return b; },
      then(resolve) {
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
    supabase.from = () => {
      const b = {
        _update: null,
        select() { return b; }, eq() { return b; }, is() { return b; }, gte() { return b; }, lt() { return b; }, lte() { return b; },
        update(p) { b._update = p; return b; },
        then(resolve) {
          if (b._update) return Promise.resolve({ data: [], error: null }).then(resolve);
          const res = supabase.__q[supabase.__i++] ?? { data: [], error: null };
          return Promise.resolve(res).then(resolve);
        },
      };
      return b;
    };
    supabase.__q = [
      { data: [doseRow()], error: null },
      { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
    ];
    supabase.__i = 0;
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
    const bounds = {};
    const near = new Date(NOW.getTime() + 18 * 60000).toISOString(); // now + 18min
    const supabase = (() => {
      let i = 0;
      const rows = [
        { data: [{ ...doseRow(), scheduled_for: near }], error: null }, // instâncias
        { data: [{ id: 'dev1', user_id: 'userA', push_token: 'tok', is_active: true }], error: null },
      ];
      const updates = [];
      const builder = () => {
        const b = {
          _update: null,
          select() { return b; }, eq() { return b; }, is() { return b; },
          gte(_c, v) { bounds.gte = v; return b; },
          lte(_c, v) { bounds.lte = v; return b; },
          lt() { return b; },
          update(p) { b._update = p; return b; },
          then(resolve) {
            if (b._update) { updates.push(b._update); return Promise.resolve({ data: [{ id: 'inst-1' }], error: null }).then(resolve); }
            // só devolve a dose se ela está dentro de [gte, lte] (a janela real).
            const res = rows[i++] ?? { data: [], error: null };
            if (i === 1 && !(near >= bounds.gte && near <= bounds.lte)) return Promise.resolve({ data: [], error: null }).then(resolve);
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
