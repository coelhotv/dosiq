// treatmentCountBucket.analytics.test.ts — 092 FR-002 / PO-2: persona como super property.
// Com chave do PostHog (client mockado): o que importa é o `register`, não a rede.

const mockRegister = jest.fn()
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ capture: jest.fn(), register: (...a) => mockRegister(...a) })),
}))
jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }))
jest.mock('@platform/config/nativePublicAppConfig', () => ({
  posthogApiKey: 'phc_test',
  posthogHost: 'https://us.i.posthog.com',
}))

import { setTreatmentCountBucket } from '../productAnalytics'

const DAY = '2026-10-04'
const row = (over = {}) => ({ start_date: '2026-09-01', end_date: null, active: true, ...over })

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('setTreatmentCountBucket', () => {
  it('registra a faixa calculada pelo core (pausado conta, futuro não)', async () => {
    await setTreatmentCountBucket([row(), row({ active: false }), row({ start_date: '2026-10-05' })], DAY)
    expect(mockRegister).toHaveBeenCalledWith({ treatment_count_bucket: '1-3' })
  })

  it('re-registra ao cruzar a faixa', async () => {
    await setTreatmentCountBucket([row(), row(), row()], DAY)
    await setTreatmentCountBucket([row(), row(), row(), row()], DAY)
    expect(mockRegister.mock.calls).toEqual([[{ treatment_count_bucket: '1-3' }], [{ treatment_count_bucket: '4+' }]])
  })

  it('zero tratamentos vigentes é fato medido → "0"', async () => {
    await setTreatmentCountBucket([], DAY)
    expect(mockRegister).toHaveBeenCalledWith({ treatment_count_bucket: '0' })
  })

  it('sem dado (carga falhou) → NÃO registra, nunca "0" inventado (AC-2.2)', async () => {
    await setTreatmentCountBucket(undefined, DAY)
    await setTreatmentCountBucket(null, DAY)
    expect(mockRegister).not.toHaveBeenCalled()
  })
})
