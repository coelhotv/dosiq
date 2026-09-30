import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const createMock = vi.fn((..._args: unknown[]) => Promise.resolve({}))

vi.mock('@shared/services', () => ({
  cachedLogService: { create: (...args) => createMock(...args) },
}))
vi.mock('@dashboard/services/analyticsService', () => ({ analyticsService: { track: vi.fn() } }))
vi.mock('@features/protocols/services/protocolService', () => ({ protocolService: {} }))
vi.mock('@features/protocols/services/reminderOptimizerService', () => ({
  dismissSuggestion: vi.fn(),
}))
vi.mock('@shared/utils/logger', () => ({ errorLog: vi.fn() }))
vi.mock('@utils/dateUtils', () => ({
  getNow: () => new Date('2026-09-30T12:00:00'),
  getServerTimestamp: () => '2026-09-30T15:00:00.000Z',
}))

import { useDashboardHandlers } from '@dashboard/hooks/useDashboardHandlers'

const oral = {
  medicineId: 'm-oral',
  protocolId: 'p-oral',
  dosagePerIntake: 1,
  instanceId: 'i-oral',
  presentation: 'comprimido',
}
const injA = {
  medicineId: 'm-inj',
  protocolId: 'p-inj',
  dosagePerIntake: 1,
  instanceId: 'i-inj',
  presentation: 'injetavel',
}
const injB = { ...injA, protocolId: 'p-inj2', instanceId: 'i-inj2' }

describe('useDashboardHandlers — dose injetável pede o local (071)', () => {
  let events: CustomEvent[]
  const listener = (e: Event) => events.push(e as CustomEvent)
  const setup = () =>
    renderHook(() =>
      useDashboardHandlers({
        refresh: vi.fn(),
        reminderSuggestionData: null,
        protocols: [],
        setDismissedSuggestionId: vi.fn(),
      })
    ).result

  beforeEach(() => {
    events = []
    window.addEventListener('mr:open-dose-modal', listener)
  })

  afterEach(() => {
    window.removeEventListener('mr:open-dose-modal', listener)
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('"Tomar" de injetável abre o modal com tratamento, instância e mapa aberto — sem registrar', async () => {
    const result = setup()
    await act(() =>
      result.current.handleRegisterDoseQuick('m-inj', 'p-inj', 1, 'i-inj', 'injetavel')
    )
    expect(createMock).not.toHaveBeenCalled()
    expect(events).toHaveLength(1)
    expect(events[0].detail.queue).toEqual([
      { type: 'protocol', protocol_id: 'p-inj', instance_id: 'i-inj', expandInjectionSite: true },
    ])
  })

  it('"Tomar" de não-injetável continua em 1 clique', async () => {
    const result = setup()
    await act(() => result.current.handleRegisterDoseQuick('m-oral', 'p-oral', 1, 'i-oral', 'comprimido'))
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ protocol_id: 'p-oral' }),
      { instanceId: 'i-oral' }
    )
    expect(events).toHaveLength(0)
  })

  it('lote separa: não-injetáveis em 1 clique, injetáveis em fila de modais', async () => {
    const result = setup()
    await act(() => result.current.handleRegisterDosesAll([injA, oral, injB]))
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ protocol_id: 'p-oral' }),
      { instanceId: 'i-oral' }
    )
    expect(events[0].detail.queue.map((q) => q.instance_id)).toEqual(['i-inj', 'i-inj2'])
  })

  it('lote só de injetáveis não registra nada direto', async () => {
    const result = setup()
    await act(() => result.current.handleRegisterDosesAll([injA]))
    expect(createMock).not.toHaveBeenCalled()
    expect(events[0].detail.queue).toHaveLength(1)
  })
})
