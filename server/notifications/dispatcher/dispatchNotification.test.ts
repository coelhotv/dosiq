// Testes para dispatchNotification
// Cobre coexistência de canais, isolamento de falhas e casos-limite

process.env.VAPID_PUBLIC_KEY = 'mock-public-key'
process.env.VAPID_PRIVATE_KEY = 'mock-private-key'

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { dispatchNotification } from './dispatchNotification'

const mockSendNotification = vi.fn()
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args)
  }
}))

vi.mock('../repositories/notificationLogRepository.js', () => ({
  notificationLogRepository: {
    create: vi.fn().mockResolvedValue({ id: 'log-123' }),
    listByUserId: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('../../utils/dateUtils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/dateUtils.js')>()
  return {
    ...actual,
    getNow: vi.fn(() => actual.parseISO('2026-05-02T12:00:00Z')),
    getCurrentTime: vi.fn(() => '12:00'),
    getServerTimestamp: vi.fn(() => '2026-05-02T12:00:00Z')
  }
})

const mockData = {
  medicineName: 'Medicamento Teste',
  time: '12:00',
  dosage: '1 cp',
  protocolId: 'prot-123',
  hour: 12
}

const makeContext = () => ({ correlationId: 'test-corr-123' })

const mockBot = { sendMessage: vi.fn() }
const mockExpoClient = { sendPushNotificationsAsync: vi.fn() }
const mockRepositories = {
  preferences: { 
    getSettingsByUserId: vi.fn().mockResolvedValue({ 
      notification_mode: 'realtime', 
      quiet_hours_enabled: false,
      channel_mobile_push_enabled: true,
      channel_telegram_enabled: true
    }), 
    getByUserId: vi.fn().mockResolvedValue('both'),
    hasTelegramChat: vi.fn().mockResolvedValue(true) 
  },
  devices: { listActiveByUser: vi.fn(), deactivateByToken: vi.fn() },
}

// Supabase centralizado importado em telegramChannel — mockamos o módulo centralizado
vi.mock('../../services/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: { telegram_chat_id: 'chat-999' }, error: null }),
        }),
      }),
    }),
  },
}))

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = 'mock-public-key'
  process.env.VAPID_PRIVATE_KEY = 'mock-private-key'
})

afterEach(() => {
  vi.clearAllMocks()
  mockSendNotification.mockReset()
})

