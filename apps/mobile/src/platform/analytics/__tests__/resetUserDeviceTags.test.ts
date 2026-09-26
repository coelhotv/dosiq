// resetUserDeviceTags.test.ts — regressão do smoke do 065 C1 (26/09, visto no PostHog).
//
// `posthog.reset()` apaga TODAS as super properties. Depois de sair e entrar de novo, os eventos
// até o próximo cold start saíam sem `app_env`/`is_internal`/bundle: o boot registra uma vez só
// (AppRoot) e ninguém re-registrava. Tags do APARELHO não são da pessoa e sobrevivem ao reset.
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const calls: string[] = []
const mockRegister = jest.fn((..._a: unknown[]) => { calls.push('register') })
const mockReset = jest.fn((..._a: unknown[]) => { calls.push('reset') })
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: jest.fn(), identify: jest.fn(),
    reset: (...a) => mockReset(...a),
    register: (...a) => mockRegister(...a),
  })),
}))
jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { appEnv: 'development' } } } }))
jest.mock('@platform/config/nativePublicAppConfig', () => ({
  posthogApiKey: 'phc_teste',
  posthogHost: 'https://us.i.posthog.com',
}))
jest.mock('@platform/updates/bundleInfo', () => ({
  bundleTags: () => ({ update_id: 'embedded', channel: 'none', runtime_version: '0.33.3' }),
}))

import { resetUser } from '../productAnalytics'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  calls.length = 0
})

describe('resetUser — tags do aparelho sobrevivem ao reset', () => {
  it('re-registra app_env/is_internal/bundle DEPOIS do reset', async () => {
    await resetUser()
    expect(calls).toEqual(['reset', 'register'])
    expect(mockRegister).toHaveBeenCalledWith({
      update_id: 'embedded',
      channel: 'none',
      runtime_version: '0.33.3',
      app_env: 'development',
      is_internal: 'true',
    })
  })

  it('não re-registra `mode` (é da pessoa — volta com o perfil)', async () => {
    await resetUser()
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty('mode')
  })
})
