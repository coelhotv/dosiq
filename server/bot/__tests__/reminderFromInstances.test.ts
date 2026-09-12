import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRemindersViaDispatcher } from '../reminders/doseReminders.js';

const mockDataQueue = [];

const { mockSupabase } = vi.hoisted(() => {
  const m = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    // 082 Slice C: o leitor de evidência fecha a cadeia com `.limit()` (teto explícito, AP-186).
    // Sem este método o builder estoura TypeError, o try/catch por usuário engole, e o teste que
    // afere "nenhum motivo de supressão" passa por VACUIDADE — dispatch nunca chamado.
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: vi.fn((onFulfilled) => {
      const result = mockDataQueue.shift() || { data: [], error: null };
      return Promise.resolve(result).then(onFulfilled);
    }),
  };
  return { mockSupabase: m };
});

vi.mock('../../services/supabase.js', () => ({
  supabase: mockSupabase
}));

vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../services/notificationDeduplicator.js', () => ({
  shouldSendNotification: vi.fn(() => Promise.resolve(true)),
  shouldSendGroupedNotification: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../utils/partitionDoses.js', () => ({
  partitionDoses: vi.fn((doses) => {
    if (doses.length === 0) return [];
    const block = {
      kind: 'dose_reminder',
      planId: null,
      planName: null,
      doses,
    };
    return [block];
  }),
}));

const setMockData = (data, error = null) => {
  mockDataQueue.push({ data, error });
};

