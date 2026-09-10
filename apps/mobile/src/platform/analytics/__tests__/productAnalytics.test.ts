// productAnalytics.test.ts — contrato do wrapper de analytics (CON-021 + 065 FR-12)
// Framework: Jest (jest-expo) — rodar em apps/mobile/
//
// NENHUM teste aqui toca rede: o PostHog é mockado e a ausência de chave é justamente o caso
// principal. PO-7 roda offline de propósito — se o wrapper quebrar, nada adiante vale.

const mockCapture = jest.fn()
const mockRegister = jest.fn()
const mockIdentify = jest.fn()
const mockReset = jest.fn()

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: (...a) => mockCapture(...a),
    register: (...a) => mockRegister(...a),
    identify: (...a) => mockIdentify(...a),
    reset: (...a) => mockReset(...a),
  })),
}))

const mockSetUser = jest.fn()
jest.mock('@sentry/react-native', () => ({ setUser: (...a) => mockSetUser(...a) }))

const mockExtra: { appEnv?: string } = {}
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { get expoConfig() { return { extra: mockExtra } } },
}))

// Sem chave: o módulo inteiro vira no-op silencioso (o cenário do PO-7).
jest.mock('@platform/config/nativePublicAppConfig', () => ({
  posthogApiKey: '',
  posthogHost: 'https://us.i.posthog.com',
}))

import { logEvent, setUserId, resetUser, envTags, setMode } from '../productAnalytics'

describe('productAnalytics — sem POSTHOG_API_KEY (PO-7)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    delete mockExtra.appEnv
  })

  it('logEvent é no-op e NÃO lança (CON-021)', async () => {
    await expect(logEvent('dose_logged', { surface: 'push' })).resolves.toBeUndefined()
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('setUserId chama Sentry.setUser MESMO sem PostHog (desacoplamento, RC6 #773)', async () => {
    await setUserId('user-1')

    expect(mockIdentify).not.toHaveBeenCalled()
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'user-1' })
  })

  it('resetUser limpa o Sentry mesmo sem PostHog', async () => {
    await resetUser()

    expect(mockReset).not.toHaveBeenCalled()
    expect(mockSetUser).toHaveBeenCalledWith(null)
  })

  it('setMode não lança sem PostHog', async () => {
    await expect(setMode('simple')).resolves.toBeUndefined()
  })
})

describe('envTags — is_internal (065 FR-12 / plan.md TC-8)', () => {
  beforeEach(() => { delete mockExtra.appEnv })

  it.each([
    ['development', 'true'],
    ['preview', 'true'],
    ['production', 'false'],
  ])('app_env "%s" → is_internal "%s"', (appEnv, expected) => {
    mockExtra.appEnv = appEnv

    expect(envTags()).toEqual({ app_env: appEnv, is_internal: expected })
  })

  // 🔴 O fallback tem de cair para PRODUCTION. Cair para 'development' marcaria todo usuário real
  // de um build sem EXPO_PUBLIC_APP_ENV como interno, tirando-o das métricas filtradas —
  // subcontagem silenciosa com cara de dado limpo (plan.md TC-8).
  it('appEnv AUSENTE → externo (fail-safe), nunca interno', () => {
    expect(envTags()).toEqual({ app_env: 'production', is_internal: 'false' })
  })
})