// ─────────────────────────────────────────────────────────────────────────────
// Spec 046 T014 — supressão por consentimento revogado.
//
// Ela vive no dispatcher (o funil de TODA notificação) e se decide com a linha de `user_settings`
// DAQUELE usuário. O teste que mais importa é o do isolamento: o defeito da 1ª versão era um SELECT
// global cuja falha abortava o run inteiro — a situação de um titular derrubava o lembrete de dose
// de todos os outros pacientes.
// ─────────────────────────────────────────────────────────────────────────────
describe('dispatchNotification — consentimento revogado (046 T014)', () => {
  const dispatchFor = (userId: string) =>
    dispatchNotification({
      userId,
      kind: 'dose_reminder',
      data: mockData,
      channels: ['telegram', 'mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

  it('🔴 titular que revogou não recebe NADA — nenhum canal é sequer tocado', async () => {
    mockRepositories.preferences.getSettingsByUserId.mockResolvedValueOnce({
      notification_mode: 'realtime',
      quiet_hours_enabled: false,
      channel_mobile_push_enabled: true,
      channel_telegram_enabled: true,
      consent_revoked_at: '2026-07-10T10:00:00Z',
    })

    const result = await dispatchFor('user-revogou')

    expect(result.totalDelivered).toBe(0)
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  it('🔴 falha ao ler as settings de UM usuário suprime só ele (não vira permissão de envio)', async () => {
    mockRepositories.preferences.getSettingsByUserId.mockResolvedValueOnce({
      notification_mode: 'realtime',
      quiet_hours_enabled: false,
      consent_revoked_at: null,
      _read_failed: true,
    })

    const result = await dispatchFor('user-leitura-falhou')

    expect(result.totalDelivered).toBe(0)
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
  })

  it('🔴 ISOLAMENTO: o paciente ao lado recebe normalmente na mesma execução', async () => {
    // Este é o teste que existe por causa do defeito da 1ª versão. Um usuário revogado (ou com a
    // linha ilegível) NÃO pode custar o lembrete de dose de quem consentiu.
    mockBot.sendMessage.mockResolvedValue({ message_id: 7 })
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[ok]' }])

    mockRepositories.preferences.getSettingsByUserId
      .mockResolvedValueOnce({ notification_mode: 'realtime', quiet_hours_enabled: false, consent_revoked_at: '2026-07-10T10:00:00Z' })
      .mockResolvedValueOnce({
        notification_mode: 'realtime',
        quiet_hours_enabled: false,
        channel_mobile_push_enabled: true,
        channel_telegram_enabled: true,
        consent_revoked_at: null,
      })

    const suprimido = await dispatchFor('user-revogou')
    const entregue = await dispatchFor('user-consentiu')

    expect(suprimido.totalDelivered).toBe(0)
    expect(entregue.totalDelivered).toBe(2)
  })
})

describe('dispatchNotification', () => {
  // Caso 1: both com Telegram OK + push OK → ambos entregues
  it('caso 1: both — Telegram e push entregues', async () => {
    mockBot.sendMessage.mockResolvedValue({ message_id: 1 })
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[abc]' }])

    const result = await dispatchNotification({
      userId: 'user-1',
      kind: 'dose_reminder',
      data: mockData,
      channels: ['telegram', 'mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.totalDelivered).toBe(2)
    expect(result.totalFailed).toBe(0)
    expect(result.channels).toHaveLength(2)
  })

  // Caso 2: both com push falhando → Telegram entrega, push falha sem cancelar Telegram
  it('caso 2: both — Telegram entregue, push falha isoladamente', async () => {
    mockBot.sendMessage.mockResolvedValue({ message_id: 2 })
    mockExpoClient.sendPushNotificationsAsync.mockRejectedValue(new Error('Expo service unavailable'))
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[def]' }])

    const result = await dispatchNotification({
      userId: 'user-2',
      kind: 'dose_reminder',
      data: mockData,
      channels: ['telegram', 'mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    const telegramResult = result.channels.find((c) => c.channel === 'telegram')
    const pushResult = result.channels.find((c) => c.channel === 'mobile_push')

    expect(telegramResult!.delivered).toBe(1)
    expect(pushResult!.success).toBe(false)
    expect(result.totalDelivered).toBe(1)
  })

  // Caso 3: mobile_push com DeviceNotRegistered → token desativado
  it('caso 3: DeviceNotRegistered desativa o token', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[bad]' }])
    mockRepositories.devices.deactivateByToken.mockResolvedValue(undefined)
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
    ])

    const result = await dispatchNotification({
      userId: 'user-3',
      kind: 'dose_reminder',
      data: mockData,
      channels: ['mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(mockRepositories.devices.deactivateByToken).toHaveBeenCalledWith('ExponentPushToken[bad]')
    expect(result.channels[0].deactivatedTokens).toContain('ExponentPushToken[bad]')
  })

  // Caso 4: none (channels=[]) → zero tentativas
  it('caso 4: channels vazio → nenhuma tentativa', async () => {
    mockRepositories.preferences.getSettingsByUserId.mockResolvedValueOnce({
      channel_mobile_push_enabled: false,
      channel_telegram_enabled: false
    })

    const result = await dispatchNotification({
      userId: 'user-4',
      kind: 'dose_reminder',
      data: mockData,
      channels: [],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.channels).toHaveLength(0)
    expect(result.totalDelivered).toBe(0)
    expect(result.totalFailed).toBe(0)
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  // Caso 5: usuário sem devices push → attempted 0
  it('caso 5: mobile_push sem devices → attempted 0', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await dispatchNotification({
      userId: 'user-5',
      kind: 'dose_reminder',
      data: mockData,
      channels: ['mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.channels[0].attempted).toBe(0)
    expect(result.totalDelivered).toBe(0)
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
  })

  // Caso 6: web_push — entrega com sucesso
  it('caso 6: web_push — entrega com sucesso', async () => {
    mockSendNotification.mockResolvedValue({ statusCode: 201 })
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: '{"endpoint":"https://fcm.googleapis.com","keys":{"p256dh":"abc","auth":"123"}}' }])

    const result = await dispatchNotification({
      userId: 'user-6',
      kind: 'dose_reminder',
      data: mockData,
      channels: ['web_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.totalDelivered).toBe(1)
    expect(result.totalFailed).toBe(0)
    expect(result.channels[0].channel).toBe('web_push')
    expect(mockSendNotification).toHaveBeenCalled()
  })

  // Caso 7: web_push com erro 410 (Gone) desativa o token
  it('caso 7: web_push com erro 410 (Gone) desativa o token', async () => {
    const error = Object.assign(new Error('Subscription no longer active'), { statusCode: 410 })
    mockSendNotification.mockRejectedValue(error)
    
    const mockToken = '{"endpoint":"https://fcm.googleapis.com","keys":{"p256dh":"bad","auth":"456"}}'
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: mockToken }])
    mockRepositories.devices.deactivateByToken.mockResolvedValue(undefined)

    const result = await dispatchNotification({
      userId: 'user-7',
      kind: 'dose_reminder',
      data: mockData,
      channels: ['web_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(mockRepositories.devices.deactivateByToken).toHaveBeenCalledWith(mockToken)
    expect(result.channels[0].success).toBe(false)
    expect(result.channels[0].deactivatedTokens).toContain(mockToken)
    expect(result.totalFailed).toBe(1)
  })

  // Caso 8: dose essencial/crítica fura preferências e garante mobile_push
  it('caso 8: dose essencial/crítica fura preferências e garante mobile_push', async () => {
    mockRepositories.preferences.getSettingsByUserId.mockResolvedValueOnce({
      channel_mobile_push_enabled: false,
      channel_telegram_enabled: false
    })
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[abc]' }])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    const result = await dispatchNotification({
      userId: 'user-8',
      kind: 'dose_reminder',
      data: { ...mockData, critical_alarm: true },
      channels: [],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.channels.map(c => c.channel)).toContain('mobile_push')
    expect(result.totalDelivered).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Spec 082 Slice A (ADR-100) — o status descreve a ENTREGA.
//
// Antes destes testes o dispatcher só sabia dizer `enviada` ou `falhou`, e errava nos dois
// sentidos: supressão deliberada saía como `falhou` (145 registros em 30 dias) e paciente SEM
// canal algum saía como `enviada` (930 registros, 27 pacientes). O que fecha o buraco não é o
// valor novo no CHECK — é o dispatcher receber `results` INTEIRO, com o motivo que o canal
// relatou, em vez do array já filtrado por `attempted > 0`.
//
// Os testes asseveram o que foi GRAVADO (`notificationLogRepository.create`), não o retorno do
// dispatch: o retorno já era verde no dia do incidente.
// ─────────────────────────────────────────────────────────────────────────────
describe('dispatchNotification — status da entrega (082/ADR-100)', () => {
  // `logNotificationEvent` sai de uma IIFE NÃO aguardada (dispatchNotification.ts:152). Sem
  // ceder o event loop, a asserção corre antes do insert e passa por vacuidade.
  const flushLog = () => new Promise((resolve) => setImmediate(resolve))

  const loggedStatus = async () => {
    await flushLog()
    const { notificationLogRepository } = await import('../repositories/notificationLogRepository.js')
    const calls = vi.mocked(notificationLogRepository.create).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    return calls[calls.length - 1][0] as unknown as { status: string; channels: Array<{ channel: string; status: string; reason: string | null }> }
  }

  const dispatchCritical = (userId: string, extraData: Record<string, unknown> = {}) =>
    dispatchNotification({
      userId,
      kind: 'dose_reminder',
      data: { ...mockData, critical_alarm: true, ...extraData },
      channels: [],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

  it('🔴 sem NENHUM canal físico ativo ⇒ sem_canal (era `enviada` — as 930 linhas)', async () => {
    mockRepositories.preferences.hasTelegramChat.mockResolvedValueOnce(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    await dispatchCritical('user-sem-canal')
    const logged = await loggedStatus()

    expect(logged.status).toBe('sem_canal')
    expect(logged.status).not.toBe('enviada')
  })

  it('🔴 push suprimido porque o alarme nativo cobre a dose ⇒ suprimida_alarme (era `falhou`)', async () => {
    // 082 Slice C: a supressão NÃO nasce mais do `native_alarm_enabled` do aparelho — ela chega
    // do reminder, que é quem tem o `instanceId` e checou a prova daquela ocorrência (RC3/F2).
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[alarme]', native_alarm_enabled: true },
    ])

    await dispatchCritical('user-alarme', { suppress_push_reason: 'native_alarm' })
    const logged = await loggedStatus()

    expect(logged.status).toBe('suprimida_alarme')
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
    // O motivo precisa sobreviver ao Zod do repositório — se for removido no parse, ninguém vê.
    expect(logged.channels.find((c) => c.channel === 'mobile_push')?.reason).toBe('native_alarm')
  })

  it('🔴 suprimida SEM prova de alarme ⇒ suprimida_sem_prova, NUNCA suprimida_alarme (FR-012b)', async () => {
    // O desfecho oposto em risco: ninguém avisou a paciente. Se gravar `suprimida_alarme`, a
    // apuração diária do Slice B o classifica como `coberta` e NÃO alerta — a dose some do
    // relatório com carimbo de cobertura, que é a família do defeito que abriu esta spec.
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[sem-prova]', native_alarm_enabled: true },
    ])

    await dispatchCritical('user-sem-prova', { suppress_push_reason: 'no_alarm_evidence' })
    const logged = await loggedStatus()

    expect(logged.status).toBe('suprimida_sem_prova')
    expect(logged.status).not.toBe('suprimida_alarme')
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
    expect(logged.channels.find((c) => c.channel === 'mobile_push')?.reason).toBe('no_alarm_evidence')
  })

  it('🔴 RC3/F3: dose crítica SEM decisão de supressão recebe push mesmo com native_alarm_enabled', async () => {
    // Este é o efeito do slice. Antes, a flag do aparelho (hoje `true` em 9 de 9 devices, e que
    // significa apenas "o app abriu uma vez") suprimia o push sozinha — inclusive de quem estava
    // dias sem abrir o app e, portanto, sem alarme armado. Sem esta asserção, o slice inteiro
    // poderia entregar comportamento IDÊNTICO ao anterior e ninguém veria.
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[sem-alarme-armado]', native_alarm_enabled: true },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    await dispatchCritical('user-capaz-sem-prova')
    const logged = await loggedStatus()

    expect(mockExpoClient.sendPushNotificationsAsync).toHaveBeenCalled()
    expect(logged.status).toBe('enviada')
  })

  it('🔴 D-C1: supressão pedida SEM nenhum aparelho ativo ⇒ sem_canal (não é silêncio do gate)', async () => {
    // Sem aparelho não havia push a suprimir: o desfecho honesto é ausência de canal, que é o que
    // o Slice B persegue. Carimbar `suprimida_sem_prova` aqui atribuiria ao gate um silêncio que é
    // falta de canal e inflaria o SC-002a com população que ele não descreve.
    mockRepositories.preferences.hasTelegramChat.mockResolvedValueOnce(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    await dispatchCritical('user-sem-aparelho', { suppress_push_reason: 'no_alarm_evidence' })
    const logged = await loggedStatus()

    expect(logged.status).toBe('sem_canal')
    expect(logged.status).not.toBe('suprimida_sem_prova')
  })

  it('FR-014: dose NÃO-crítica ignora a decisão de supressão e segue recebendo push', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[normal]', native_alarm_enabled: true },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    await dispatchNotification({
      userId: 'user-nao-critico',
      kind: 'dose_reminder',
      data: { ...mockData, critical_alarm: false, suppress_push_reason: 'native_alarm' },
      channels: [],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })
    const logged = await loggedStatus()

    expect(mockExpoClient.sendPushNotificationsAsync).toHaveBeenCalled()
    expect(logged.status).toBe('enviada')
  })

  it('canal tentou e errou ⇒ falhou', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[ruim]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
    ])

    await dispatchCritical('user-falha')
    const logged = await loggedStatus()

    expect(logged.status).toBe('falhou')
  })

  it('canal entregou ⇒ enviada (regra vigente preservada)', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[ok]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }])

    await dispatchCritical('user-ok')
    const logged = await loggedStatus()

    expect(logged.status).toBe('enviada')
  })

  it('supressão por política tem precedência sobre tudo ⇒ silenciada', async () => {
    // DUAS vezes: `resolveChannelsForUser` lê as settings antes do dispatcher checar o
    // consentimento. Um único `mockResolvedValueOnce` é consumido pela resolução de canais e a
    // checagem de consentimento cai no mock padrão — o teste passaria a medir outra coisa.
    // Quiet hours, não consentimento revogado: a revogação retorna ANTES do log (não existe linha
    // a inspecionar), enquanto a supressão por política grava a linha — que é o que este teste mede.
    // `getCurrentTime` está mockado em 12:00 no topo do arquivo.
    const settingsQuiet = {
      notification_mode: 'realtime',
      quiet_hours_enabled: true,
      quiet_hours_start: '08:00',
      quiet_hours_end: '22:00',
      channel_mobile_push_enabled: true,
      channel_telegram_enabled: true,
      consent_revoked_at: null,
    }
    mockRepositories.preferences.getSettingsByUserId
      .mockResolvedValueOnce(settingsQuiet)
      .mockResolvedValueOnce(settingsQuiet)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[ok]', native_alarm_enabled: false },
    ])

    await dispatchCritical('user-silenciado')
    const logged = await loggedStatus()

    expect(logged.status).toBe('silenciada')
  })

  it('🔴 motivo que este código NÃO conhece nunca vira sucesso ⇒ falhou', async () => {
    // Canal que rejeita a promise: chega em `results` com `attempted: 0` e SEM `reason`. É o caso
    // degenerado que a versão antiga transformava em `enviada` quando não havia canal válido.
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { push_token: 'ExponentPushToken[boom]', native_alarm_enabled: false },
    ])
    mockExpoClient.sendPushNotificationsAsync.mockRejectedValue(new Error('kaboom'))

    await dispatchCritical('user-desconhecido')
    const logged = await loggedStatus()

    expect(logged.status).toBe('falhou')
  })
})
