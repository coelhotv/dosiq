import { deriveIosAlarmOutcome } from '../deriveIosAlarmOutcome'

// Testes puros (sem timers/mocks de I/O) — cobrem derivação retroativa de desfecho
// de alarme crítico iOS no foreground (ENG-1, spec 042 Slice B).

afterEach(() => {
  jest.clearAllMocks()
})

describe('deriveIosAlarmOutcome', () => {
  it('retorna [] quando alarms está vazio', () => {
    const result = deriveIosAlarmOutcome({ alarms: [], permissionGranted: true, userId: 'u1' })
    expect(result).toEqual([])
  })

  it('retorna [] quando userId está ausente', () => {
    const alarms = [{ doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' }]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: undefined })
    expect(result).toEqual([])
  })

  it('ignora alarme não-crítico', () => {
    const alarms = [{ doseInstanceId: 'd1', isCritical: false, nagAttempt: 0, doseStatus: 'pending' }]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: 'u1' })
    expect(result).toEqual([])
  })

  it('ignora dose crítica já resolvida (taken)', () => {
    const alarms = [{ doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'taken' }]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: 'u1' })
    expect(result).toEqual([])
  })

  it('crítica + pending + permissão ok + nagAttempt:0 → alarm_fired', () => {
    const alarms = [{ doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' }]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: 'u1' })

    expect(result).toEqual([
      {
        userId: 'u1',
        doseInstanceId: 'd1',
        event: 'alarm_fired',
        platform: 'ios',
        actor: 'system',
        detail: { captured_at_foreground: true },
        // 067 C.2 (FR-015/FR-016): atualizado EXPLICITAMENTE — o payload iOS declara a hora do
        // fato como desconhecida em vez de deixar o `created_at` fingir que a sabe.
        occurredAt: null,
      },
    ])
  })

  it('crítica + pending + nagAttempt:2 + permissão ok → nag_fired', () => {
    const alarms = [{ doseInstanceId: 'd1', isCritical: true, nagAttempt: 2, doseStatus: 'pending' }]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: 'u1' })

    expect(result[0].event).toBe('nag_fired')
    expect(result[0].detail).toEqual({ captured_at_foreground: true })
  })

  it('crítica + pending + permissionGranted:false → alarm_suppressed', () => {
    const alarms = [{ doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' }]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: false, userId: 'u1' })

    expect(result[0].event).toBe('alarm_suppressed')
    expect(result[0].detail).toEqual({ captured_at_foreground: true, reason: 'permission_denied' })
  })

  it('GUARD PII: payloads não contêm nome de medicamento nem token', () => {
    const alarms = [
      { doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' },
      { doseInstanceId: 'd2', isCritical: true, nagAttempt: 1, doseStatus: 'pending' },
      { doseInstanceId: 'd3', isCritical: true, nagAttempt: 0, doseStatus: 'pending' },
    ]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: false, userId: 'u1' })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('medicineName')
    expect(serialized).not.toContain('token')

    for (const payload of result) {
      const detailKeys = Object.keys(payload.detail).sort()
      expect(detailKeys.every((k) => ['captured_at_foreground', 'reason'].includes(k))).toBe(true)
    }
  })

  // 067 C.2 / FR-015/FR-016 (PO-9) — iOS não roda JS no disparo (AP-257): este payload nasce no
  // FOREGROUND, então a hora do fato é desconhecida. NULL é a resposta honesta; gravar a hora da
  // derivação era o que produzia a mediana de +143 min contra +21 min do Android.
  describe('occurredAt — iOS declara desconhecido, não inventa', () => {
    it('TODO payload derivado sai com occurredAt null (nunca a hora do foreground)', () => {
      const alarms = [
        { doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' },
        { doseInstanceId: 'd2', isCritical: true, nagAttempt: 2, doseStatus: 'pending' },
      ]
      const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: 'u1' })

      expect(result).toHaveLength(2)
      for (const payload of result) {
        expect(payload.occurredAt).toBeNull()
        // captured_at_foreground é o que EXPLICA o null — os dois andam juntos.
        expect(payload.detail.captured_at_foreground).toBe(true)
      }
    })

    it('o ramo suppressed também sai com occurredAt null', () => {
      const alarms = [{ doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' }]
      const result = deriveIosAlarmOutcome({ alarms, permissionGranted: false, userId: 'u1' })

      expect(result[0].event).toBe('alarm_suppressed')
      expect(result[0].occurredAt).toBeNull()
    })
  })

  it('mix de alarmes: só o crítico+pending gera payload', () => {
    const alarms = [
      { doseInstanceId: 'd1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' },
      { doseInstanceId: 'd2', isCritical: false, nagAttempt: 0, doseStatus: 'pending' },
      { doseInstanceId: 'd3', isCritical: true, nagAttempt: 0, doseStatus: 'taken' },
    ]
    const result = deriveIosAlarmOutcome({ alarms, permissionGranted: true, userId: 'u1' })

    expect(result).toHaveLength(1)
    expect(result[0].doseInstanceId).toBe('d1')
  })
})
