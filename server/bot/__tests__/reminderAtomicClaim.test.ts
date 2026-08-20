import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRemindersViaDispatcher } from '../_reminderHelpers.js';

/**
 * PR 3 da spec 050 — claim atômico do lembrete de dose.
 *
 * R-288: o primitivo de concorrência NÃO é mockado. O fake abaixo é uma TABELA em memória cujo
 * UPDATE avalia de verdade o predicado `.is('notified_at', null)` (e o `.eq('notified_at', ts)`
 * do release) sobre o estado corrente da linha — é exatamente esse predicado que constitui o
 * claim. Um mock que apenas registrasse a chamada provaria nada.
 */

const { store, flags, mockSupabase } = vi.hoisted(() => {
  /** Injeta erro de BANCO no primeiro UPDATE de claim (o stamp posterior segue funcionando). */
  const flags = { failClaimOnce: false };
  const store: { userSettings: any[]; doseInstances: any[] } = {
    userSettings: [],
    doseInstances: [],
  };

  type Filter = (row: any) => boolean;

  class Query {
    table: string;
    filters: Filter[] = [];
    patch: Record<string, any> | null = null;
    constructor(table: string) { this.table = table; }

    select() { return this; }
    in(col: string, values: any[]) { this.filters.push(r => values.includes(r[col])); return this; }
    eq(col: string, value: any) { this.filters.push(r => r[col] === value); return this; }
    is(col: string, value: any) { this.filters.push(r => (r[col] ?? null) === value); return this; }
    not(col: string, _op: string, value: any) { this.filters.push(r => (r[col] ?? null) !== value); return this; }
    gte(col: string, value: any) { this.filters.push(r => r[col] != null && r[col] >= value); return this; }
    lt(col: string, value: any) { this.filters.push(r => r[col] != null && r[col] < value); return this; }
    update(patch: Record<string, any>) { this.patch = patch; return this; }

    _rows() {
      const src = this.table === 'user_settings' ? store.userSettings : store.doseInstances;
      return src.filter(r => this.filters.every(f => f(r)));
    }

    then(onFulfilled: any) {
      const rows = this._rows();
      if (this.patch) {
        if (flags.failClaimOnce && this.patch.notified_at) {
          flags.failClaimOnce = false;
          return Promise.resolve({ data: null, error: { message: 'claim indisponível' } }).then(onFulfilled);
        }
        // UPDATE ... WHERE <filtros> RETURNING * — os filtros são reavaliados sobre o estado
        // corrente, que é o que faz o 2º worker sair de mãos vazias.
        for (const row of rows) Object.assign(row, this.patch);
        return Promise.resolve({ data: rows.map(r => ({ ...r })), error: null }).then(onFulfilled);
      }
      return Promise.resolve({ data: rows.map(r => ({ ...r })), error: null }).then(onFulfilled);
    }
  }

  const mockSupabase = { from: (table: string) => new Query(table) };
  return { store, flags, mockSupabase };
});

vi.mock('../../services/supabase.js', () => ({ supabase: mockSupabase }));

vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../services/notificationDeduplicator.js', () => ({
  shouldSendNotification: vi.fn(() => Promise.resolve(true)),
  shouldSendGroupedNotification: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../notifications/apns/dispatchLiveActivityStarts.js', () => ({
  dispatchLiveActivityStarts: vi.fn(() => Promise.resolve({ sent: 0 })),
}));

vi.mock('../../notifications/apns/dispatchLiveActivityLifecycle.js', () => ({
  dispatchLiveActivityLifecycle: vi.fn(() => Promise.resolve({ updated: 0, ended: 0 })),
}));

vi.mock('../utils/partitionDoses.js', () => ({
  partitionDoses: vi.fn((doses: any[]) => (
    doses.length === 0 ? [] : [{ kind: 'dose_reminder', planId: null, planName: null, doses }]
  )),
}));

