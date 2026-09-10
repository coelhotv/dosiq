// prescriptionAlerts.test.ts — spec 076 (FR-001/002/006 · AC-2/AC-3)
//
// O alerta de renovação de receita NUNCA emitiu uma linha em produção:
//   1. só era chamado pelo node-cron de scheduler.ts (não roda no serverless — AP-182);
//   2. filtrava `user_settings.notifications_enabled` — coluna INEXISTENTE ⇒ 42703 ⇒ o `catch`
//      de topo transformava o erro em `return` silencioso (AP-340 / AP-298).
//
// Estes testes provam: (a) 42703 agora FALHA de forma observável (não silêncio); (b) a janela
// `<= band` + dedup por `notification_log` dispara nos degraus 30/7/1/0 e não redispara na mesma
// band; (c) a dedup é UMA query em lote (paginada) e conta só os status-âncora (082/ADR-100); (d) a
// âncora é gravada pelo PRÓPRIO job — a linha do dispatcher sai de IIFE não aguardada e nem
// existe quando o consentimento está revogado.
// O mock HONRA os filtros que o código aplica (AP-279) e roteia por tabela.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkPrescriptionAlertsViaDispatcher } from '../reminders/prescriptionAlerts.js';

const { mockSupabase, state } = vi.hoisted(() => {
  const state: any = {
    protocolsPages: [] as any[],   // respostas sucessivas de _fetchAllPages('protocols')
    dedupResponse: { data: [], error: null } as any, // [] = nunca avisou
    dedupQueries: 0,               // quantas vezes notification_log foi consultado
    statusFilter: null as string[] | null, // conjunto de status-âncora que o código pediu (082)
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
    in: vi.fn(function (this: any, col: any, vals: any) {
      state.calls.in.push([col, vals]);
      // 082: o mock precisa HONRAR o filtro de status (AP-279), senão o teste da dedup mede a
      // resposta que o próprio teste montou e passa com qualquer implementação.
      if (col === 'status') state.statusFilter = vals;
      return this;
    }),
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
        const rows = state.dedupResponse?.data ?? [];
        const allowed = state.statusFilter;
        result = state.dedupResponse?.error
          ? state.dedupResponse
          : {
              data: allowed
                ? rows.filter((r: any) => r.status === undefined || allowed.includes(r.status))
                : rows,
              error: null,
            };
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
  state.statusFilter = null;
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

  it('dedup é UMA query para N candidatos (sem N+1) e conta só os status-âncora', async () => {
    state.protocolsPages = [{
      data: [protocol('a', 1), protocol('b', 7), protocol('c', 30)],
      error: null,
    }];
    await checkPrescriptionAlertsViaDispatcher(makeDispatcher(), 'corr-batch');

    expect(state.dedupQueries).toBe(1);
    expect(state.calls.in).toContainEqual(['protocol_id', ['a', 'b', 'c']]);
    // paginado: `_fetchAllPages` ordena e fatia — resposta truncada em ~1000 sem erro é AP-186
    expect(mockSupabase.order).toHaveBeenCalledWith('id');
    expect(mockSupabase.range).toHaveBeenCalled();
    expect(state.calls.eq).toContainEqual(['notification_type', 'prescription_alert']);
    // 082/ADR-100: o status deixou de ser binário. A âncora vira um CONJUNTO — `sem_canal` entra
    // (senão o aviso repete todo dia para o paciente sem canal, RC3/F1) e `falhou` fica de fora
    // (falha real merece nova tentativa amanhã — AP-340).
    expect(state.calls.in).toContainEqual(['status', ['enviada', 'sem_canal']]);
    expect(state.calls.eq).not.toContainEqual(['status', 'enviada']);
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

  it('grava a âncora de dedup por conta própria — a linha do dispatcher não serve (IIFE não aguardada)', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7)], error: null }];
    const dispatcher = makeDispatcher();

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-ancora');

    const logs = state.inserts.filter((i: any) => i.table === 'notification_log');
    expect(logs).toHaveLength(1);
    expect(logs[0].row).toMatchObject({
      protocol_id: 'b7', notification_type: 'prescription_alert', status: 'enviada',
    });
    // e o protocolId também vai no data: é dele que sai o protocol_id da linha do dispatcher,
    // que antes saía nula
    expect(alertCalls(dispatcher)[0][0].data.protocolId).toBe('b7');
  });

  it('consentimento revogado (dispatch success sem canal nenhum) ainda ancora — não repete todo dia', async () => {
    state.protocolsPages = [{ data: [protocol('b30', 30)], error: null }];
    // shape real de dispatchNotification quando o consentimento está revogado: retorna ANTES do
    // bloco de log, com success true e zero canal ⇒ nenhuma linha vem do dispatcher
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: true, channels: [], totalDelivered: 0, totalFailed: 0 })) };

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-consent');

    expect(state.inserts.filter((i: any) => i.table === 'notification_log')).toHaveLength(1);
  });

  it('FR-002: dispatch sem sucesso confirmado não interrompe a varredura e segue elegível', async () => {
    state.protocolsPages = [{ data: [protocol('b7', 7), protocol('b1', 1)], error: null }];
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: false })) };

    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-nosuccess');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(state.inserts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spec 082 Slice A — RC3/F1: o conserto do status não pode ressuscitar o alerta diário.
