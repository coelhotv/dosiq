// setMode.test.ts — regressão do finding MEDIUM do RC6 (run 2, PR #829).
//
// `complexity_override` existe SOMENTE em `user_settings` (verificado no banco — R-295). O primeiro
// código lia do objeto de PERFIL (`profiles`), onde a coluna não existe: devolvia `undefined`
// sempre e o evento saía com `mode: 'auto'` em 100% dos casos. Passou pelo smoke em aparelho
// justamente porque `auto` é TAMBÉM o valor legítimo de quem nunca escolheu — o dado de campo não
// conseguia distinguir o certo do errado. Este teste faz a distinção que faltava.
//
// Arquivo separado do productAnalytics.test.ts de propósito: lá o `posthogApiKey` é vazio (o
// cenário do PO-7, no-op offline); aqui ele precisa existir para o `register` ser observável.

const mockRegister = jest.fn()
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: jest.fn(), identify: jest.fn(), reset: jest.fn(),
    register: (...a) => mockRegister(...a),
  })),
}))
jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }))
jest.mock('@platform/config/nativePublicAppConfig', () => ({
  posthogApiKey: 'phc_teste',
  posthogHost: 'https://us.i.posthog.com',
}))

import { setMode } from '../productAnalytics'

describe('setMode — super property `mode`', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it.each([
    ['simple', 'simple'],
    ['complex', 'complex'],
  ])('escolha explícita "%s" viaja como está', async (override, esperado) => {
    await setMode(override)

    expect(mockRegister).toHaveBeenCalledWith({ mode: esperado })
  })

  it.each([[null], [undefined], ['']])('sem escolha (%s) vira "auto", nunca null nem string vazia', async (override) => {
    await setMode(override as any)

    expect(mockRegister).toHaveBeenCalledWith({ mode: 'auto' })
  })
})
