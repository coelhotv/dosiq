// reminderEvents.test.ts — origem do lembrete + dedupe de reminder_opened (spec 065 AD-8)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const mockLogEvent = jest.fn()
jest.mock('../productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

import { emitReminderOpened, localReminderSource, __resetReminderDedupe } from '../reminderEvents'

afterEach(() => {
  __resetReminderDedupe()
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('localReminderSource', () => {
  it('superfície de dose ativa → dose_activity; alarme → alarm', () => {
    expect(localReminderSource({ doseInstanceId: 'i', __surface: 'true' })).toBe('dose_activity')
    expect(localReminderSource({ doseInstanceId: 'i' })).toBe('alarm')
  })

  it('sem doseInstanceId (não é lembrete de dose) / data null → null', () => {
    expect(localReminderSource({})).toBeNull()
    expect(localReminderSource(null)).toBeNull()
  })
})

describe('emitReminderOpened', () => {
  it('source null → nada (o chamador não precisa checar)', () => {
    emitReminderOpened(null, 'i')
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('mesmo aviso 2× na janela → 1 evento; fora da janela → 2', () => {
    jest.useFakeTimers()
    emitReminderOpened('alarm', 'i-1')
    emitReminderOpened('alarm', 'i-1')
    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(10_001)
    emitReminderOpened('alarm', 'i-1')
    expect(mockLogEvent).toHaveBeenCalledTimes(2)
  })

  it('avisos distintos não se deduplicam', () => {
    emitReminderOpened('alarm', 'i-1')
    emitReminderOpened('alarm', 'i-2')
    emitReminderOpened('dose_activity', 'i-1')
    expect(mockLogEvent).toHaveBeenCalledTimes(3)
    expect(mockLogEvent).toHaveBeenLastCalledWith('reminder_opened', { source: 'dose_activity', surface: 'push' })
  })
})
