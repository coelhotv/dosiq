// ensurePushChannel.test.ts — canais Android do push remoto (spec 062 F3).
//
// Nasceu como CARACTERIZAÇÃO (RC3 E-6): o ensurePushChannel nunca tinha teste.
// ⚠️ Asserção sobre argumento passado à lib é regressão de WIRING, não prova de que o canal existe
// no device com essa config — isso só o `dumpsys` prova (PO-19, INV-4).

import { Platform } from 'react-native'
import { ANDROID_PUSH_CHANNEL } from '@dosiq/core'

const mockSetChannel = jest.fn()
jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: (...a) => mockSetChannel(...a),
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
}))

const mockCaptureMessage = jest.fn()
jest.mock('@sentry/react-native', () => ({
  captureMessage: (...a) => mockCaptureMessage(...a),
}))

// Flag de módulo vive por processo → cada teste carrega o módulo do zero.
function loadFresh() {
  let mod: typeof import('../ensurePushChannel')
  jest.isolateModules(() => {
    mod = require('../ensurePushChannel')
  })
  return mod!
}

const idsCreated = () => mockSetChannel.mock.calls.map(([id]) => id)
const configOf = (id) => mockSetChannel.mock.calls.find(([cid]) => cid === id)?.[1]

const originalOS = Platform.OS

beforeEach(() => {
  mockSetChannel.mockResolvedValue(null)
  Platform.OS = 'android'
})

afterEach(() => {
  Platform.OS = originalOS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ensurePushChannel — canal comum (caracterização)', () => {
  it('cria o dosiq-default-v1 com push_chime e HIGH', async () => {
    await loadFresh().ensurePushChannel()
    expect(configOf(ANDROID_PUSH_CHANNEL.DEFAULT)).toMatchObject({
      name: 'Lembretes e avisos',
      importance: 6,
      sound: 'push_chime.wav',
    })
  })

  it('no-op no iOS', async () => {
    Platform.OS = 'ios'
    await loadFresh().ensurePushChannel()
    expect(mockSetChannel).not.toHaveBeenCalled()
  })

  it('não lança quando a criação falha', async () => {
    mockSetChannel.mockRejectedValue(new Error('boom'))
    await expect(loadFresh().ensurePushChannel()).resolves.toBeUndefined()
  })
})

describe('ensurePushChannel — canal crítico (F3-B, D-10)', () => {
  it('cria o dosiq-critical-v1 espelhando o canal do alarme (alarm_dose, HIGH, USAGE_ALARM)', async () => {
    await loadFresh().ensurePushChannel()
    expect(configOf(ANDROID_PUSH_CHANNEL.CRITICAL)).toMatchObject({
      name: 'Avisos de dose essencial',
      importance: 6,
      sound: 'alarm_dose.wav',
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: 1,
      audioAttributes: { usage: 4, contentType: 4 },
    })
  })

  it('falha do DEFAULT não impede o CRITICAL', async () => {
    mockSetChannel.mockImplementation(async (id) => {
      if (id === ANDROID_PUSH_CHANNEL.DEFAULT) throw new Error('default falhou')
    })
    await loadFresh().ensurePushChannel()
    expect(idsCreated()).toContain(ANDROID_PUSH_CHANNEL.CRITICAL)
  })

  it('falha do CRITICAL loga (sem silêncio), não lança e re-tenta na próxima chamada', async () => {
    mockSetChannel.mockImplementation(async (id) => {
      if (id === ANDROID_PUSH_CHANNEL.CRITICAL) throw new Error('oem')
    })
    const mod = loadFresh()
    await expect(mod.ensurePushChannel()).resolves.toBeUndefined()
    expect(mockCaptureMessage).toHaveBeenCalledWith('push_critical_channel_failed', 'warning')

    mockSetChannel.mockClear()
    mockSetChannel.mockResolvedValue(null)
    await mod.ensurePushChannel()
    expect(idsCreated()).toEqual([ANDROID_PUSH_CHANNEL.CRITICAL])
  })

  it('após sucesso dos dois, não chama a lib de novo', async () => {
    const mod = loadFresh()
    await mod.ensurePushChannel()
    mockSetChannel.mockClear()
    await mod.ensurePushChannel()
    expect(mockSetChannel).not.toHaveBeenCalled()
  })
})
