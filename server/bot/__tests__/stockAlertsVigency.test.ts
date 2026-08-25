// stockAlertsVigency.test.ts — spec 050 PR 0 (T002 / PO-8 / FR-009)
//
// checkStockAlertsViaDispatcher NÃO pode alertar estoque de tratamento ENCERRADO
// (`end_date` vencida) nem PAUSADO (`paused_at` preenchido) — `active = true` convive com os dois.
// O mock HONRA `.is('paused_at', null)` e `.or('end_date.is.null,end_date.gte.<hoje>')`: sem isso o
// teste mediria o mock em vez do filtro real do código sob teste.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkStockAlertsViaDispatcher } from '../reminders/stockAlerts.js';

const mockDataQueue: any[] = [];

const { mockSupabase } = vi.hoisted(() => {
  const m: any = {
    _selects: [] as any[],
    _ors: [] as string[],
    _is: [] as any[],
    _pendingIn: null as any,
    _pendingIs: [] as any[],
    _pendingOr: null as string | null,
    from: vi.fn().mockReturnThis(),
    select: vi.fn(function (this: any, cols: any) { m._selects.push(cols); return this; }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn(function (this: any, col: any, ids: any) { m._pendingIn = [col, ids]; return this; }),
    is: vi.fn(function (this: any, col: any, val: any) {
      m._is.push([col, val]);
      m._pendingIs.push([col, val]);
      return this;
    }),
    // 050 PR 1b: o scan passou a paginar (AP-186) — a cadeia ganhou .order('id')/.range().
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn(function (this: any, expr: string) {
      m._ors.push(expr);
      m._pendingOr = expr;
      return this;
    }),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: vi.fn((onFulfilled: any) => {
      const result = mockDataQueue.shift() || { data: [], error: null };
      const [inCol, inIds] = m._pendingIn ?? [];
      const isFilters = m._pendingIs;
      const orExpr = m._pendingOr;
      m._pendingIn = null;
      m._pendingIs = [];
      m._pendingOr = null;

      let data = result.data;
      if (Array.isArray(data)) {
        if (inCol) data = data.filter((row: any) => inIds.includes(row[inCol]));
        for (const [col, val] of isFilters) {
          if (val === null) data = data.filter((row: any) => row[col] == null);
        }
        if (orExpr) data = data.filter((row: any) => matchesOr(row, orExpr));
      }
      return Promise.resolve({ ...result, data }).then(onFulfilled);
    }),
  };
  return { mockSupabase: m };
});

/** Avalia `col.is.null,col.gte.VALOR` como o PostgREST avaliaria (OR entre os termos). */
function matchesOr(row: any, expr: string): boolean {
  return expr.split(',').some((term) => {
    const [col, op, ...rest] = term.split('.');
    const value = rest.join('.');
    if (op === 'is' && value === 'null') return row[col] == null;
    if (op === 'gte') return row[col] != null && String(row[col]) >= value;
    throw new Error(`termo .or() não suportado no mock: ${term}`);
  });
}

vi.mock('../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const USER = 'user-vigency';

/** 'YYYY-MM-DD' em America/Sao_Paulo, deslocado de `offsetDays` — mesma base do código (R-020/R-254). */
const localDay = (offsetDays: number) => {
  const ms = Date.now() + offsetDays * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(ms);
};

/** Protocolo diário 1x — consumo diário 1, saldo 2 → 2 dias restantes (< 7 = alerta). */
const protocolFor = (medicineId: string, extra: Record<string, any> = {}) => ({
  user_id: USER,
  medicine_id: medicineId,
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: 'cp',
  frequency: 'diario',
  weekdays: null,
  active: true,
  end_date: null,
  paused_at: null,
  ...extra,
});

const stockFor = (medicineId: string) => ({
  user_id: USER,
  medicine_id: medicineId,
  quantity: 2,
  opened_at: null,
  medicine: { name: `Med ${medicineId}`, shelf_life_days: null, units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1 },
});

function queueFetches(protocols: any[], stock: any[]) {
  mockDataQueue.length = 0;
  mockDataQueue.push({ data: [{ user_id: USER, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: true }], error: null });
  mockDataQueue.push({ data: protocols, error: null });
  mockDataQueue.push({ data: stock, error: null });
}

const makeDispatcher = () => ({ dispatch: vi.fn(() => Promise.resolve()) });

const alertedMedicines = (dispatcher: any) =>
  dispatcher.dispatch.mock.calls
    .filter(([payload]: any[]) => payload.kind === 'stock_alert')
    .map(([payload]: any[]) => payload.data?.medicineName);

const alertCount = (dispatcher: any) =>
  dispatcher.dispatch.mock.calls.filter(([payload]: any[]) => payload.kind === 'stock_alert').length;

describe('checkStockAlertsViaDispatcher — vigência do tratamento (050 US4)', () => {
  beforeEach(() => {
    mockSupabase._selects.length = 0;
    mockSupabase._ors.length = 0;
    mockSupabase._is.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockDataQueue.length = 0;
  });

  it('encerrado + pausado + vigente, todos com saldo baixo → 1 alerta só (o vigente)', async () => {
    queueFetches(
      [
        protocolFor('med-encerrado', { end_date: localDay(-30) }),
        protocolFor('med-pausado', { paused_at: new Date().toISOString() }),
        protocolFor('med-vigente'),
      ],
      [stockFor('med-encerrado'), stockFor('med-pausado'), stockFor('med-vigente')],
    );

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-vig-1');

    expect(alertCount(dispatcher)).toBe(1);
    expect(alertedMedicines(dispatcher)).toEqual(['Med med-vigente']);
  });

  it('FRONTEIRA: end_date = HOJE ainda alerta', async () => {
    queueFetches([protocolFor('med-hoje', { end_date: localDay(0) })], [stockFor('med-hoje')]);

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-vig-2');

    expect(alertCount(dispatcher)).toBe(1);
  });

  it('FRONTEIRA: end_date = ONTEM não alerta', async () => {
    queueFetches([protocolFor('med-ontem', { end_date: localDay(-1) })], [stockFor('med-ontem')]);

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-vig-3');

    expect(alertCount(dispatcher)).toBe(0);
  });

  it('GUARD: sem end_date (a maioria) continua alertando', async () => {
    queueFetches([protocolFor('med-sem-fim')], [stockFor('med-sem-fim')]);

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-vig-4');

    expect(alertCount(dispatcher)).toBe(1);
  });

  it('GUARD: end_date futura continua alertando', async () => {
    queueFetches([protocolFor('med-futuro', { end_date: localDay(30) })], [stockFor('med-futuro')]);

    const dispatcher = makeDispatcher();
    await checkStockAlertsViaDispatcher(dispatcher, 'corr-vig-5');

    expect(alertCount(dispatcher)).toBe(1);
  });

  it('o predicado vai NA QUERY: .is(paused_at,null) + .or com end_date.is.null (nunca .gte sozinho)', async () => {
    queueFetches([protocolFor('med-q')], [stockFor('med-q')]);
    await checkStockAlertsViaDispatcher(makeDispatcher(), 'corr-vig-6');

    expect(mockSupabase._is).toContainEqual(['paused_at', null]);
    expect(mockSupabase._ors[0]).toContain('end_date.is.null');
    expect(mockSupabase._ors[0]).toContain(`end_date.gte.${localDay(0)}`);
  });
});
