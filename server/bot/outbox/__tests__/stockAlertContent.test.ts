// stockAlertContent.test.ts — spec 050 PR 1b (T021)
//
// SEC-1 (ADR-078): a fila guarda só referências. O builder recalcula saldo/dias NO ENVIO e
// devolve null quando o alerta deixou de fazer sentido (estoque reposto, tratamento encerrado,
// medicamento apagado) — o drain então marca `sent` sem enviar nada (skippedNoContent).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildStockAlertContent } from '../stockAlertContent.js';

const mockDataQueue: any[] = [];

const { mockSupabase } = vi.hoisted(() => {
  const m: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
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

const protocol = {
  id: 'proto-1',
  user_id: USER,
  medicine_id: MED,
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  frequency: 'diário',
  weekdays: null,
  active: true,
  end_date: null,
  paused_at: null,
};

const stockRow = (quantity: number) => ({
  user_id: USER,
  medicine_id: MED,
  quantity,
  medicine: { name: 'Ozempic', units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1 },
});

/** Ordem das leituras do builder: user_settings (opt-out) → protocols → stock. */
function queue(protocols: any[], stock: any[], trackingEnabled: boolean | null = true) {
  mockDataQueue.length = 0;
  mockDataQueue.push({ data: { stock_tracking_enabled: trackingEnabled }, error: null });
  mockDataQueue.push({ data: protocols, error: null });
  mockDataQueue.push({ data: stock, error: null });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  mockDataQueue.length = 0;
});

describe('buildStockAlertContent (050 PR 1b)', () => {
  it('estoque ainda baixo → payload com nome/doses/dias recalculados AGORA', async () => {
    queue([protocol], [stockRow(2)]);

    const data = await buildStockAlertContent({ userId: USER, subjectId: MED });

    expect(data).toEqual({ medicineName: 'Ozempic', remaining: 2, daysRemaining: 2 });
  });

  it('estoque REPOSTO entre o enqueue e o envio → null (drain marca sent sem enviar)', async () => {
    queue([protocol], [stockRow(90)]);

    expect(await buildStockAlertContent({ userId: USER, subjectId: MED })).toBeNull();
  });

  it('lotes do mesmo medicamento somam (agregação por medicamento, não por lote)', async () => {
    queue([protocol], [stockRow(1), stockRow(1)]);

    const data: any = await buildStockAlertContent({ userId: USER, subjectId: MED });

    expect(data.remaining).toBe(2);
  });

  it('tratamento encerrado/pausado no envio → null', async () => {
    queue([], [stockRow(2)]);

    expect(await buildStockAlertContent({ userId: USER, subjectId: MED })).toBeNull();
  });

  it('medicamento sem estoque (lote apagado) → null', async () => {
    queue([protocol], []);

    expect(await buildStockAlertContent({ userId: USER, subjectId: MED })).toBeNull();
  });

  it('opt-out (dose-only) ligado ENTRE o enqueue e o envio → null (044/FR-006)', async () => {
    queue([protocol], [stockRow(2)], false);

    expect(await buildStockAlertContent({ userId: USER, subjectId: MED })).toBeNull();
  });

  it('FAIL-SAFE AP-277: preferência NULL → tratado como LIGADO (alerta segue)', async () => {
    queue([protocol], [stockRow(2)], null);

    expect(await buildStockAlertContent({ userId: USER, subjectId: MED })).not.toBeNull();
  });

  it('linha sem subject_id não é stock_alert válido → null, sem tocar no banco', async () => {
    expect(await buildStockAlertContent({ userId: USER, subjectId: null })).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
