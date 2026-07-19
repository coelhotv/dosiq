// 029 F3 (T016) — aplicação do plano do motor N2 no cron: ORDEM das escritas e gate do push.
//
// ESCOPO E HONESTIDADE (R-288 regra 3): a EXCLUSÃO MÚTUA não é testada aqui — ela é do Postgres e
// está provada contra o banco real em `docs/migrations/20260716_titration_switch_rpc.test.sql`
// (18/18). O que se testa aqui é o CONTROLE DE FLUXO deste módulo: dada uma resposta do banco,
// (a) em que ORDEM as escritas saem, e (b) quando o push é suprimido. O stub devolve resultados
// programados por chamada — ele não finge implementar o predicado (AP-279: mock que "decide" o
// filtro mede o mock, não o código).
//
// A ordem é a propriedade de segurança: ativar a nova ANTES de encerrar a anterior faz um crash
// no meio deixar DUAS etapas 'current' (transitório, auto-corrigível) em vez de NENHUMA (escada
// morta em silêncio — o resolver devolveria null p/ sempre).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fila de resultados programados + registro das escritas na ordem em que ocorreram.
const writes: { table: string; payload: any; filters: Record<string, unknown> }[] = [];
let updateResults: { data: any[] | null; error: any }[] = [];
let selectResult: { data: any; error: any } = { data: null, error: null };
let protocolFetchResult: { data: any; error: any } = { data: { id: 'proto-1', user_id: 'u1' }, error: null };
// 052 T006: captura o(s) select(s) emitido(s), para provar o EMBED (o select é string — nem tsc
// nem lint o enxergam; AP-300).
const selects: string[] = [];

function makeBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const builder: any = {
    update(payload: any) {
      builder._op = 'update';
      builder._payload = payload;
      return builder;
    },
    insert(payload: any) {
      writes.push({ table, payload, filters });
      return Promise.resolve({ data: null, error: null });
    },
    select(cols?: string) {
      if (typeof cols === 'string') selects.push(cols);
      if (builder._op === 'update') {
        writes.push({ table, payload: builder._payload, filters });
        const result = updateResults.shift() ?? { data: [{ id: 'x' }], error: null };
        return Promise.resolve(result);
      }
      return builder;
    },
    eq(col: string, val: unknown) {
      filters[col] = val;
      // UPDATE sem .select() encadeado (ex.: dose do protocol) resolve como thenable.
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(selectResult);
    },
    // 052 T006: o resync pós-`dose_change` lê o protocolo executor com o embed da escada.
    single() {
      return Promise.resolve(protocolFetchResult);
    },
    then(resolve: any) {
      if (builder._op === 'update') writes.push({ table, payload: builder._payload, filters });
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock('../../services/supabase.js', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

// 052 T006: só o resync é substituído — o resto do core segue real (o módulo importa vários
// helpers puros dele). Espionar aqui é o ponto: o que se prova é que o cron PASSA a chamar o
// planner, não o que o planner faz (isso já tem teste próprio no core).
const mockResync = vi.fn();
vi.mock('@dosiq/core', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@dosiq/core')),
  resyncProtocolWindow: (...args: unknown[]) => mockResync(...args),
  createDoseInstanceRepository: vi.fn(() => ({})),
  resolveUserTz: vi.fn(async () => 'America/Sao_Paulo'),
}));

import { _applyTitrationPlan } from '../_reminderHelpers.js';

const PLAN_DOSE_CHANGE = {
  transition: 'dose_change',
  completed: [{ id: 'step-0', endedAtIso: '2026-03-29T03:00:00.000Z' }],
  activated: {
    id: 'step-1', position: 1, dose: 2, intakeUnit: 'cp',
    medicineId: 'med-a', protocolId: 'proto-1', startedAtIso: '2026-03-29T03:00:00.000Z',
  },
  pending: null,
  totalSteps: 3,
};

beforeEach(() => {
  writes.length = 0;
  selects.length = 0;
  updateResults = [];
  selectResult = { data: null, error: null };
  protocolFetchResult = { data: { id: 'proto-1', user_id: 'u1' }, error: null };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('_applyTitrationPlan — ordem das escritas (recuperabilidade)', () => {
  it('ativa a etapa NOVA antes de encerrar a anterior', async () => {
    const ok = await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');

    const steps = writes.filter((w) => w.table === 'titration_steps');
    expect(steps[0].payload.status).toBe('current'); // ativa primeiro...
    expect(steps[1].payload.status).toBe('completed'); // ...encerra depois
    expect(ok).toBe(true);
  });

  it('a etapa nova entra com o fim ACUMULADO como started_at, não com "agora"', async () => {
    await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');
    const ativacao = writes.find((w) => w.payload?.status === 'current');
    expect(ativacao?.payload.started_at).toBe('2026-03-29T03:00:00.000Z');
  });

  it('escreve a dose no executor com cp → NULL (CHECK de protocols não aceita cp — AP-299)', async () => {
    await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');
    const proto = writes.find((w) => w.table === 'protocols');
    expect(proto?.payload).toMatchObject({ dosage_per_intake: 2, intake_unit: null });
  });

  it('emite 1 evento auditável da transição', async () => {
    await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');
    const eventos = writes.filter((w) => w.table === 'dose_critical_events');
    expect(eventos).toHaveLength(1);
    expect(eventos[0].payload).toMatchObject({ event: 'titration_transitioned', actor: 'system' });
  });
});

// 052 T006 / FR-007c — a segunda instância viva do AP-308, e a que mais queimava: o `dose_change`
// automático é o caminho NORMAL da escada. A RPC client-side foi coberta pela 029 F5.5; ESTE
// caminho (cron) escapava, deixando toda instância futura já materializada com a `expected_dose`
// do cronograma anterior. Tratamento dizendo uma dose, lembrete entregando outra.
describe('_applyTitrationPlan — reprojeta as instâncias após o dose_change (052 FR-007c)', () => {
  it('depois de escrever a dose nova no executor, reprojeta a janela daquele protocolo', async () => {
    await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');

    expect(mockResync).toHaveBeenCalledTimes(1);
    expect(mockResync.mock.calls[0][0]).toMatchObject({ protocol: { id: 'proto-1' } });
  });

  it('o select do resync traz o embed da escada COM medicine_id (CON-032 + 052 G1)', async () => {
    await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');

    const embed = selects.find((s) => s.includes('titration_steps('));
    expect(embed).toBeDefined();
    expect(embed).toContain('medicine_id');
  });

  it('sem executor vinculado (medicine_switch) → nada a reprojetar aqui: a RPC é quem cria', async () => {
    const semExecutor = { ...PLAN_DOSE_CHANGE, activated: { ...PLAN_DOSE_CHANGE.activated, protocolId: null } };
    await _applyTitrationPlan('u1', 'tit-1', semExecutor, new Map(), 'c1');
    expect(mockResync).not.toHaveBeenCalled();
  });

  it('resync falhando NÃO derruba o tick nem suprime o push (best-effort — R-245)', async () => {
    mockResync.mockRejectedValueOnce(new Error('rede caiu'));
    const ok = await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');

    expect(ok).toBe(true); // a transição valeu; o calendário converge no cron seguinte
    expect(writes.filter((w) => w.table === 'dose_critical_events')).toHaveLength(1);
  });
});

describe('_applyTitrationPlan — claim vazio', () => {
  it('etapa já ativada por um tick que morreu → converge o estado SEM push nem auditoria', async () => {
    updateResults = [{ data: [], error: null }]; // claim da ativação: 0 linhas
    selectResult = { data: { status: 'current' }, error: null }; // ...mas ela JÁ está vigente

    const ok = await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');

    expect(ok).toBe(false); // não notifica de novo
    expect(writes.filter((w) => w.table === 'dose_critical_events')).toHaveLength(0);
    // ...mas TERMINA o trabalho: a etapa anterior é encerrada (senão a escada fica com 2 vigentes)
    expect(writes.some((w) => w.payload?.status === 'completed')).toBe(true);
  });

  it('outro ator mudou a etapa de verdade → aborta sem escrever mais nada', async () => {
    updateResults = [{ data: [], error: null }];
    selectResult = { data: { status: 'completed' }, error: null }; // usuário/edição mexeu

    const ok = await _applyTitrationPlan('u1', 'tit-1', PLAN_DOSE_CHANGE, new Map(), 'c1');

    expect(ok).toBe(false);
    expect(writes.some((w) => w.payload?.status === 'completed')).toBe(false);
    expect(writes.filter((w) => w.table === 'dose_critical_events')).toHaveLength(0);
  });

  it('medicine_switch: pendência já reivindicada → sem push (nunca repete o nudge — R-239)', async () => {
    updateResults = [{ data: [], error: null }];
    const plan = {
      transition: 'medicine_switch',
      completed: [],
      activated: null,
      pending: { id: 'step-1', position: 1, dose: 0.5, intakeUnit: 'mg', medicineId: 'med-b', protocolId: null },
      totalSteps: 2,
    };

    const ok = await _applyTitrationPlan('u1', 'tit-1', plan, new Map(), 'c1');

    expect(ok).toBe(false);
    expect(writes.filter((w) => w.table === 'dose_critical_events')).toHaveLength(0);
  });
});

describe('_applyTitrationPlan — medicine_switch não encerra a vigente', () => {
  it('só pendura a próxima: a etapa vigente segue regendo os lembretes (Decisões §3.2)', async () => {
    const plan = {
      transition: 'medicine_switch',
      completed: [],
      activated: null,
      pending: { id: 'step-1', position: 1, dose: 0.5, intakeUnit: 'mg', medicineId: 'med-b', protocolId: null },
      totalSteps: 2,
    };

    const ok = await _applyTitrationPlan('u1', 'tit-1', plan, new Map(), 'c1');

    const steps = writes.filter((w) => w.table === 'titration_steps');
    expect(steps).toHaveLength(1);
    expect(steps[0].payload.status).toBe('pending_confirmation');
    expect(writes.some((w) => w.payload?.status === 'completed')).toBe(false);
    expect(writes.some((w) => w.table === 'protocols')).toBe(false); // dose intocada
    expect(ok).toBe(true);
  });
});
