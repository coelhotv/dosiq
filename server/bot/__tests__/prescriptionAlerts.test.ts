// prescriptionAlerts.test.ts — spec 076 (FR-001/002/006 · AC-2/AC-3)
//
// O alerta de renovação de receita NUNCA emitiu uma linha em produção:
//   1. só era chamado pelo node-cron de scheduler.ts (não roda no serverless — AP-182);
//   2. filtrava `user_settings.notifications_enabled` — coluna INEXISTENTE ⇒ 42703 ⇒ o `catch`
//      de topo transformava o erro em `return` silencioso (AP-340 / AP-298).
//
// Estes testes provam: (a) 42703 agora FALHA de forma observável (não silêncio); (b) a janela
// `<= band` + dedup por `notification_log` dispara nos degraus 30/7/1 e não redispara na mesma
// band; (c) a dedup é UMA query para todos os candidatos e só conta log `status = 'enviada'`.
// O mock HONRA os filtros que o código aplica (AP-279) e roteia por tabela.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkPrescriptionAlertsViaDispatcher } from '../reminders/prescriptionAlerts.js';

const { mockSupabase, state } = vi.hoisted(() => {
  const state: any = {
    protocolsPages: [] as any[],   // respostas sucessivas de _fetchAllPages('protocols')
    dedupResponse: { data: [], error: null } as any, // [] = nunca avisou
    dedupQueries: 0,               // quantas vezes notification_log foi consultado
    inserts: [] as any[],          // nenhum insert é esperado: quem loga é o dispatcher
    calls: { eq: [] as any[], gte: [] as any[], lte: [] as any[], in: [] as any[], selectCols: [] as any[] },
    _table: null as string | null,
  };

  const m: any = {
    from: vi.fn(function (this: any, table: string) { state._table = table; return this; }),
    select: vi.fn(function (this: any, cols: any) { state.calls.selectCols.push(cols); return this; }),
    insert: vi.fn(function (this: any, row: any) {
      state.inserts.push({ table: state._table, row });
      return Promise.resolve({ data: null, error: null });
    }),
    eq: vi.fn(function (this: any, col: any, val: any) { state.calls.eq.push([col, val]); return this; }),
    in: vi.fn(function (this: any, col: any, vals: any) { state.calls.in.push([col, vals]); return this; }),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gte: vi.fn(function (this: any, col: any, val: any) { state.calls.gte.push([col, val]); return this; }),
    lte: vi.fn(function (this: any, col: any, val: any) { state.calls.lte.push([col, val]); return this; }),
    then: vi.fn((onFulfilled: any) => {
      let result: any;
      if (state._table === 'protocols') {
        result = state.protocolsPages.shift() ?? { data: [], error: null };
      } else if (state._table === 'notification_log') {
        state.dedupQueries++;
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

/** Linha de `notification_log` como a dedup a lê. `daysBeforeEnd` = quantos dias antes de `end_date`. */
const logRow = (protocolId: string, endOffsetDays: number, daysBeforeEnd: number) => ({
  protocol_id: protocolId,
  sent_at: new Date(Date.now() + (endOffsetDays - daysBeforeEnd) * 24 * 60 * 60 * 1000).toISOString(),
});

const makeDispatcher = () => ({ dispatch: vi.fn(() => Promise.resolve({ success: true })) });

const alertCalls = (d: any) => d.dispatch.mock.calls.filter(([p]: any[]) => p.kind === 'prescription_alert');
const dispatchCount = (d: any) => alertCalls(d).length;
const dispatchedEndDates = (d: any) => alertCalls(d).map(([p]: any[]) => p.data?.endDate);

beforeEach(() => {
  state.protocolsPages = [];
  state.dedupResponse = { data: [], error: null };
  state.dedupQueries = 0;
  state.inserts.length = 0;
  state.calls.eq.length = 0;
  state.calls.gte.length = 0;
  state.calls.lte.length = 0;
  state.calls.in.length = 0;
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

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('AC-3: janela <= band dispara em 30/7/1 e em 0 (vence hoje); 31 fica fora', async () => {
    state.protocolsPages = [{
      data: [
        protocol('b30', 30),
        protocol('b7', 7),
        protocol('b1', 1),
        protocol('b0', 0),
        protocol('fora', 31),
      ],
      error: null,
    }];
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-ac3');

    expect(dispatchCount(dispatcher)).toBe(4);
    expect(dispatchedEndDates(dispatcher).sort()).toEqual(
      [localDay(0), localDay(1), localDay(7), localDay(30)].sort(),
    );
  });

  it('AC-3: receita já vencida (end_date no passado) não gera aviso retroativo', async () => {
    state.protocolsPages = [{ data: [protocol('vencida', -1)], error: null }];
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-passado');

    expect(dispatchCount(dispatcher)).toBe(0);
  });

  it('dedup: log DENTRO da band atual suprime o redisparo', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7)], error: null }];
    // avisado 3 dias antes do end_date ⇒ dentro da janela [end_date - 7, agora]
    state.dedupResponse = { data: [logRow('b7', 7, 3)], error: null };
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-dedup');

    expect(dispatchCount(dispatcher)).toBe(0);
  });

  it('dedup: log da band 30 NÃO suprime o degrau 7 (fica fora da janela menor)', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7)], error: null }];
    // avisado 30 dias antes do end_date ⇒ anterior a [end_date - 7, agora]
    state.dedupResponse = { data: [logRow('b7', 7, 30)], error: null };
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-band-maior');

    expect(dispatchCount(dispatcher)).toBe(1);
  });

  it('dedup fail-open: erro ao consultar notification_log NÃO suprime (melhor duplicar que silenciar)', async () => {
    state.protocolsPages = [{ data: [protocol('b1', 1)], error: null }];
    state.dedupResponse = { data: null, error: { code: '08006', message: 'connection failure' } };
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-failopen');

    expect(dispatchCount(dispatcher)).toBe(1);
  });

  it('dedup é UMA query para N candidatos (sem N+1) e só conta status enviada', async () => {
    state.protocolsPages = [{
      data: [protocol('a', 1), protocol('b', 7), protocol('c', 30)],
      error: null,
    }];
    await checkPrescriptionAlertsViaDispatcher(makeDispatcher(), 'corr-batch');

    expect(state.dedupQueries).toBe(1);
    expect(state.calls.in).toContainEqual(['protocol_id', ['a', 'b', 'c']]);
    expect(state.calls.eq).toContainEqual(['notification_type', 'prescription_alert']);
    expect(state.calls.eq).toContainEqual(['status', 'enviada']);
  });

  it('sem candidato na janela: nem consulta notification_log', async () => {
    state.protocolsPages = [{ data: [], error: null }];
    await checkPrescriptionAlertsViaDispatcher(makeDispatcher(), 'corr-vazio');

    expect(state.dedupQueries).toBe(0);
  });

  it('FR-001/FR-004: varre protocols com active + janela de end_date, sem tocar user_settings', async () => {
    state.protocolsPages = [{ data: [protocol('q', 7)], error: null }];
    await checkPrescriptionAlertsViaDispatcher(makeDispatcher(), 'corr-filtro');

    expect(mockSupabase.from).toHaveBeenCalledWith('protocols');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('user_settings');
    expect(state.calls.eq).toContainEqual(['active', true]);
    // horizonte fechado no banco: nada de arrastar protocolo vencido ou distante para o runtime
    expect(state.calls.gte).toContainEqual(['end_date', localDay(0)]);
    expect(state.calls.lte).toContainEqual(['end_date', localDay(30)]);
  });

  it('o job NÃO grava notification_log por conta própria — quem loga é o dispatcher', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7)], error: null }];
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-sem-insert');

    expect(state.inserts).toHaveLength(0);
    // e o protocolId vai no data, senão o log do dispatcher sai com protocol_id null
    expect(alertCalls(dispatcher)[0][0].data.protocolId).toBe('b7');
  });

  it('FR-002: dispatch sem sucesso confirmado não interrompe a varredura e segue elegível', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7), protocol('b1', 1)], error: null }];
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: false })) };

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-nosuccess');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(state.inserts).toHaveLength(0);
  });
});
