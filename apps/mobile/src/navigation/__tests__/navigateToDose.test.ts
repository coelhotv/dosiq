// navigateToDose.test.ts — spec 090 D-2/D-3 (PO-4, PO-5) · RC-SEC S3 (PO-SEC-3)
//
// 🔴 O que fica vermelho se o bug voltar: navegar para `Hoje` direto do root (o RootStack não tem
// essa rota — é o `was not handled` do logcat), navegar antes de `TABS` existir, ou repassar params
// crus de uma notificação.

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()
let mockReady = true
let mockRouteNames: string[] | undefined = ['Tabs', 'AlarmFullScreen']
// Stack do root (routes/index). Default: só TABS aberto.
let mockStack: string[] = ['Tabs']
// Aba focada dentro de TABS (undefined = abas sem estado ainda ⇒ 1ª aba, o Hoje).
let mockFocusedTab: string | undefined = 'Tratamentos'
jest.mock('@navigation/navigationRef', () => ({
  navigationRef: {
    navigate: (...a: unknown[]) => mockNavigate(...a),
    dispatch: (...a: unknown[]) => mockDispatch(...a),
    isReady: () => mockReady,
    getRootState: () => (mockRouteNames
      ? { routeNames: mockRouteNames, routes: mockStack.map((name) => (name === 'Tabs' && mockFocusedTab
        ? { name, state: { index: 0, routes: [{ name: mockFocusedTab }] } }
        : { name })), index: mockStack.length - 1 }
      : undefined),
  },
}))

import { buildDoseParams, navigateToDose, navigateToHistory, navigateToPrivacyData, subscribePendingDose } from '../navigateToDose'
import { ROUTES } from '../routes'

const PROTO = '2b1c3f5e-8a4d-4e6b-9c7a-1d2e3f4a5b6c'
const PLAN = '7f6e5d4c-3b2a-4190-8877-665544332211'

describe('buildDoseParams (PO-SEC-3)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it.each([
    ['dose-individual', { screen: 'dose-individual', protocolId: PROTO, at: '08:00' }, { screen: 'dose-individual', protocolId: PROTO, at: '08:00' }],
    ['bulk-plan', { screen: 'bulk-plan', planId: PLAN, at: '', treatmentPlanName: 'Manhã' }, { screen: 'bulk-plan', planId: PLAN, treatmentPlanName: 'Manhã' }],
    ['bulk-misc', { screen: 'bulk-misc', protocolIds: [PROTO], at: '14:30' }, { screen: 'bulk-misc', protocolIds: [PROTO], at: '14:30' }],
    ['bulk-misc sem lista', { screen: 'bulk-misc' }, { screen: 'bulk-misc', protocolIds: [] }],
  ])('aceita %s bem formado', (_n, input, expected) => {
    expect(buildDoseParams(input)).toEqual(expected)
  })

  it.each([
    ['screen fora da allowlist', { screen: 'privacy-data', protocolId: PROTO }],
    ['screen de outra rota', { screen: 'DeleteAccount' }],
    ['protocolId não-UUID', { screen: 'dose-individual', protocolId: "1' OR 1=1" }],
    ['planId ausente', { screen: 'bulk-plan', at: '08:00' }],
    ['protocolIds com item inválido', { screen: 'bulk-misc', protocolIds: [PROTO, 'x'] }],
    ['protocolIds não-array', { screen: 'bulk-misc', protocolIds: PROTO }],
    ['at malformado', { screen: 'dose-individual', protocolId: PROTO, at: '25:99' }],
    ['payload nulo', null],
    ['payload string', 'dose-individual'],
  ])('recusa %s', (_n, input) => {
    expect(buildDoseParams(input)).toBeNull()
  })

  it('não repassa campos extras do payload', () => {
    const out = buildDoseParams({ screen: 'dose-individual', protocolId: PROTO, redirect: 'evil://x' })
    expect(out).toEqual({ screen: 'dose-individual', protocolId: PROTO })
  })

  it('trunca nome de plano longo', () => {
    const out = buildDoseParams({ screen: 'bulk-plan', planId: PLAN, treatmentPlanName: 'a'.repeat(500) }) as any
    expect(out.treatmentPlanName).toHaveLength(120)
  })
})