/**
 * Relógio congelado: a janela do fetch é [minuto corrente, +1min). Sem tempo fixo, um teste que
 * roda em cima da virada do minuto fica flaky por construção.
 */
const FIXED_NOW = new Date('2026-08-20T13:40:10.000Z');

/** Instante DENTRO da janela do minuto corrente. */
function nowWindowISO() {
  return '2026-08-20T13:40:30.000Z';
}

function makeInstance(overrides: Record<string, any> = {}) {
  return {
    id: 'inst-1',
    user_id: 'user1',
    protocol_id: 'proto-1',
    critical_alarm: false,
    scheduled_for: nowWindowISO(),
    snoozed_until: null,
    notified_at: null,
    status: 'pending',
    medicine_id: 'med-1',
    medicine: { name: 'Losartana', dosage_unit: 'mg', dosage_per_pill: 50 },
    protocol: {
      id: 'proto-1', name: 'Losartana', dosage_per_intake: 1, intake_unit: null,
      treatment_plan_id: null, medicine_id: 'med-1', treatment_plan: null,
    },
    ...overrides,
  };
}

describe('050 PR 3 — claim atômico do lembrete de dose', () => {
  const originalEnv = process.env.REMINDER_SOURCE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REMINDER_SOURCE = 'instances';
    store.userSettings = [
      { user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' },
    ];
    store.doseInstances = [];
    flags.failClaimOnce = false;
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    if (originalEnv === undefined) delete process.env.REMINDER_SOURCE;
    else process.env.REMINDER_SOURCE = originalEnv;
  });

  it('PO-3: dois ciclos concorrentes disparam a dose UMA vez (o 2º não reivindica nada)', async () => {
    store.doseInstances = [makeInstance()];

    const dispatcherA = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };
    const dispatcherB = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };

    // Interleaving real: os dois ciclos leem ANTES de qualquer claim (Promise.all), e é o
    // predicado do UPDATE que decide quem envia.
    await Promise.all([
      checkRemindersViaDispatcher(dispatcherA, 'corr-A'),
      checkRemindersViaDispatcher(dispatcherB, 'corr-B'),
    ]);

    const totalDispatches =
      dispatcherA.dispatch.mock.calls.length + dispatcherB.dispatch.mock.calls.length;
    expect(totalDispatches).toBe(1);
    expect(store.doseInstances[0].notified_at).not.toBeNull();
  });

  it('PO-3 guard: caminho feliz (1 worker) envia a dose e carimba notified_at', async () => {
    store.doseInstances = [makeInstance()];
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };

    await checkRemindersViaDispatcher(dispatcher, 'corr-happy');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user1', kind: 'dose_reminder' })
    );
    expect(store.doseInstances[0].notified_at).not.toBeNull();
  });

  it('PO-3 guard: dose ADIADA (snoozed_until na janela) é enviada e o claim zera o snooze', async () => {
    store.doseInstances = [makeInstance({
      // fora da janela por scheduled_for: só a 2ª query (snoozed) pode encontrá-la
      scheduled_for: '2020-01-01T00:00:00.000Z',
      snoozed_until: nowWindowISO(),
    })];
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };

    await checkRemindersViaDispatcher(dispatcher, 'corr-snooze');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(store.doseInstances[0].snoozed_until).toBeNull();
    expect(store.doseInstances[0].notified_at).not.toBeNull();
  });

  it('PO-7: falha de dispatch devolve a dose ao estado pré-claim e o retry envia UMA vez', async () => {
    store.doseInstances = [makeInstance()];

    const failing = { dispatch: vi.fn(() => Promise.resolve({ success: false, errors: ['push down'] })) };
    await checkRemindersViaDispatcher(failing, 'corr-fail');

    expect(failing.dispatch).toHaveBeenCalledTimes(1);
    expect(store.doseInstances[0].notified_at).toBeNull();

    // Dentro da mesma janela do fetch (o relógio está congelado): a dose liberada volta a ser
    // reivindicável e é enviada UMA vez. Fora da janela do minuto agendado não há reenvio — é a
    // mesma limitação de antes desta mudança, e fechá-la é escopo de outra spec.
    const ok = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };
    await checkRemindersViaDispatcher(ok, 'corr-retry');

    expect(ok.dispatch).toHaveBeenCalledTimes(1);
    expect(store.doseInstances[0].notified_at).not.toBeNull();
  });

  it('PO-7 guard: o release NÃO apaga o carimbo de outro worker (.eq no claimedAt)', async () => {
    store.doseInstances = [makeInstance()];

    // Worker 1 reivindica (carimbo T1) e falha no dispatch. ENQUANTO o dispatch está em voo,
    // o worker 2 rouba a linha carimbando T2 — o release do worker 1 vem depois e não pode
    // destravar a dose que o worker 2 acabou de reivindicar.
    const alienStamp = '2030-01-01T00:00:00.000Z';
    const failing = {
      dispatch: vi.fn(() => {
        store.doseInstances[0].notified_at = alienStamp;
        return Promise.resolve({ success: false, errors: ['push down'] });
      }),
    };

    await checkRemindersViaDispatcher(failing, 'corr-alien');

    expect(failing.dispatch).toHaveBeenCalledTimes(1);
    expect(store.doseInstances[0].notified_at).toBe(alienStamp);
  });

  it('regressão: soneca do MOBILE (notified_at preenchido) continua sendo enviada', async () => {
    // `setSnoozedUntil` (createDoseInstanceRepository) grava snoozed_until SEM zerar notified_at —
    // ao contrário do caminho do Telegram. Um claim que exigisse notified_at IS NULL descartaria
    // esta dose em silêncio.
    store.doseInstances = [makeInstance({
      scheduled_for: '2020-01-01T00:00:00.000Z',
      snoozed_until: nowWindowISO(),
      notified_at: '2026-08-20T13:10:00.000Z',
    })];
    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };

    await checkRemindersViaDispatcher(dispatcher, 'corr-mobile-snooze');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(store.doseInstances[0].snoozed_until).toBeNull();
  });

  it('PO-3: dois ciclos concorrentes sobre dose ADIADA também disparam UMA vez', async () => {
    store.doseInstances = [makeInstance({
      scheduled_for: '2020-01-01T00:00:00.000Z',
      snoozed_until: nowWindowISO(),
      notified_at: '2026-08-20T13:10:00.000Z',
    })];

    const a = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };
    const b = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };
    await Promise.all([
      checkRemindersViaDispatcher(a, 'corr-A'),
      checkRemindersViaDispatcher(b, 'corr-B'),
    ]);

    expect(a.dispatch.mock.calls.length + b.dispatch.mock.calls.length).toBe(1);
  });

  it('PO-7: release da dose ADIADA restaura o snoozed_until (senão ela some das duas queries)', async () => {
    const snooze = nowWindowISO();
    store.doseInstances = [makeInstance({
      scheduled_for: '2020-01-01T00:00:00.000Z',
      snoozed_until: snooze,
      notified_at: null,
    })];

    const failing = { dispatch: vi.fn(() => Promise.resolve({ success: false, errors: ['push down'] })) };
    await checkRemindersViaDispatcher(failing, 'corr-snooze-fail');

    expect(store.doseInstances[0].snoozed_until).toBe(snooze);
    expect(store.doseInstances[0].notified_at).toBeNull();
  });

  it('erro de BANCO no claim não vira lembrete perdido: envia e carimba depois (fail-open)', async () => {
    store.doseInstances = [makeInstance()];
    flags.failClaimOnce = true;

    const dispatcher = { dispatch: vi.fn(() => Promise.resolve({ success: true })) };
    await checkRemindersViaDispatcher(dispatcher, 'corr-dberr');

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(store.doseInstances[0].notified_at).not.toBeNull();
  });
});
