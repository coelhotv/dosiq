// analyticsConsentGate.test.ts — PostHog sob as autorizações A e B (spec 096 B3, T040f / CON-034).
//
// Política v0.4 §4: "Sem esse segundo consentimento, o app não envia esses eventos". O wrapper é o
// ponto único: enquanto A/B são desconhecidos, os eventos ficam em memória; com A+B saem na ordem;
// sem B (ou na recusa / logout) são descartados. Nenhuma chamada de rede ao PostHog sem B.
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const mockCapture = jest.fn()
const mockScreen = jest.fn()
const mockIdentify = jest.fn()
const mockOptIn = jest.fn()
const mockOptOut = jest.fn()
const mockCtor = jest.fn()

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((...args) => {
    mockCtor(...args)
    return {
      capture: (...a) => mockCapture(...a),
      screen: (...a) => mockScreen(...a),
      identify: (...a) => mockIdentify(...a),
      register: jest.fn(),
      reset: jest.fn(),
      optIn: (...a) => mockOptIn(...a),
      optOut: (...a) => mockOptOut(...a),
    }
  }),
}))
jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }))
jest.mock('@platform/config/nativePublicAppConfig', () => ({
  posthogApiKey: 'phc_teste',
  posthogHost: 'https://us.i.posthog.com',
}))
jest.mock('@platform/updates/bundleInfo', () => ({ bundleTags: () => ({}) }))

import {
  logEvent,
  logScreenView,
  setUserId,
  resetUser,
  setAnalyticsConsent,
  ANALYTICS_BUFFER_MAX,
} from '../productAnalytics'

afterEach(async () => {
  await resetUser()
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('PostHog sob A/B (096 B3)', () => {
  it('nasce opt-out no SDK e sem pré-carga de flags', async () => {
    await setAnalyticsConsent('allowed')
    expect(mockCtor).toHaveBeenCalledWith(
      'phc_teste',
      expect.objectContaining({ defaultOptIn: false, preloadFeatureFlags: false }),
    )
  })

  it('pendente: nada sai; eventos ficam retidos', async () => {
    await logEvent('onboarding_start', { surface: 'mobile' })
    await logScreenView('OnboardingWelcome')
    await setUserId('u-1')
    expect(mockCapture).not.toHaveBeenCalled()
    expect(mockScreen).not.toHaveBeenCalled()
    expect(mockIdentify).not.toHaveBeenCalled()
  })

  it('A+B: opt-in, identify e flush na ordem original', async () => {
    await setUserId('u-1')
    await logEvent('onboarding_start', { surface: 'mobile' })
    await logScreenView('OnboardingWelcome')
    await setAnalyticsConsent('allowed')

    expect(mockOptIn).toHaveBeenCalled()
    expect(mockIdentify).toHaveBeenCalledWith('u-1')
    // C-B3-14: o retido sai com a hora em que aconteceu, não a do envio.
    expect(mockCapture).toHaveBeenCalledWith('onboarding_start', { surface: 'mobile' }, { timestamp: expect.any(Date) })
    expect(mockScreen).toHaveBeenCalledWith(
      'OnboardingWelcome',
      { screen_class: 'OnboardingWelcome' },
      { timestamp: expect.any(Date) },
    )
    expect(mockCapture.mock.invocationCallOrder[0]).toBeLessThan(mockScreen.mock.invocationCallOrder[0])

    await logEvent('dose_logged')
    expect(mockCapture).toHaveBeenLastCalledWith('dose_logged', {}, undefined)
  })

  it('C-B3-14: o retido preserva a hora original do evento', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-21T20:00:00-03:00') })
    try {
      await logEvent('onboarding_start', { surface: 'mobile' })
      jest.setSystemTime(new Date('2026-10-21T20:05:00-03:00'))
      await setAnalyticsConsent('allowed')
      expect(mockCapture.mock.calls[0][2]).toEqual({ timestamp: new Date('2026-10-21T20:00:00-03:00') })
    } finally {
      jest.useRealTimers()
    }
  })

  it('sem B: descarta o retido e não envia mais nada', async () => {
    await logEvent('onboarding_start')
    await setAnalyticsConsent('denied')
    await logEvent('dose_logged')
    await logScreenView('Today')
    await setUserId('u-2')

    expect(mockOptOut).toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalled()
    expect(mockScreen).not.toHaveBeenCalled()
    expect(mockIdentify).not.toHaveBeenCalled()
  })

  it('recusa/logout (resetUser) descarta o retido', async () => {
    await logEvent('onboarding_start')
    await resetUser()
    await setAnalyticsConsent('allowed')
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('B retirado depois de ligado: para de enviar', async () => {
    await setAnalyticsConsent('allowed')
    await setAnalyticsConsent('denied')
    await logEvent('x')
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('fila tem teto: guarda os mais recentes', async () => {
    for (let i = 0; i < ANALYTICS_BUFFER_MAX + 5; i++) await logEvent(`e${i}`)
    await setAnalyticsConsent('allowed')
    expect(mockCapture).toHaveBeenCalledTimes(ANALYTICS_BUFFER_MAX)
    expect(mockCapture.mock.calls[0][0]).toBe('e5')
  })
})
