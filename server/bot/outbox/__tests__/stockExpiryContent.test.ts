// stockExpiryContent.test.ts — spec 050 PR 2 (T029/T031)
//
// SEC-1 (ADR-078): a fila guarda só a referência do LOTE (`subject_id` = `stock.id`). O builder
// recalcula `daysLeft` NO ENVIO e devolve null quando o alerta deixou de fazer sentido (lote
// consumido, lote apagado, opt-out de estoque) — o drain então marca `sent` sem enviar nada.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildStockExpiryContent } from '../stockExpiryContent.js';

const mockDataQueue: any[] = [];

const { mockSupabase } = vi.hoisted(() => {
  const m: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve(mockDataQueue.shift() || { data: null, error: null })),
    then: vi.fn((onFulfilled: any) =>
      Promise.resolve(mockDataQueue.shift() || { data: [], error: null }).then(onFulfilled)),
  };
  return { mockSupabase: m };
});

vi.mock('../../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const USER = '11111111-1111-1111-1111-111111111111';
const MED = '22222222-2222-2222-2222-222222222222';
const LOT = '33333333-3333-3333-3333-333333333333';

/** 2026-08-20 10:00 em America/Sao_Paulo (UTC−3) = 13:00Z. */
const NOW = new Date(Date.UTC(2026, 7, 20, 13, 0, 0));
const MS_DAY = 24 * 60 * 60 * 1000;
const SHELF = 30;

/** Lote cuja validade (opened_at + 30d) cai a `daysLeft` dias de hoje. */
const lot = (daysLeft: number, overrides: any = {}) => ({
  id: LOT,
  user_id: USER,
  medicine_id: MED,
  quantity: 5,
  opened_at: new Date(NOW.getTime() - (SHELF - daysLeft) * MS_DAY).toISOString(),
  medicine: { name: 'Ozempic', shelf_life_days: SHELF },
  ...overrides,
});

/** Fila de respostas: user_settings (maybeSingle) → stock (maybeSingle). */
function queueReads(settings: any, stockRow: any) {
  mockDataQueue.length = 0;
  mockDataQueue.push({ data: settings, error: null });
  mockDataQueue.push({ data: stockRow, error: null });
}

describe('buildStockExpiryContent — validade biológica por lote (050 PR 2)', () => {
  beforeEach(() => {
    // `_biologicalExpiryDaysLeft` lê `Date.now()`: sem congelar o relógio a cadência D-3/D-0
    // dependeria do dia em que a suíte roda.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockDataQueue.length = 0;
  });

  it('lote em D-3 → { medicineName, daysLeft: 3 }', async () => {
    queueReads({ stock_tracking_enabled: true }, lot(3));

    const data = await buildStockExpiryContent({ userId: USER, subjectId: LOT });

    expect(data).toEqual({ medicineName: 'Ozempic', daysLeft: 3 });
  });

  it('lote vencendo hoje → daysLeft 0', async () => {
    queueReads({ stock_tracking_enabled: true }, lot(0));

    const data = await buildStockExpiryContent({ userId: USER, subjectId: LOT });

    expect(data).toEqual({ medicineName: 'Ozempic', daysLeft: 0 });
  });

  it('lote consumido entre o enqueue e o envio → null', async () => {
    queueReads({ stock_tracking_enabled: true }, lot(3, { quantity: 0 }));

    expect(await buildStockExpiryContent({ userId: USER, subjectId: LOT })).toBeNull();
  });

  it('lote apagado entre o enqueue e o envio → null', async () => {
    queueReads({ stock_tracking_enabled: true }, null);

    expect(await buildStockExpiryContent({ userId: USER, subjectId: LOT })).toBeNull();
  });

  it('lote sem TTL (shelf_life_days nulo) → null', async () => {
    queueReads({ stock_tracking_enabled: true }, lot(3, { medicine: { name: 'Ozempic', shelf_life_days: null } }));

    expect(await buildStockExpiryContent({ userId: USER, subjectId: LOT })).toBeNull();
  });

  it('linha represada fora da cadência (D-1) → null', async () => {
    queueReads({ stock_tracking_enabled: true }, lot(1));

    expect(await buildStockExpiryContent({ userId: USER, subjectId: LOT })).toBeNull();
  });

  it('subject_id ausente → null (linha sem assunto não é alerta de lote)', async () => {
    expect(await buildStockExpiryContent({ userId: USER, subjectId: null })).toBeNull();
  });

  describe('opt-out de estoque revalidado no envio (044/AP-277)', () => {
    it('stock_tracking_enabled=false → null', async () => {
      queueReads({ stock_tracking_enabled: false }, lot(3));

      expect(await buildStockExpiryContent({ userId: USER, subjectId: LOT })).toBeNull();
    });

    it('FAIL-SAFE: coluna NULL → tratado como LIGADO (envia)', async () => {
      queueReads({ stock_tracking_enabled: null }, lot(3));

      const data = await buildStockExpiryContent({ userId: USER, subjectId: LOT });

      expect(data).toEqual({ medicineName: 'Ozempic', daysLeft: 3 });
    });
  });
});
