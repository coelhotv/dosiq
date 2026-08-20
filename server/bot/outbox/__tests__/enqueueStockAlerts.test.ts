// enqueueStockAlerts.test.ts — spec 050 PR 1b (T019/T020/T022/T022b)
//
// Fan-out do stock_alert na outbox: 1 linha por MEDICAMENTO, atrás do gate OUTBOX_KINDS.
// O repo falso reproduz a UNIQUE (user_id, kind, period_key, subject_id) — é ela que dá a
// idempotência, não a aplicação; sem reproduzi-la o teste de reexecução não provaria nada.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enqueueStockAlerts } from '../enqueueStockAlerts.js';

const mockDataQueue: any[] = [];

const { mockSupabase } = vi.hoisted(() => {
  const m: any = {
    _tables: [] as string[],
    _pendingIn: null as any,
    from: vi.fn(function (this: any, table: string) { m._tables.push(table); return this; }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    in: vi.fn(function (this: any, col: any, ids: any) { m._pendingIn = [col, ids]; return this; }),
    then: vi.fn((onFulfilled: any) => {
      const result = mockDataQueue.shift() || { data: [], error: null };
      // Honra o `.in('user_id', [...])`: sem isso o teste mediria o mock em vez do filtro real.
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

vi.mock('../../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const USER = '11111111-1111-1111-1111-111111111111';
const MEDS = [
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
];

/** 10:00 em America/Sao_Paulo (UTC−3) = 13:00Z. */
const spTime = (hh: number, mm: number) => new Date(Date.UTC(2026, 7, 20, hh + 3, mm, 0));

const protocolFor = (medicineId: string, userId = USER) => ({
  id: `proto-${medicineId}`,
  user_id: userId,
  medicine_id: medicineId,
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  frequency: 'diário',
  weekdays: null,
  active: true,
  end_date: null,
  paused_at: null,
});

/** Saldo 2 e consumo diário 1 → 2 dias restantes (< 7 = alerta). */
const stockFor = (medicineId: string, quantity = 2, userId = USER) => ({
  // 050 PR 2: o lote tem `id` — é o subject_id do eixo VALIDADE.
  id: `lot-${medicineId}`,
  user_id: userId,
  medicine_id: medicineId,
  quantity,
  opened_at: null,
  medicine: { name: `Med ${medicineId}`, shelf_life_days: null, units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1 },
});

function queueFetches(users: any[], protocols: any[], stock: any[]) {
  mockDataQueue.length = 0;
  mockDataQueue.push({ data: users, error: null });
  mockDataQueue.push({ data: protocols, error: null });
  mockDataQueue.push({ data: stock, error: null });
}

const userRow = (overrides: any = {}) => ({
  user_id: USER,
  timezone: 'America/Sao_Paulo',
  notification_mode: 'realtime',
  stock_tracking_enabled: true,
  ...overrides,
});

/** Repo falso com a UNIQUE (user_id, kind, period_key, subject_id) — idempotência por constraint. */
function makeRepo() {
  const seen = new Set<string>();
  const inserted: any[] = [];
  return {
    inserted,
    enqueue: vi.fn(async (entries: any[]) => {
      let n = 0;
      for (const e of entries) {
        const key = `${e.userId}|${e.kind}|${e.periodKey}|${e.subjectId ?? 'NULL'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        inserted.push(e);
        n++;
      }
      return n;
    }),
  };
}

// Os dois kinds de estoque entram e saem do env JUNTOS: o job legado produz volume e validade na
// mesma chamada, então o gate do enqueue é tudo-ou-nada (espelha o guard do api/notify.ts).
const KINDS_ON = new Set(['daily_adherence', 'stock_alert', 'stock_expiry_alert']);
const KINDS_OFF = new Set(['daily_adherence', 'weekly_adherence', 'monthly_report', 'daily_digest']);

describe('enqueueStockAlerts — fan-out do stock_alert (050 PR 1b)', () => {
  beforeEach(() => {
    mockSupabase._tables.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockDataQueue.length = 0;
  });

  it('🔴 GATE DA FLAG: kinds SEM stock_alert → 0 linhas e NENHUMA query (deploy neutro)', async () => {
    queueFetches([userRow()], MEDS.map((m) => protocolFor(m)), MEDS.map((m) => stockFor(m)));
    const repo = makeRepo();

    const result = await enqueueStockAlerts({ repo, kinds: KINDS_OFF, now: spTime(10, 0) });

    expect(result.attempted).toBe(0);
    expect(repo.enqueue).not.toHaveBeenCalled();
    // Nem o fetch de user_settings roda: o gate é a primeira instrução.
    expect(mockSupabase._tables).toHaveLength(0);
  });

  it('com stock_alert no kinds: 3 medicamentos baixos → 3 linhas distintas (1 por medicamento)', async () => {
    queueFetches([userRow()], MEDS.map((m) => protocolFor(m)), MEDS.map((m) => stockFor(m)));
    const repo = makeRepo();

    const result = await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(10, 0) });

    expect(result.attempted).toBe(3);
    expect(repo.inserted.map((e: any) => e.subjectId).sort()).toEqual([...MEDS].sort());
    expect(repo.inserted.every((e: any) => e.kind === 'stock_alert')).toBe(true);
    expect(new Set(repo.inserted.map((e: any) => e.periodKey))).toEqual(new Set(['2026-08-20']));
  });

  it('reexecução no mesmo dia → 0 linhas NOVAS (idempotência pela UNIQUE)', async () => {
    const repo = makeRepo();

    queueFetches([userRow()], MEDS.map((m) => protocolFor(m)), MEDS.map((m) => stockFor(m)));
    await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(10, 0) });
    expect(repo.inserted).toHaveLength(3);

    queueFetches([userRow()], MEDS.map((m) => protocolFor(m)), MEDS.map((m) => stockFor(m)));
    await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(10, 5) });

    expect(repo.inserted).toHaveLength(3); // nenhuma nova
  });

  it('medicamento com saldo alto não entra (predicado daysRemaining < 7)', async () => {
    queueFetches(
      [userRow()],
      [protocolFor(MEDS[0]), protocolFor(MEDS[1])],
      [stockFor(MEDS[0], 2), stockFor(MEDS[1], 90)],
    );
    const repo = makeRepo();

    await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(10, 0) });

    expect(repo.inserted.map((e: any) => e.subjectId)).toEqual([MEDS[0]]);
  });

  describe('filtro dose-only (044/AP-277)', () => {
    it('stock_tracking_enabled=false → 0 linhas', async () => {
      queueFetches([userRow({ stock_tracking_enabled: false })], [protocolFor(MEDS[0])], [stockFor(MEDS[0])]);
      const repo = makeRepo();

      const result = await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(10, 0) });

      expect(result.attempted).toBe(0);
      expect(repo.enqueue).not.toHaveBeenCalled();
    });

    it('FAIL-SAFE: stock_tracking_enabled NULL → tratado como LIGADO (enfileira)', async () => {
      queueFetches([userRow({ stock_tracking_enabled: null })], [protocolFor(MEDS[0])], [stockFor(MEDS[0])]);
      const repo = makeRepo();

      const result = await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(10, 0) });

      expect(result.attempted).toBe(1);
    });
  });

  describe('janela 10:00–10:09 na tz do usuário (AP-259)', () => {
    const run = async (hh: number, mm: number) => {
      queueFetches([userRow()], [protocolFor(MEDS[0])], [stockFor(MEDS[0])]);
      const repo = makeRepo();
      const result = await enqueueStockAlerts({ repo, kinds: KINDS_ON, now: spTime(hh, mm) });
      return { result, repo };
    };

    it('09:59 não enfileira', async () => {
      const { result, repo } = await run(9, 59);
      expect(result.attempted).toBe(0);
      expect(repo.enqueue).not.toHaveBeenCalled();
      // Fora da janela nenhuma das duas queries pesadas roda (só user_settings).
      expect(mockSupabase._tables).toEqual(['user_settings']);
    });

    it('10:00 enfileira', async () => {
      const { result } = await run(10, 0);
      expect(result.attempted).toBe(1);
    });

    it('10:09 enfileira (último minuto da janela)', async () => {
      const { result } = await run(10, 9);
      expect(result.attempted).toBe(1);
    });

    it('10:10 não enfileira', async () => {
      const { result, repo } = await run(10, 10);
      expect(result.attempted).toBe(0);
      expect(repo.enqueue).not.toHaveBeenCalled();
    });
  });

  // ── 050 PR 2 — eixo VALIDADE (stock_expiry_alert), 1 linha por LOTE ────────────────────────
  describe('eixo validade: stock_expiry_alert por LOTE (050 PR 2 / T031)', () => {
    const KINDS_BOTH = new Set(['stock_alert', 'stock_expiry_alert']);
    const NOW = spTime(10, 0); // 2026-08-20 10:00 em America/Sao_Paulo

    const MS_DAY = 24 * 60 * 60 * 1000;
    const SHELF = 30;

    /**
     * Lote aberto de forma que `opened_at + 30 dias` caia a `daysLeft` dias de hoje.
     * Saldo 90 (consumo diário 1 → 90 dias restantes) para NÃO disparar o eixo de volume:
     * é o que prova que as linhas de validade são independentes da linha de volume.
     */
    const lotFor = (id: string, medicineId: string, daysLeft: number, quantity = 90) => ({
      id,
      user_id: USER,
      medicine_id: medicineId,
      quantity,
      opened_at: new Date(NOW.getTime() - (SHELF - daysLeft) * MS_DAY).toISOString(),
      medicine: {
        name: `Med ${medicineId}`, shelf_life_days: SHELF,
        units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1,
      },
    });

    beforeEach(() => {
      // `_biologicalExpiryDaysLeft` lê `Date.now()` (não recebe `now`): sem congelar o relógio
      // a cadência D-3/D-0 dependeria do dia em que a suíte roda.
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('1 lote D-3 + 1 lote D-0 do mesmo usuário → 2 linhas de validade DISTINTAS entre si e da de volume', async () => {
      // MEDS[0] com saldo baixo (2) → gera a linha de VOLUME; os dois lotes de MEDS[1] têm saldo
      // alto e só disparam validade.
      queueFetches(
        [userRow()],
        [protocolFor(MEDS[0]), protocolFor(MEDS[1])],
        [
          stockFor(MEDS[0], 2),
          lotFor('lote-d3', MEDS[1], 3),
          lotFor('lote-d0', MEDS[1], 0),
        ],
      );
      const repo = makeRepo();

      const result = await enqueueStockAlerts({ repo, kinds: KINDS_BOTH, now: NOW });

      expect(result.attempted).toBe(1);       // volume: só MEDS[0]
      expect(result.attemptedExpiry).toBe(2); // validade: os dois lotes

      const expiry = repo.inserted.filter((e: any) => e.kind === 'stock_expiry_alert');
      expect(expiry.map((e: any) => e.subjectId).sort()).toEqual(['lote-d0', 'lote-d3']);
      // Distintas da linha de volume: kind e assunto diferentes → chaves de UNIQUE diferentes.
      const volume = repo.inserted.filter((e: any) => e.kind === 'stock_alert');
      expect(volume).toHaveLength(1);
      expect(volume[0].subjectId).toBe(MEDS[0]);
      expect(new Set(repo.inserted.map((e: any) => `${e.kind}|${e.periodKey}|${e.subjectId}`)).size)
        .toBe(3);
    });

    it('mesmo lote no mesmo dia → 1 linha (reexecução não duplica)', async () => {
      const repo = makeRepo();

      queueFetches([userRow()], [protocolFor(MEDS[0])], [lotFor('lote-d3', MEDS[0], 3)]);
      await enqueueStockAlerts({ repo, kinds: KINDS_BOTH, now: NOW });
      expect(repo.inserted).toHaveLength(1);

      queueFetches([userRow()], [protocolFor(MEDS[0])], [lotFor('lote-d3', MEDS[0], 3)]);
      await enqueueStockAlerts({ repo, kinds: KINDS_BOTH, now: spTime(10, 5) });

      expect(repo.inserted).toHaveLength(1); // nenhuma nova — UNIQUE (user, kind, dia, lote)
    });

    it('fora da cadência (D-5, D-1, vencido há dias) e lote consumido → 0 linhas', async () => {
      queueFetches(
        [userRow()],
        [protocolFor(MEDS[0])],
        [
          lotFor('lote-d5', MEDS[0], 5),
          lotFor('lote-d1', MEDS[0], 1),
          lotFor('lote-vencido', MEDS[0], -4),
          lotFor('lote-vazio', MEDS[0], 3, 0), // D-3 mas quantity = 0
        ],
      );
      const repo = makeRepo();

      const result = await enqueueStockAlerts({ repo, kinds: KINDS_BOTH, now: NOW });

      expect(result.attemptedExpiry).toBe(0);
      expect(repo.enqueue).not.toHaveBeenCalled();
    });

    // 🔴 O gate é TUDO-OU-NADA e isso é uma exigência de segurança, não estilo: o job legado
    // (`checkStockAlerts`) produz VOLUME e VALIDADE na mesma chamada e só é desligado quando os
    // DOIS kinds estão no env. Um kind sozinho na fila = legado ligado + outbox ligada para o
    // mesmo alerta = envio EM DOBRO, todo dia, sem dedup no dispatcher.
    it.each([
      ['só stock_alert no env', new Set(['stock_alert'])],
      ['só stock_expiry_alert no env', new Set(['stock_expiry_alert'])],
    ])('🔴 GATE TUDO-OU-NADA: %s → 0 linhas e NENHUMA query', async (_label, kinds) => {
      queueFetches(
        [userRow()],
        [protocolFor(MEDS[0])],
        [stockFor(MEDS[0], 2), lotFor('lote-d3', MEDS[0], 3)],
      );
      const repo = makeRepo();
      mockSupabase._tables.length = 0;

      const result = await enqueueStockAlerts({ repo, kinds: kinds as Set<string>, now: NOW });

      expect(result.attempted).toBe(0);
      expect(result.attemptedExpiry).toBe(0);
      expect(repo.enqueue).not.toHaveBeenCalled();
      expect(mockSupabase._tables).toHaveLength(0);
    });
  });
});
