// stockAlertsDoseOnly.test.ts — spec 044 T005 (PO-4)
//
// checkStockAlertsViaDispatcher NÃO pode gerar alerta de estoque para usuário em modo
// dose-only (FR-006). Guard: a contagem de alertas para usuários com tracking ON fica
// inalterada. Fail-safe (AP-277): coluna NULL/ausente → tratado como ON.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkStockAlertsViaDispatcher } from '../_reminderHelpers.js';

const mockDataQueue: any[] = [];

const { mockSupabase } = vi.hoisted(() => {
  const m: any = {
    _selects: [] as any[],
    _ins: [] as any[],
    _pendingIn: null as any,
    from: vi.fn().mockReturnThis(),
    select: vi.fn(function (this: any, cols: any) { m._selects.push(cols); return this; }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn(function (this: any, col: any, ids: any) {
      m._ins.push([col, ids]);
      m._pendingIn = [col, ids];
      return this;
    }),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    // 050 US4: predicado de vigência do select de protocols — os fixtures daqui não têm
    // end_date/paused_at, então passam pelo filtro; a semântica é coberta em stockAlertsVigency.
    is: vi.fn().mockReturnThis(),
    // 050 PR 1b: o scan passou a paginar (AP-186) — a cadeia ganhou .order('id')/.range().
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: vi.fn((onFulfilled: any) => {
      const result = mockDataQueue.shift() || { data: [], error: null };
      // O mock HONRA o `.in(user_id, [...])`: sem isso o teste mediria o mock (devolvendo
      // linhas do usuário filtrado) em vez do filtro real do código sob teste.
      const [col, ids] = m._pendingIn ?? [];
      m._pendingIn = null;
      const data = col && Array.isArray(result.data)
        ? result.data.filter((row: any) => ids.includes(row[col]))
        : result.data;
      return Promise.resolve({ ...result, data }).then(onFulfilled);
    }),
  };
  return { mockSupabase: m };
});

vi.mock('../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const U_OFF = 'user-dose-only';
const U_ON = 'user-tracking-on';
const MED_OFF = 'med-off';
const MED_ON = 'med-on';

/** Protocolo diário 1x — consumo diário 1, saldo 2 → 2 dias restantes (< 7 = alerta). */
const protocolFor = (userId: string, medicineId: string) => ({
  user_id: userId,
  medicine_id: medicineId,
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: 'cp',
  frequency: 'diario',
  weekdays: null,
  active: true,
});

const stockFor = (userId: string, medicineId: string) => ({
  user_id: userId,
  medicine_id: medicineId,
  quantity: 2,
  opened_at: null,
  medicine: { name: `Med ${medicineId}`, shelf_life_days: null, units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1 },
});

/** Enfileira as 3 leituras de checkStockAlertsViaDispatcher: user_settings → protocols → stock. */
function queueFetches(users: any[], protocols: any[], stock: any[]) {
  mockDataQueue.length = 0;
  mockDataQueue.push({ data: users, error: null });
  mockDataQueue.push({ data: protocols, error: null });
  mockDataQueue.push({ data: stock, error: null });
}

function makeDispatcher() {
  return { dispatch: vi.fn(() => Promise.resolve()) };
}

const alertedUserIds = (dispatcher: any) =>
  dispatcher.dispatch.mock.calls
    .filter(([payload]: any[]) => payload.kind === 'stock_alert')
    .map(([payload]: any[]) => payload.userId);

describe('checkStockAlertsViaDispatcher — modo dose-only (044)', () => {
  beforeEach(() => {
    mockSupabase._selects.length = 0;
    mockSupabase._ins.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockDataQueue.length = 0;
  });

  it('carrega a preferência no MESMO select de user_settings (sem query extra)', async () => {
    queueFetches([{ user_id: U_ON, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: true }], [], []);
    await checkStockAlertsViaDispatcher(makeDispatcher(), 'corr-1');
    expect(mockSupabase._selects[0]).toContain('stock_tracking_enabled');
  });

  it('usuário dose-only fica AUSENTE dos alertas; tracking-on presente', async () => {
    queueFetches(
      [
        { user_id: U_OFF, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: false },
        { user_id: U_ON, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: true },
      ],
      [protocolFor(U_OFF, MED_OFF), protocolFor(U_ON, MED_ON)],
      [stockFor(U_OFF, MED_OFF), stockFor(U_ON, MED_ON)],
    );

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-2');

    expect(alertedUserIds(dispatcher)).toEqual([U_ON]);
    expect(alertedUserIds(dispatcher)).not.toContain(U_OFF);
    // O usuário off nem entra no .in('user_id', ...) das queries de protocols/stock.
    expect(mockSupabase._ins[0][1]).toEqual([U_ON]);
  });

  it('GUARD: contagem de alertas p/ tracking-on inalterada quando não há dose-only', async () => {
    queueFetches(
      [{ user_id: U_ON, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: true }],
      [protocolFor(U_ON, MED_ON)],
      [stockFor(U_ON, MED_ON)],
    );

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-3');

    expect(alertedUserIds(dispatcher)).toEqual([U_ON]);
  });

  it('FAIL-SAFE (AP-277): preferência NULL/ausente → tratado como tracking ON (alerta sai)', async () => {
    queueFetches(
      [{ user_id: U_ON, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: null }],
      [protocolFor(U_ON, MED_ON)],
      [stockFor(U_ON, MED_ON)],
    );

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-4');

    expect(alertedUserIds(dispatcher)).toEqual([U_ON]);
  });

  it('TODOS dose-only → nenhuma query de estoque e nenhum alerta', async () => {
    queueFetches(
      [{ user_id: U_OFF, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: false }],
      [],
      [],
    );

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-5');

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockSupabase._ins).toHaveLength(0);
  });
});
