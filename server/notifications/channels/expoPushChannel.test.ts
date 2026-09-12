// Testes para expoPushChannel
// Cobre múltiplos devices, erros permanentes e desativação de token
//
// IMPORTANTE: expoClient expõe `sendPushNotificationsAsync` (não `send`).
// Consultar expoPushChannel.js para a API exata usada (Gate 6 — R-275).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendExpoPushNotification } from './expoPushChannel'

const makePayload = () => ({
  title: 'Estoque baixo',
  body: '*Losartana* está acabando',       // MarkdownV2 (body L2)
  pushBody: 'Losartana está acabando',     // Texto puro para Push (R-205)
  deeplink: 'dosiq://stock',
  metadata: { kind: 'stock_alert', builtAt: '2026-01-01T00:00:00Z' },
  actions: [],
})

const makeContext = () => ({ correlationId: 'expo-test-001' })

const mockExpoClient = { sendPushNotificationsAsync: vi.fn() }
const mockRepositories = {
  devices: {
    listActiveByUser: vi.fn(),
    deactivateByToken: vi.fn(),
  },
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('expoPushChannel', () => {
  // Caso 1: 2 devices ativos → 2 mensagens enviadas com pushBody (não body)
  it('caso 1: 2 devices ativos → 2 mensagens enviadas, 2 entregues', async () => {
    const devices = [
      { push_token: 'ExponentPushToken[aaa]' },
      { push_token: 'ExponentPushToken[bbb]' },
    ]
    mockRepositories.devices.listActiveByUser.mockResolvedValue(devices)
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }])

    const result = await sendExpoPushNotification({
      userId: 'user-1',
      payload: makePayload(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.channel).toBe('mobile_push')
    expect(result.attempted).toBe(2)
    expect(result.delivered).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.deactivatedTokens).toHaveLength(0)

    // Verifica que usa pushBody (texto puro) para o campo body do push
    expect(mockExpoClient.sendPushNotificationsAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'ExponentPushToken[aaa]',
          body: 'Losartana está acabando', // pushBody, não body Markdown
        }),
        expect.objectContaining({ to: 'ExponentPushToken[bbb]' }),
      ])
    )
  })

  // Caso 2: 1 device com DeviceNotRegistered → desativado, outro entregue
  it('caso 2: 1 DeviceNotRegistered desativado, 1 entregue', async () => {
    const devices = [
      { push_token: 'ExponentPushToken[bad]' },
      { push_token: 'ExponentPushToken[good]' },
    ]
    mockRepositories.devices.listActiveByUser.mockResolvedValue(devices)
    mockRepositories.devices.deactivateByToken.mockResolvedValue(undefined)
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok' },
    ])

    const result = await sendExpoPushNotification({
      userId: 'user-2',
      payload: makePayload(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(2)
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.deactivatedTokens).toContain('ExponentPushToken[bad]')
    expect(mockRepositories.devices.deactivateByToken).toHaveBeenCalledWith('ExponentPushToken[bad]')
    expect(mockRepositories.devices.deactivateByToken).not.toHaveBeenCalledWith('ExponentPushToken[good]')
  })

  // Caso 3: sem devices ativos → retorna success=true com attempted=0
  it('caso 3: sem devices ativos → noop', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await sendExpoPushNotification({
      userId: 'user-3',
      payload: makePayload(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.success).toBe(true)
    expect(result.attempted).toBe(0)
    expect(result.delivered).toBe(0)
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
  })
})

