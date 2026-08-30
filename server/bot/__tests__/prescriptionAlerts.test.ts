// prescriptionAlerts.test.ts — spec 076 (FR-001/002/006 · AC-2/AC-3)
//
// O alerta de renovação de receita NUNCA emitiu uma linha em produção:
//   1. só era chamado pelo node-cron de scheduler.ts (não roda no serverless — AP-182);
//   2. filtrava `user_settings.notifications_enabled` — coluna INEXISTENTE ⇒ 42703 ⇒ o `catch`
//      de topo transformava o erro em `return` silencioso (AP-340 / AP-298).
//
// Estes testes provam: (a) 42703 agora FALHA de forma observável (não silêncio); (b) a janela
// `<= band` + dedup por `notification_log` dispara nos degraus 30/7/1 e não redispara na mesma
// band. O mock HONRA os filtros que o código aplica (AP-279) e roteia por tabela/operação.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkPrescriptionAlertsViaDispatcher } from '../reminders/prescriptionAlerts.js';

const { mockSupabase, state } = vi.hoisted(() => {
  const state: any = {
    protocolsPages: [] as any[],   // respostas sucessivas de _fetchAllPages('protocols')
    dedupResponse: { data: [], error: null } as any, // _alreadyAlerted: [] = nunca avisou
    inserts: [] as any[],          // linhas gravadas em notification_log
    calls: { eq: [] as any[], not: [] as any[], selectCols: [] as any[] },
    _table: null as string | null,
    _op: null as string | null,
  };

  const m: any = {
    from: vi.fn(function (this: any, table: string) { state._table = table; state._op = 'select'; return this; }),
    select: vi.fn(function (this: any, cols: any) { state.calls.selectCols.push(cols); return this; }),
    insert: vi.fn(function (this: any, row: any) {
      state._op = 'insert';
      state.inserts.push({ table: state._table, row });
      return Promise.resolve({ data: null, error: null });
    }),
    eq: vi.fn(function (this: any, col: any, val: any) { state.calls.eq.push([col, val]); return this; }),
    not: vi.fn(function (this: any, col: any, op: any, val: any) { state.calls.not.push([col, op, val]); return this; }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn((onFulfilled: any) => {
      let result: any;
      if (state._table === 'protocols') {
        result = state.protocolsPages.shift() ?? { data: [], error: null };
      } else if (state._table === 'notification_log') {
        result = state.dedupResponse;
      } else {
        result = { data: [], error: null };
      }
      return Promise.resolve(result).then(onFulfilled);
    }),
  };
  return { mockSupabase: m, state };
});

vi.mock('../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

/** 'YYYY-MM-DD' em America/Sao_Paulo deslocado de `offsetDays` (mesma base do código — R-020/R-254). */
const localDay = (offsetDays: number) => {
  const ms = Date.now() + offsetDays * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(ms);
};

const protocol = (id: string, endOffsetDays: number) => ({
  id,
  user_id: `u-${id}`,
  end_date: localDay(endOffsetDays),
  medicine: { name: `Med ${id}`, dosage_unit: 'mg' },
});

const makeDispatcher = () => ({ dispatch: vi.fn(() => Promise.resolve({ success: true })) });

const dispatchedIds = (d: any) =>
  d.dispatch.mock.calls
    .filter(([p]: any[]) => p.kind === 'prescription_alert')
    .map(([p]: any[]) => p.data?.endDate);

const dispatchCount = (d: any) =>
  d.dispatch.mock.calls.filter(([p]: any[]) => p.kind === 'prescription_alert').length;

beforeEach(() => {
  state.protocolsPages = [];
  state.dedupResponse = { data: [], error: null };
  state.inserts.length = 0;
  state.calls.eq.length = 0;
  state.calls.not.length = 0;
  state.calls.selectCols.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('checkPrescriptionAlertsViaDispatcher — 076', () => {
  it('AC-2: coluna/erro fantasma (42703) FALHA de forma observável — não retorna em silêncio', async () => {
    state.protocolsPages = [{ data: null, error: { code: '42703', message: 'column "x" does not exist' } }];
    const dispatcher = makeDispatcher();

    await expect(
      checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-42703'),
    ).rejects.toThrow();

    // morreu antes do loop — nenhum dispatch, nenhuma linha gravada
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(state.inserts).toHaveLength(0);
  });

  it('AC-3: janela <= band dispara em 30/7/1 e não em 31; vizinho fora da janela = -31', async () => {
    state.protocolsPages = [{
      data: [
        protocol('b30', 30),
        protocol('b7', 7),
        protocol('b1', 1),
        protocol('fora', 31),
      ],
      error: null,
    }];
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-ac3');

    expect(dispatchCount(dispatcher)).toBe(3);
    expect(dispatchedIds(dispatcher).sort()).toEqual([localDay(1), localDay(30), localDay(7)].sort());
    // cada dispatch com sucesso grava 1 linha de dedup
    expect(state.inserts.filter((i) => i.table === 'notification_log')).toHaveLength(3);
  });

  it('AC-3: receita já vencida (end_date no passado) não gera aviso retroativo', async () => {
    state.protocolsPages = [{ data: [protocol('vencida', -1)], error: null }];
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-passado');

    expect(dispatchCount(dispatcher)).toBe(0);
  });

  it('AC-3: dedup — se notification_log já tem prescription_alert na band, não redispara', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7)], error: null }];
    state.dedupResponse = { data: [{ id: 'log-1' }], error: null }; // já avisou nesta band
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-dedup');

    expect(dispatchCount(dispatcher)).toBe(0);
    expect(state.inserts).toHaveLength(0);
  });

  it('dedup fail-open: erro ao consultar notification_log NÃO suprime (melhor duplicar que silenciar)', async () => {
    state.protocolsPages = [{ data: [protocol('b1', 1)], error: null }];
    state.dedupResponse = { data: null, error: { code: '08006', message: 'connection failure' } };
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-failopen');

    expect(dispatchCount(dispatcher)).toBe(1);
  });

  it('FR-001/FR-004: varre protocols com filtro active + end_date not null, sem tocar user_settings', async () => {
    state.protocolsPages = [{ data: [protocol('q', 7)], error: null }];
    await checkPrescriptionAlertsViaDispatcher(makeDispatcher(), 'corr-filtro');

    expect(mockSupabase.from).toHaveBeenCalledWith('protocols');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('user_settings');
    expect(state.calls.eq).toContainEqual(['active', true]);
    expect(state.calls.not).toContainEqual(['end_date', 'is', null]);
  });

  it('FR-002: dispatch sem sucesso confirmado → não grava notification_log (dedup não pode mentir)', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7)], error: null }];
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: false })) };

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-nosuccess');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(state.inserts).toHaveLength(0);
  });
});