//
// O achado: hoje o alerta de receita de um paciente SEM canal é gravado como `enviada` e por isso
// não repete. Com o ADR-100 essa mesma entrega passa a ser `sem_canal` — se a dedup continuasse
// presa ao literal `'enviada'`, o aviso voltaria a sair TODO DIA para exatamente o paciente mais
// frágil, e nada a mais chegaria até ele (a linha na inbox já existe, ADR-047).
//
// Guard subido pelo RC3: dois ciclos seguidos, não um.
// ─────────────────────────────────────────────────────────────────────────────
describe('checkPrescriptionAlertsViaDispatcher — dedup sobrevive ao vocabulário novo (082/RC3-F1)', () => {
  it('🔴 paciente SEM canal não recebe o alerta duplicado no ciclo seguinte', async () => {
    // Ciclo 1: nenhum log ainda ⇒ dispara.
    state.protocolsPages = [{ data: [protocol('sem-canal', 7)], error: null }];
    const ciclo1 = makeDispatcher();
    await checkPrescriptionAlertsViaDispatcher(ciclo1, 'corr-ciclo-1');
    expect(dispatchCount(ciclo1)).toBe(1);

    // Ciclo 2 (dia seguinte, mesma band): a entrega do ciclo 1 ficou registrada como `sem_canal`,
    // porque o paciente não tem canal físico algum. É o valor que o ADR-100 introduz.
    state.protocolsPages = [{ data: [protocol('sem-canal', 6)], error: null }];
    state.dedupResponse = {
      data: [{ ...logRow('sem-canal', 6, 0), id: 'log-1', status: 'sem_canal' }],
      error: null,
    };
    const ciclo2 = makeDispatcher();
    await checkPrescriptionAlertsViaDispatcher(ciclo2, 'corr-ciclo-2');

    expect(dispatchCount(ciclo2)).toBe(0);
  });

  it('falha real de canal SEGUE elegível no ciclo seguinte (não vira silêncio — AP-340)', async () => {
    // Contraprova do teste acima: `falhou` de propósito NÃO é âncora. Se entrasse no conjunto, um
    // erro transitório de canal silenciaria o alerta pelo resto da band.
    state.protocolsPages = [{ data: [protocol('falhou', 6)], error: null }];
    state.dedupResponse = {
      data: [{ ...logRow('falhou', 6, 0), id: 'log-2', status: 'falhou' }],
      error: null,
    };
    const dispatcher = makeDispatcher();
    await checkPrescriptionAlertsViaDispatcher(dispatcher, 'corr-falhou');

    // O mock aplica o mesmo `.in` que o código manda ao PostgREST: a linha `falhou` não volta,
    // não há âncora, e o alerta sai de novo. É o comportamento de hoje, preservado de propósito.
    expect(dispatchCount(dispatcher)).toBe(1);
  });
});