// Gate de duplicata do alarme nativo. Era da Spec 001 A2 (o canal filtrava devices com
// `native_alarm_enabled`) e mudou de lugar na 082 Slice C: a decisão passou a nascer no reminder,
// por OCORRÊNCIA, e chega aqui pronta em `metadata.suppress_push_reason`.
// O motivo da mudança está medido: `native_alarm_enabled` está `true` em 9 de 9 devices ativos —
// ela nasce `true` no registro e significa "o app abriu uma vez", não "o alarme desta dose está
// armado". Era ela que suprimia o push de quem passava dias sem abrir o app (RC3/F3).
describe('expoPushChannel — gate alarme nativo (dose)', () => {
  // `type`, não `interface`: só aliases ganham index signature implícita, e o `metadata` do canal
  // declara `[key: string]: unknown`. Com `interface` o payload inteiro fica inatribuível.
  type DoseReminderMetadata = {
    kind: string
    critical_alarm: boolean
    builtAt: string
    /** 082 Slice C — decisão de supressão que o reminder manda ao canal (FR-013b). */
    suppress_push_reason?: 'native_alarm' | 'no_alarm_evidence'
  }

  const doseReminder = (kind = 'dose_reminder') => ({
    title: '💊 Hora da dose',
    body: 'Está na hora de tomar Losartana (08:00)',
    pushBody: 'Está na hora de tomar Losartana (08:00)',
    metadata: { kind, critical_alarm: true, builtAt: '2026-01-01T00:00:00Z' } as DoseReminderMetadata,
    actions: [],
  })

  /** O `reason` só existe no retorno sem tentativa — a união do canal não o expõe direto. */
  const motivoDe = (result: unknown) => (result as { reason?: string }).reason

  it('🔴 082/RC3-F3: SEM decisão do reminder, TODOS os devices recebem — inclusive com alarme ON', async () => {
    // Era este o comportamento que a flag do aparelho suprimia sozinha. Se este caso voltar a
    // entregar 1 em vez de 2, o slice está entregando comportamento idêntico ao anterior.
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[alarm]', native_alarm_enabled: true },
      { push_token: 'ExponentPushToken[plain]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }])

    const result = await sendExpoPushNotification({
      userId: 'user-gate-1',
      payload: doseReminder(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(2)
    const [messages] = mockExpoClient.sendPushNotificationsAsync.mock.calls[0]
    expect(messages.map((m: { to: string }) => m.to)).toEqual([
      'ExponentPushToken[alarm]',
      'ExponentPushToken[plain]',
    ])
  })

  it.each(['dose_reminder', 'dose_reminder_by_plan', 'dose_reminder_misc'])(
    'kind %s: decisão `native_alarm` do reminder ⇒ noop e motivo devolvido ao dispatcher',
    async (kind) => {
      mockRepositories.devices.listActiveByUser.mockResolvedValue([
        { push_token: 'ExponentPushToken[a]', native_alarm_enabled: true },
        { push_token: 'ExponentPushToken[b]', native_alarm_enabled: false },
      ])

      const payload = doseReminder(kind)
      payload.metadata.suppress_push_reason = 'native_alarm'

      const result = await sendExpoPushNotification({
        userId: 'user-gate-2',
        payload,
        context: makeContext(),
        repositories: mockRepositories,
        expoClient: mockExpoClient,
      })

      expect(result.success).toBe(true)
      expect(result.attempted).toBe(0)
      // O canal INFORMA o motivo; quem o converte em status é o dispatcher (R-200/ADR-100).
      expect(motivoDe(result)).toBe('native_alarm')
      expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
    }
  )

  it('🔴 decisão `no_alarm_evidence` devolve o motivo próprio (vira suprimida_sem_prova)', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[a]', native_alarm_enabled: true },
    ])

    const payload = doseReminder()
    payload.metadata.suppress_push_reason = 'no_alarm_evidence'

    const result = await sendExpoPushNotification({
      userId: 'user-gate-sem-prova',
      payload,
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(0)
    expect(motivoDe(result)).toBe('no_alarm_evidence')
  })

  it('🔴 D-C1: supressão SEM nenhum device ⇒ motivo é `no_devices`, não a supressão', async () => {
    // Sem aparelho não havia push a suprimir. Carimbar a supressão aqui atribuiria ao gate um
    // silêncio que é falta de canal — e inflaria o silêncio residual do D1 (SC-002a).
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const payload = doseReminder()
    payload.metadata.suppress_push_reason = 'no_alarm_evidence'

    const result = await sendExpoPushNotification({
      userId: 'user-gate-sem-device',
      payload,
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(motivoDe(result)).toBe('no_devices')
  })

  it('FR-014: dose NÃO-crítica ignora `suppress_push_reason` e recebe push', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[normal]', native_alarm_enabled: true },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    const payload = doseReminder()
    payload.metadata.critical_alarm = false
    payload.metadata.suppress_push_reason = 'native_alarm'

    const result = await sendExpoPushNotification({
      userId: 'user-gate-normal',
      payload,
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(1)
  })

  it('kind não-dose (stock_alert): device com alarme ON AINDA recebe', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[alarm]', native_alarm_enabled: true },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    const result = await sendExpoPushNotification({
      userId: 'user-gate-3',
      payload: makePayload(), // stock_alert
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(1)
    expect(result.delivered).toBe(1)
    const [messages] = mockExpoClient.sendPushNotificationsAsync.mock.calls[0]
    expect(messages[0].to).toBe('ExponentPushToken[alarm]')
  })

  it('deve usar som alarm_dose.wav e time-sensitive para dose crítica', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[plain]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    await sendExpoPushNotification({
      userId: 'user-sound-critical',
      payload: {
        title: 'Hora da dose',
        body: 'Medicamento essencial',
        metadata: { kind: 'dose_reminder', critical_alarm: true },
      },
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    const [messages] = mockExpoClient.sendPushNotificationsAsync.mock.calls[0]
    expect(messages[0].sound).toBe('alarm_dose.wav')
    expect(messages[0].interruptionLevel).toBe('time-sensitive')
    expect(messages[0].channelId).toBe('dosiq-critical-v1')
  })

  it('deve usar som push_chime.wav e active para dose normal', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[plain]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    await sendExpoPushNotification({
      userId: 'user-sound-normal',
      payload: {
        title: 'Hora da dose',
        body: 'Medicamento normal',
        metadata: { kind: 'dose_reminder', critical_alarm: false },
      },
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    const [messages] = mockExpoClient.sendPushNotificationsAsync.mock.calls[0]
    expect(messages[0].sound).toBe('push_chime.wav')
    expect(messages[0].interruptionLevel).toBe('active')
    expect(messages[0].channelId).toBe('dosiq-default-v1')
  })

  // 029 F5 (T025): sem estas 3 peças o push do switch chega SEM botão — o schema e a copy
  // sozinhos não desenham nada no device (o canal Expo ignorava `actions` até esta fase).
  describe('Evolução do tratamento (029 F5)', () => {
    const sendTitration = async (payload: {
      title: string
      body: string
      metadata: { kind: string }
      actions: Array<{ id: string; label: string; params?: Record<string, unknown> }>
    }) => {
      mockRepositories.devices.listActiveByUser.mockResolvedValue([
        { push_token: 'ExponentPushToken[evo]', native_alarm_enabled: false },
      ])
      mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])
      await sendExpoPushNotification({
        userId: 'user-evo',
        payload,
        context: makeContext(),
        repositories: mockRepositories,
        expoClient: mockExpoClient,
      })
      return mockExpoClient.sendPushNotificationsAsync.mock.calls[0][0][0]
    }

    it('medicine_switch → time-sensitive + categoryId + ações no data', async () => {
      const msg = await sendTitration({
        title: 'Etapa 2 começa hoje',
        body: 'Semaglutida 0,5 mg',
        metadata: { kind: 'titration_alert' },
        actions: [
          { id: 'start_step', label: 'Iniciar etapa', params: { stepId: 'step-1' } },
          { id: 'not_yet', label: 'Ainda não', params: { stepId: 'step-1' } },
        ],
      })
      expect(msg.interruptionLevel).toBe('time-sensitive')
      expect(msg.categoryId).toBe('dosiq-titration-v1')
      // O handler precisa do stepId — o categoryId só desenha os botões.
      expect(msg.data.actions[0].params.stepId).toBe('step-1')
      // Time-sensitive NÃO é alarme: som e canal seguem os normais.
      expect(msg.sound).toBe('push_chime.wav')
      expect(msg.channelId).toBe('dosiq-default-v1')
    })

    it('dose_change (sem ações) → active e sem categoria (§3.4)', async () => {
      const msg = await sendTitration({
        title: 'Dose ajustada para 2 comprimidos',
        body: 'Metoprolol 50 mg',
        metadata: { kind: 'titration_alert' },
        actions: [],
      })
      expect(msg.interruptionLevel).toBe('active')
      expect(msg.categoryId).toBeUndefined()
      expect(msg.data.actions).toBeUndefined()
    })
  })
})
