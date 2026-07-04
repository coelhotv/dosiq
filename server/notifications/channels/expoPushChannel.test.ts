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
    mockRepositories.devices.deactivateByToken.mockResolvedValue()
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

// Gate de duplicata do alarme nativo (Spec 001 A2): devices com
// native_alarm_enabled NÃO recebem push de lembrete de DOSE (alarme local cobre).
// Outros kinds e devices sem o flag seguem normais.
describe('expoPushChannel — gate alarme nativo (dose)', () => {
  const doseReminder = (kind = 'dose_reminder') => ({
    title: '💊 Hora da dose',
    body: 'Está na hora de tomar Losartana (08:00)',
    pushBody: 'Está na hora de tomar Losartana (08:00)',
    metadata: { kind, critical_alarm: true, builtAt: '2026-01-01T00:00:00Z' },
    actions: [],
  })

  it('dose_reminder: device com alarme ON é filtrado, device OFF recebe', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[alarm]', native_alarm_enabled: true },
      { push_token: 'ExponentPushToken[plain]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    const result = await sendExpoPushNotification({
      userId: 'user-gate-1',
      payload: doseReminder(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(1)
    expect(result.delivered).toBe(1)
    const [messages] = mockExpoClient.sendPushNotificationsAsync.mock.calls[0]
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe('ExponentPushToken[plain]')
  })

  it.each(['dose_reminder', 'dose_reminder_by_plan', 'dose_reminder_misc'])(
    'kind %s: todos os devices com alarme ON → noop (nada enviado)',
    async (kind) => {
      mockRepositories.devices.listActiveByUser.mockResolvedValue([
        { push_token: 'ExponentPushToken[a]', native_alarm_enabled: true },
        { push_token: 'ExponentPushToken[b]', native_alarm_enabled: true },
      ])

      const result = await sendExpoPushNotification({
        userId: 'user-gate-2',
        payload: doseReminder(kind),
        context: makeContext(),
        repositories: mockRepositories,
        expoClient: mockExpoClient,
      })

      expect(result.success).toBe(true)
      expect(result.attempted).toBe(0)
      expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
    }
  )

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
})
