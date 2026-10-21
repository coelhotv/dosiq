// OnboardingConsentStep.test.tsx — S1 (spec 096 B3, T040b / PO-UX-2).
// Nada é gravado antes do A; B nunca é condição; "Pular" cai na variante sem dado.

import React from 'react'
import { render, fireEvent, act, screen } from '@testing-library/react-native'
import { HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'
import OnboardingConsentStep from '../screens/OnboardingConsentStep'
import { OnboardingContext } from '../OnboardingContext'
import { ONBOARDING_CONSENT_COPY as COPY, ONBOARDING_REFUSE_COPY } from '../onboardingConsentCopy'

const mockNav = { navigate: jest.fn(), goBack: jest.fn() }
let mockParams: any = {}
const mockShow = jest.fn()
const mockGrantV04 = jest.fn()
const mockEndSession = jest.fn((..._a: any[]) => Promise.resolve())
const mockPush = jest.fn(() => Promise.resolve({ granted: true }))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }))
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
jest.mock('@shared/hooks/useStockTracking', () => ({ useStockTracking: () => ({ refresh: () => Promise.resolve() }) }))
jest.mock('@platform/consent/useConsentGate', () => ({ useConsentGate: () => ({ grantV04: mockGrantV04 }) }))
jest.mock('@platform/notifications/pushPermission', () => ({ enablePushAtIntent: () => mockPush() }))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('@platform/session/endSession', () => ({ endSession: (...a: any[]) => mockEndSession(...a) }))
jest.mock('@profile/services/stockPreferenceService', () => ({ chooseStockModeInOnboarding: jest.fn() }))
jest.mock('@treatments/services/protocolService', () => ({ protocolService: { create: jest.fn() } }))
jest.mock('@medications/services/medicineService', () => ({ medicineService: { create: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return { SafeAreaView: View, SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }
})

function renderStep(overrides = {}) {
  const ctx = {
    medicine: { name: 'Losartana', dosage_per_pill: '50', dosage_unit: 'mg' },
    medicineSource: 'manual',
    treatment: { dosage_per_intake: 1, time_schedule: ['08:00'], _remind: true },
    stockTracking: false,
    writeSetup: jest.fn(() => Promise.resolve({ remind: true })),
    finish: jest.fn(() => Promise.resolve()),
    markCompleted: jest.fn(() => Promise.resolve()),
    ...overrides,
  }
  render(
    <OnboardingContext.Provider value={ctx as any}>
      <OnboardingConsentStep />
    </OnboardingContext.Provider>,
  )
  return ctx
}

async function press(label: string) {
  await act(async () => { fireEvent.press(screen.queryByLabelText(label) ?? screen.getByText(label)) })
}

beforeEach(() => {
  mockParams = {}
  mockGrantV04.mockResolvedValue({ ok: true, transferOk: true })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('OnboardingConsentStep (S1)', () => {
  it('caixas A e B desmarcadas; resumo do remédio', () => {
    renderStep()
    expect(screen.getByText(COPY.title)).toBeTruthy()
    expect(screen.getByText('Losartana 50 mg')).toBeTruthy()
    expect(screen.getByLabelText(HEALTH_CONSENT_COPY.label).props.accessibilityState.checked).toBe(false)
    expect(screen.getByLabelText(TRANSFER_CONSENT_COPY.label).props.accessibilityState.checked).toBe(false)
  })

  it('sem A ⇒ erro, 0 grant e 0 escrita (PO-UX-2)', async () => {
    const ctx = renderStep()
    await press(COPY.cta)
    expect(screen.getByText(COPY.errorNoHealth)).toBeTruthy()
    expect(mockGrantV04).not.toHaveBeenCalled()
    expect(ctx.writeSetup).not.toHaveBeenCalled()
  })

  it('só A ⇒ grava (B não é condição) e conclui', async () => {
    const ctx = renderStep()
    await press(HEALTH_CONSENT_COPY.label)
    await press(COPY.cta)
    expect(mockGrantV04).toHaveBeenCalledWith({ transfer: false })
    expect(ctx.writeSetup).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalled()
    expect(ctx.finish).toHaveBeenCalled()
  })

  it('A grant falha ⇒ 0 escrita, erro visível', async () => {
    mockGrantV04.mockResolvedValue({ ok: false, transferOk: false })
    const ctx = renderStep()
    await press(HEALTH_CONSENT_COPY.label)
    await press(COPY.cta)
    expect(ctx.writeSetup).not.toHaveBeenCalled()
    expect(screen.getByText(COPY.grantError)).toBeTruthy()
  })

  it('B falha ⇒ aviso, mas segue gravando', async () => {
    mockGrantV04.mockResolvedValue({ ok: true, transferOk: false })
    const ctx = renderStep()
    await press(HEALTH_CONSENT_COPY.label)
    await press(TRANSFER_CONSENT_COPY.label)
    await press(COPY.cta)
    expect(mockShow).toHaveBeenCalledWith(COPY.transferNotSaved, expect.anything())
    expect(ctx.writeSetup).toHaveBeenCalled()
  })

  it('escrita falha ⇒ fica no S1 com o erro', async () => {
    const ctx = renderStep({ writeSetup: jest.fn(() => Promise.reject(new Error('Erro de rede'))) })
    await press(HEALTH_CONSENT_COPY.label)
    await press(COPY.cta)
    expect(screen.getByText('Erro de rede')).toBeTruthy()
    expect(ctx.finish).not.toHaveBeenCalled()
  })

  it('opção 2 de estoque ⇒ marca conclusão e vai ao saldo', async () => {
    const ctx = renderStep({ stockTracking: true })
    await press(HEALTH_CONSENT_COPY.label)
    await press(COPY.cta)
    expect(ctx.markCompleted).toHaveBeenCalled()
    expect(mockNav.navigate).toHaveBeenCalledWith('OnboardingStockInitialBalance')
  })

  it('variante empty ("Pular") ⇒ sem escrita de remédio, conclui', async () => {
    mockParams = { variant: 'empty' }
    const ctx = renderStep()
    expect(screen.getByText(COPY.emptyTitle)).toBeTruthy()
    await press(HEALTH_CONSENT_COPY.label)
    await press(COPY.emptyCta)
    expect(ctx.writeSetup).not.toHaveBeenCalled()
    expect(ctx.finish).toHaveBeenCalled()
  })

  it('Agora não ⇒ S2; Descartar encerra a sessão; Excluir vai à exclusão', async () => {
    renderStep()
    await press(COPY.later)
    expect(screen.getByText(ONBOARDING_REFUSE_COPY.title)).toBeTruthy()
    await press(ONBOARDING_REFUSE_COPY.discard)
    expect(mockEndSession).toHaveBeenCalledWith('logout')
    await press(ONBOARDING_REFUSE_COPY.delete)
    expect(mockNav.navigate).toHaveBeenCalledWith('DeleteAccount')
  })
})