describe('navigateToDose (PO-4, PO-5)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockReady = true
    mockRouteNames = ['Tabs', 'AlarmFullScreen']
  })
  afterEach(() => {
    subscribePendingDose(() => {})()
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('navega ANINHADO a partir do root (TABS → Hoje), nunca direto para Hoje — sem params', () => {
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO, at: '08:00' })
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    // a dose NÃO vai nos params aninhados (perdiam-se no cold start); vai pelo canal assinado
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TABS, { screen: ROUTES.TODAY })
    expect(mockNavigate).not.toHaveBeenCalledWith(ROUTES.TODAY, expect.anything())
  })

  // 🔴 Smoke 28/09: com `navigate`, a modal abria POR CIMA do alarme (React Navigation 7 não volta
  // para rota já no stack). Alarme por cima ⇒ popTo(TABS) com os params aninhados, nunca navigate.
  it('alarme em tela cheia por cima de TABS ⇒ popTo(TABS) entrega a dose e tira o alarme', () => {
    mockStack = ['Tabs', 'AlarmFullScreen']
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO, at: '19:30' })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'POP_TO',
      payload: expect.objectContaining({
        name: ROUTES.TABS,
        params: { screen: ROUTES.TODAY },
      }),
    }))
    mockStack = ['Tabs']
  })

  // 🔴 Smoke 28/09 (cold start): navegar para o Hoje JÁ focado apagava a dose recém-entregue
  // (React Navigation 7 substitui params no navigate). Hoje focado e nada por cima ⇒ não navega.
  it('Hoje já focado e nada por cima ⇒ não navega (entrega só pelo canal)', () => {
    mockFocusedTab = 'Hoje'
    const got = jest.fn()
    const off = subscribePendingDose(got)
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(got).toHaveBeenCalledTimes(1)
    off()
    mockFocusedTab = 'Tratamentos'
  })

  it('abas recém-montadas sem estado (1ª aba = Hoje) ⇒ não navega', () => {
    mockFocusedTab = undefined
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO })
    expect(mockNavigate).not.toHaveBeenCalled()
    mockFocusedTab = 'Tratamentos'
  })

  it('navega ANTES de entregar (a entrega é a última escrita nos params do Hoje)', () => {
    const order: string[] = []
    mockNavigate.mockImplementation(() => order.push('navigate'))
    const off = subscribePendingDose(() => order.push('deliver'))
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO })
    expect(order).toEqual(['navigate', 'deliver'])
    off()
    mockNavigate.mockReset()
  })

  it('payload inválido ⇒ Hoje sem modal (navega, nada entregue)', () => {
    const got = jest.fn()
    const off = subscribePendingDose(got)
    navigateToDose({ screen: 'dose-individual', protocolId: 'nao-uuid' })
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TABS, { screen: ROUTES.TODAY })
    expect(got).not.toHaveBeenCalled()
    off()
  })

  it('container montado mas SEM TABS (consentimento/onboarding) ⇒ espera; navega quando TABS aparece', () => {
    mockRouteNames = ['ConsentResolution', 'PrivacyData']
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO })
    expect(mockNavigate).not.toHaveBeenCalled()
    jest.advanceTimersByTime(300)
    expect(mockNavigate).not.toHaveBeenCalled()
    mockRouteNames = ['Tabs']
    jest.advanceTimersByTime(100)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('cold start: container não pronto ⇒ espera isReady', () => {
    mockReady = false
    navigateToDose({ screen: 'bulk-plan', planId: PLAN })
    jest.advanceTimersByTime(500)
    expect(mockNavigate).not.toHaveBeenCalled()
    mockReady = true
    jest.advanceTimersByTime(100)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('TABS nunca aparece ⇒ desiste em 5 s sem lançar nem navegar', () => {
    mockRouteNames = ['Onboarding']
    expect(() => navigateToDose({ screen: 'dose-individual', protocolId: PROTO })).not.toThrow()
    jest.advanceTimersByTime(6000)
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  it('root state indefinido ⇒ trata como não montado', () => {
    mockRouteNames = undefined
    navigateToDose({ screen: 'dose-individual', protocolId: PROTO })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('navigateToHistory (C1.5 G-2)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('TABS → Perfil → DoseHistory, mantendo a raiz do Perfil embaixo', () => {
    mockReady = true
    mockRouteNames = ['Tabs']
    navigateToHistory()
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TABS, {
      screen: ROUTES.PROFILE,
      params: { screen: ROUTES.DOSE_HISTORY, initial: false },
    })
  })
})

describe('navigateToPrivacyData (C1.5 G-2)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('árvore de consentimento travado (rota no root) → navega direto', () => {
    mockReady = true
    mockRouteNames = ['ConsentResolution', 'PrivacyData']
    navigateToPrivacyData()
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.PRIVACY_DATA)
  })

  it('app normal → TABS → Perfil → PrivacyData', () => {
    mockReady = true
    mockRouteNames = ['Tabs']
    navigateToPrivacyData()
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TABS, {
      screen: ROUTES.PROFILE,
      params: { screen: ROUTES.PRIVACY_DATA, initial: false },
    })
  })
})

// 090 smoke 28/09 (PO-5, cold start real): params aninhados se perdiam — abas montando 8,5 s depois
// do toque (retry desistia) ou navegador de abas inicializando quando o navigate chegava. A entrega
// agora é por canal assinado pelo Hoje, independente do tempo de montagem.
describe('entrega da dose ao Hoje (PO-5)', () => {
  const DOSE = { screen: 'dose-individual', protocolId: PROTO, at: '20:10' }
  beforeEach(() => {
    jest.useFakeTimers()
    mockReady = true
    mockStack = ['Tabs']
  })
  afterEach(() => {
    subscribePendingDose(() => {})() // drena pendência e solta o listener entre testes
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('Hoje já montado ⇒ recebe a dose na hora', () => {
    const got = jest.fn()
    const off = subscribePendingDose(got)
    navigateToDose(DOSE)
    expect(got).toHaveBeenCalledWith(DOSE)
    off()
  })

  it('Hoje monta DEPOIS (mesmo além dos 5 s do retry) ⇒ recebe ao assinar', () => {
    mockRouteNames = ['Loading']
    navigateToDose(DOSE)
    jest.advanceTimersByTime(8500)
    const got = jest.fn()
    const off = subscribePendingDose(got)
    expect(got).toHaveBeenCalledWith(DOSE)
    off()
    mockRouteNames = ['Tabs']
  })

  it('entrega uma vez só (sem modal dupla)', () => {
    navigateToDose(DOSE)
    const a = jest.fn()
    subscribePendingDose(a)()
    const b = jest.fn()
    subscribePendingDose(b)()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('pendência vence em 60 s', () => {
    navigateToDose(DOSE)
    jest.advanceTimersByTime(61_000)
    const got = jest.fn()
    subscribePendingDose(got)()
    expect(got).not.toHaveBeenCalled()
  })

  it('assinatura cancelada não recebe; a dose fica para o próximo assinante', () => {
    const old = jest.fn()
    subscribePendingDose(old)()
    navigateToDose(DOSE)
    expect(old).not.toHaveBeenCalled()
    const next = jest.fn()
    subscribePendingDose(next)()
    expect(next).toHaveBeenCalledWith(DOSE)
  })
})
