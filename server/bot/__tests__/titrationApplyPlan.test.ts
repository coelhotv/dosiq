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
    select() {
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
  updateResults = [];
  selectResult = { data: null, error: null };
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