describe('checkRemindersViaDispatcher — dose_instances path', () => {
  let mockDispatcher;
  const originalEnv = process.env.REMINDER_SOURCE;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataQueue.length = 0;
    mockDispatcher = {
      dispatch: vi.fn(() => Promise.resolve({ success: true })),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalEnv === undefined) {
      delete process.env.REMINDER_SOURCE;
    } else {
      process.env.REMINDER_SOURCE = originalEnv;
    }
  });

  it('novo caminho: sem usuários elegíveis → não dispara', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    setMockData([
      { user_id: 'user1', notification_mode: 'digest', timezone: 'America/Sao_Paulo' },
      { user_id: 'user2', notification_mode: 'digest', timezone: 'America/Sao_Paulo' },
    ]);

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('novo caminho: instância devida → claim ANTES do dispatch + dispatcher.dispatch chamado', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    const userSettings = [
      { user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' },
    ];
    setMockData(userSettings);

    const doseInstances = [
      {
        id: 'inst-1',
        user_id: 'user1',
        protocol_id: 'proto-1',
        protocol: {
          id: 'proto-1',
          name: 'Losartana',
          dosage_per_intake: 1,
          treatment_plan_id: null,
          medicine_id: 'med-1',
          medicine: { name: 'Losartana', dosage_unit: 'mg' },
          treatment_plan: null,
        },
      },
    ];
    setMockData(doseInstances); // query 1: não-snoozed
    setMockData([]);            // query 2: snoozed (Promise.all)

    setMockData([{ id: 'inst-1' }]); // claim: UPDATE ... IS NULL RETURNING id

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        kind: 'dose_reminder',
      })
    );

    expect(mockSupabase.update).toHaveBeenCalledWith({
      notified_at: expect.any(String),
      snoozed_until: null,
    });
  });

  it('horário do body = scheduled_for ORIGINAL (não o instante de saída do push — bug snooze)', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    setMockData([
      { user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' },
    ]);

    // Dose agendada p/ 12:15 SP (15:15 UTC). Mesmo que o cron rode num minuto diferente
    // (re-disparo de soneca), o body deve imprimir 12:15, não a hora atual.
    setMockData([
      {
        id: 'inst-1',
        user_id: 'user1',
        protocol_id: 'proto-1',
        critical_alarm: false,
        scheduled_for: '2026-06-30T15:15:00.000Z',
        protocol: {
          id: 'proto-1', name: 'Losartana', dosage_per_intake: 1,
          treatment_plan_id: null, medicine_id: 'med-1',
          medicine: { name: 'Losartana', dosage_unit: 'mg' }, treatment_plan: null,
        },
      },
    ]);
    setMockData([]);
    setMockData([{ id: 'inst-1' }]); // claim

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-time');

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'dose_reminder',
        data: expect.objectContaining({ time: '12:15' }),
      })
    );
  });

  it('novo caminho: instância com notified_at já setado não aparece (filtro IS NULL)', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    const userSettings = [
      { user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' },
    ];
    setMockData(userSettings);

    setMockData([]);

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------------------------
  // 082 Slice C — gate por evidência (FR-011/012/013). A decisão mora AQUI, no reminder, porque é
  // aqui que existe o `instanceId` de cada dose (RC3/F2). O canal só obedece o motivo recebido.
  // ---------------------------------------------------------------------------------------------
  describe('gate por evidência de alarme (082 Slice C)', () => {
    /** Monta a fila do caminho crítico: settings → instâncias → snoozed → [evidência] → [capacidade] → claim. */
    const armarCiclo = ({ instancias, evidencia, capaz = undefined, erroEvidencia = false }) => {
      setMockData([{ user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' }]);
      setMockData(instancias);
      setMockData([]);                       // snoozed
      if (erroEvidencia) {
        mockDataQueue.push({ data: null, error: { message: 'connection reset' } });
      } else {
        setMockData(evidencia.map(id => ({ dose_instance_id: id })));
      }
      if (capaz !== undefined) setMockData(capaz ? [{ id: 'ev-1' }] : []);
      setMockData(instancias.map(i => ({ id: i.id })));  // claim
    };

    const instanciaCritica = (id) => ({
      id,
      user_id: 'user1',
      protocol_id: 'proto-1',
      critical_alarm: true,
      scheduled_for: '2026-06-30T15:15:00.000Z',
      protocol: {
        id: 'proto-1', name: 'Losartana', dosage_per_intake: 1,
        treatment_plan_id: null, medicine_id: 'med-1',
        medicine: { name: 'Losartana', dosage_unit: 'mg' }, treatment_plan: null,
      },
    });

    const motivoDespachado = () =>
      mockDispatcher.dispatch.mock.calls[0]?.[0]?.data?.suppress_push_reason;

    it('🔴 TODAS as doses do bloco com prova ⇒ suprime como `native_alarm` (dose coberta) [PO-1]', async () => {
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({ instancias: [instanciaCritica('inst-1')], evidencia: ['inst-1'] });

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-prova');

      // Continua DESPACHANDO (FR-013a): suprimir é não entregar, não é não registrar. Se o
      // reminder simplesmente não chamasse o dispatch, a dose sumiria do notification_log e
      // cairia no anti-join do Slice B como não-entrega.
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(motivoDespachado()).toBe('native_alarm');
    });

    it('🔴 sem prova + usuário CAPAZ ⇒ push SAI (nenhum motivo de supressão) [PO-2]', async () => {
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({ instancias: [instanciaCritica('inst-1')], evidencia: [], capaz: true });

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-capaz');

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(motivoDespachado()).toBeUndefined();
    });

    it('🔴 sem prova + usuário INCAPAZ ⇒ suprime como `no_alarm_evidence` (silêncio residual do D1) [PO-2]', async () => {
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({ instancias: [instanciaCritica('inst-1')], evidencia: [], capaz: false });

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-incapaz');

      expect(motivoDespachado()).toBe('no_alarm_evidence');
      // O motivo NÃO pode ser o da dose coberta: são opostos em risco e o relatório do Slice B
      // trata `suprimida_alarme` como cobertura, que não alerta.
      expect(motivoDespachado()).not.toBe('native_alarm');
    });

    it('🔴 a supressão da crítica NÃO cala a não-crítica do mesmo ciclo (R-191 + spec §6)', async () => {
      // A não-crítica não tem alarme local para cobri-la. A proteção que existe HOJE é a partição
      // por criticidade (ADR-056 etapa 1): saem DOIS blocos, e só o crítico leva motivo.
      // (O guard de bloco misto dentro de `_resolveBlockSuppression` é defesa para um chamador
      // futuro — por este caminho ele é inalcançável, e é isso que este teste demonstra.)
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({
        instancias: [
          instanciaCritica('inst-1'),
          { ...instanciaCritica('inst-2'), critical_alarm: false },
        ],
        evidencia: ['inst-1', 'inst-2'],
      });
      setMockData([{ id: 'inst-2' }]);  // claim do 2º bloco

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-bloco-misto');

      const motivos = mockDispatcher.dispatch.mock.calls.map(c => c[0]?.data?.suppress_push_reason);
      expect(motivos).toHaveLength(2);
      expect(motivos.filter(m => m === 'native_alarm')).toHaveLength(1);
      expect(motivos.filter(m => m === undefined)).toHaveLength(1);
    });

    it('🔴 dose ADIADA não é coberta por prova ANTERIOR ao snooze (spec §6)', async () => {
      // O app não re-emite `alarm_scheduled` ao adiar (medido: 11 de 12 doses adiadas em 60 dias).
      // A prova existente descreve o alarme do horário original, que já passou — suprimir por ela
      // silencia a dose que a paciente pediu para ser lembrada de novo.
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({
        instancias: [{ ...instanciaCritica('inst-1'), snoozed_until: '2026-06-30T15:45:00.000Z' }],
        evidencia: ['inst-1'],
        capaz: true,
      });

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-snooze');

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(motivoDespachado()).toBeUndefined();
    });

    it('🔴 bloco MISTO (uma dose sem prova) ⇒ envia (RC3/F5 — o R-191 manda 1 push por bloco)', async () => {
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({
        instancias: [instanciaCritica('inst-1'), instanciaCritica('inst-2')],
        evidencia: ['inst-1'],
        capaz: true,
      });

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-misto');

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(motivoDespachado()).toBeUndefined();
    });

    it('🔴 fail-open: erro ao ler a evidência não suprime nem derruba o lembrete (FR-013)', async () => {
      process.env.REMINDER_SOURCE = 'instances';
      armarCiclo({ instancias: [instanciaCritica('inst-1')], evidencia: [], capaz: true, erroEvidencia: true });

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-falha');

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(motivoDespachado()).toBeUndefined();
    });

    it('FR-014: dose NÃO-crítica não paga consulta de evidência nem recebe motivo', async () => {
      process.env.REMINDER_SOURCE = 'instances';
      setMockData([{ user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' }]);
      setMockData([{ ...instanciaCritica('inst-1'), critical_alarm: false }]);
      setMockData([]);                    // snoozed
      setMockData([{ id: 'inst-1' }]);    // claim — SEM consulta de evidência no meio

      await checkRemindersViaDispatcher(mockDispatcher, 'corr-normal');

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(motivoDespachado()).toBeUndefined();
    });
  });

  it('legado: REMINDER_SOURCE não definido → usa protocols (não chama dose_instances)', async () => {
    delete process.env.REMINDER_SOURCE;

    const userSettings = [];
    setMockData(userSettings);

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockSupabase.from).not.toHaveBeenCalledWith('dose_instances');
  });
});
