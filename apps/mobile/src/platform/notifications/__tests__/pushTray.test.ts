// 082 D2 (smoke T101): push de dose registrada sai da bandeja; bloco só quando TODAS resolvidas.

import * as Notifications from 'expo-notifications'
import { dismissPushForResolvedDoses } from '../pushTray'

jest.mock('expo-notifications', () => ({
  getPresentedNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
}))

const mockResolved = new Set<string>()
jest.mock('@platform/doseActivity/resolvedDoseStore', () => ({
  isDoseResolved: jest.fn(async (id) => mockResolved.has(id)),
}))

const presented = jest.mocked(Notifications.getPresentedNotificationsAsync)
const dismiss = jest.mocked(Notifications.dismissNotificationAsync)
const push = (identifier: string, data: unknown) => ({ request: { identifier, content: { data } } }) as any

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockResolved.clear()
})

describe('dismissPushForResolvedDoses', () => {
  it('dispensa o push da dose registrada e mantém os demais', async () => {
    presented.mockResolvedValueOnce([
      push('p1', { kind: 'dose_reminder', doseInstanceIds: ['inst-1'] }),
      push('p2', { kind: 'dose_reminder', doseInstanceIds: ['inst-2'] }),
    ])
    await dismissPushForResolvedDoses(['inst-1'])
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(dismiss).toHaveBeenCalledWith('p1')
  })

  it('bloco: fica enquanto alguma dose segue pendente; sai quando todas resolvidas', async () => {
    presented.mockResolvedValue([push('bloco', { doseInstanceIds: ['a', 'b'] })])
    await dismissPushForResolvedDoses(['a'])
    expect(dismiss).not.toHaveBeenCalled()
    mockResolved.add('a')
    await dismissPushForResolvedDoses(['b'])
    expect(dismiss).toHaveBeenCalledWith('bloco')
  })

  it('Android/FCM: data vazio, ids vêm da tag no identificador estrangeiro', async () => {
    const fcm = (tag: string) => `expo-notifications://foreign_notifications?tag=${encodeURIComponent(tag)}&id=0`
    presented.mockResolvedValueOnce([
      push(fcm('dose:inst-1'), {}),
      push(fcm('dose:inst-1,inst-2'), {}),
      push(fcm('FCM-Notification:509892109'), {}),
    ])
    await dismissPushForResolvedDoses(['inst-1'])
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(dismiss).toHaveBeenCalledWith(fcm('dose:inst-1'))
  })

  it('push antigo sem doseInstanceIds fica como antes', async () => {
    presented.mockResolvedValueOnce([push('velho', { kind: 'dose_reminder', protocolId: 'p' })])
    await dismissPushForResolvedDoses(['inst-1'])
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('leitura falha ⇒ não lança (best-effort)', async () => {
    presented.mockRejectedValueOnce(new Error('x'))
    await expect(dismissPushForResolvedDoses(['inst-1'])).resolves.toBeUndefined()
  })
})
