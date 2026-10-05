// orphanEventsPrC1.test.ts — spec 065 PR C1 (US5 / PO-5): órfãos de auth + notificação e
// titulação no catálogo, com `surface` no eixo CANAL e `treatment_id` só do fato (T046a).
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import fs from 'fs'
import path from 'path'

const mockLogEvent = jest.fn()
const mockResetUser = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
  resetUser: (...args) => mockResetUser(...args),
}))

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { signOut: jest.fn(), verifyOtp: jest.fn(), getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn() },
}))

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
}))

jest.mock('@platform/notifications/registerPushToken', () => ({ registerPushToken: jest.fn() }))
jest.mock('@features/treatments/services/titrationRefreshBus', () => ({ triggerTitrationRefresh: jest.fn() }))
jest.mock('@features/treatments/services/titrationService', () => ({
  ...jest.requireActual('@features/treatments/services/titrationService'),
  confirmTitrationSwitch: jest.fn(),
}))

import { supabase } from '@platform/supabase/nativeSupabaseClient'
import * as Notifications from 'expo-notifications'
import { signOut, verifyOtpWithEmail } from '@platform/auth/authService'
import { ensurePushPermission } from '@platform/notifications/pushPermission'
import { handleTitrationNotificationAction, TITRATION_ACTION } from '@platform/notifications/titrationNotificationActions'
import { confirmTitrationSwitch, titrationConfirmedProps, titrationPostponedProps } from '@features/treatments/services/titrationService'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'

const auth = (supabase as any).auth
const notif = Notifications as any
const mockConfirm = confirmTitrationSwitch as jest.Mock

function eventsOf(name) {
  return mockLogEvent.mock.calls.filter(([n]) => n === name).map(([, props]) => props)
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('logout (authService.signOut)', () => {
  // 🔴 Premissa corrigida pelo dado (smoke 26/09): o `supabase.auth.signOut` dispara SIGNED_OUT de
  // DENTRO dele e o listener do Navigation reseta a identidade na hora. "Antes do resetUser do
  // service" não bastava — o evento saía anônimo. O teste agora trava a ordem contra o `signOut`.
  it('emite logout ANTES do supabase.auth.signOut (que reseta a identidade via SIGNED_OUT)', async () => {
    auth.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(eventsOf(EVENTS.LOGOUT)).toEqual([{ surface: SURFACES.MOBILE }])
    expect(mockLogEvent.mock.invocationCallOrder[0]).toBeLessThan(auth.signOut.mock.invocationCallOrder[0])
  })
})

describe('sign_up (verifyOtpWithEmail)', () => {
  it('OTP de cadastro verificado → sign_up{method:email}', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    await verifyOtpWithEmail('a@b.com', '123456', 'signup')
    expect(eventsOf(EVENTS.SIGNUP)).toEqual([{ method: 'email', surface: SURFACES.MOBILE }])
  })

  it('OTP de recuperação NÃO é cadastro', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    await verifyOtpWithEmail('a@b.com', '123456', 'recovery')
    expect(eventsOf(EVENTS.SIGNUP)).toEqual([])
  })

  it('OTP inválido → nenhum sign_up', async () => {
    auth.verifyOtp.mockResolvedValue({ data: null, error: { message: 'Token has expired' } })
    await verifyOtpWithEmail('a@b.com', '123456', 'signup')
    expect(eventsOf(EVENTS.SIGNUP)).toEqual([])
  })
})

describe('permissão de push (ensurePushPermission)', () => {
  it('prompt concedido → granted', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true })
    notif.requestPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true })
    await ensurePushPermission()
    expect(eventsOf(EVENTS.NOTIFICATION_PERMISSION_GRANTED)).toEqual([{ surface: SURFACES.MOBILE }])
  })

  it('prompt negado → denied', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true })
    notif.requestPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false })
    await ensurePushPermission()
    expect(eventsOf(EVENTS.NOTIFICATION_PERMISSION_DENIED)).toEqual([{ surface: SURFACES.MOBILE }])
  })

  it('já concedido ou negado sem repedir → sem prompt, sem evento', async () => {
    notif.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted', canAskAgain: true })
    await ensurePushPermission()
    notif.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied', canAskAgain: false })
    await ensurePushPermission()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

describe('titrationConfirmedProps (R-299 §4 — id certo ou ausente)', () => {
  it('confirmação nova com protocolo → treatment_id da RPC', () => {
    expect(
      titrationConfirmedProps({ ok: true, alreadyConfirmed: false, transition: 'dose_change', protocolActivated: 'p-9', protocolPaused: null })
    ).toEqual({ outcome: 'confirmed', treatment_id: 'p-9' })
  })

  it('already_confirmed (RPC não devolve protocolo) → sem treatment_id', () => {
    expect(
      titrationConfirmedProps({ ok: true, alreadyConfirmed: true, transition: null, protocolActivated: null, protocolPaused: null })
    ).toEqual({ outcome: 'already_confirmed' })
  })

  it('recusa → só reason', () => {
    expect(titrationConfirmedProps({ ok: false, reason: 'nao_pendente', message: 'x' })).toEqual({ outcome: 'nao_pendente' })
  })

  it('confirmação sem executor (protocol_activated null) → sem treatment_id', () => {
    expect(
      titrationConfirmedProps({ ok: true, alreadyConfirmed: false, transition: 'dose_change', protocolActivated: null, protocolPaused: null })
    ).toEqual({ outcome: 'confirmed' })
  })
})

describe('ação da titulação no push', () => {
  const response = (actionId) => ({
    actionIdentifier: actionId,
    notification: { request: { content: { data: { actions: [{ id: actionId, params: { stepId: 's-1' } }] } } } },
  })

  it('Iniciar etapa → confirmed com surface push e treatment_id do fato', async () => {
    mockConfirm.mockResolvedValue({ ok: true, alreadyConfirmed: false, transition: 'x', protocolActivated: 'p-1', protocolPaused: null })
    await handleTitrationNotificationAction(response(TITRATION_ACTION.START_STEP))
    expect(eventsOf(EVENTS.TITRATION_TRANSITION_CONFIRMED)).toEqual([
      { step_id: 's-1', surface: SURFACES.PUSH, outcome: 'confirmed', treatment_id: 'p-1' },
    ])
  })

  it('Ainda não → postponed sem treatment_id', async () => {
    await handleTitrationNotificationAction(response(TITRATION_ACTION.NOT_YET))
    expect(eventsOf(EVENTS.TITRATION_TRANSITION_POSTPONED)).toEqual([{ step_id: 's-1', surface: SURFACES.PUSH }])
  })

  it('Ainda não sem stepId no payload → step_id omitido, nunca string vazia (092 E-5)', async () => {
    await handleTitrationNotificationAction({
      actionIdentifier: TITRATION_ACTION.NOT_YET,
      notification: { request: { content: { data: {} } } },
    })
    expect(eventsOf(EVENTS.TITRATION_TRANSITION_POSTPONED)).toEqual([{ surface: SURFACES.PUSH }])
  })
})

// 092 FR-005 / PO-4 — o card do Hoje adia com a etapa pendente em mãos.
describe('titrationPostponedProps (INV-2/INV-3)', () => {
  it('etapa com tratamento → treatment_id = protocol_id da etapa', () => {
    expect(titrationPostponedProps({ stepId: 's-2', treatmentId: 'p-9' })).toEqual({ step_id: 's-2', treatment_id: 'p-9' })
  })

  it('etapa futura de medicine_switch sem tratamento → chave omitida', () => {
    expect(titrationPostponedProps({ stepId: 's-2', treatmentId: null })).toEqual({ step_id: 's-2' })
    expect(titrationPostponedProps({ stepId: 's-2' })).toEqual({ step_id: 's-2' })
  })

  it('sem stepId → nada de string vazia', () => {
    expect(titrationPostponedProps({ stepId: '', treatmentId: '' })).toEqual({})
  })
})

// T046a (3): o ponto de toque NÃO volta para `surface`. Estático de propósito: os emissores de tela
// (card do Hoje, banner da timeline) não são renderizáveis aqui sem montar a árvore inteira.
describe('surface fica no eixo CANAL', () => {
  const ROOT = path.resolve(__dirname, '../../..')
  const EMITTERS = [
    'features/dashboard/components/EvolutionSwitchSection.tsx',
    'features/treatments/screens/ProtocolDetailScreen.tsx',
    'platform/notifications/titrationNotificationActions.ts',
  ]

  it.each(EMITTERS)('%s não usa string literal em surface nem nome de evento literal', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    expect(src).not.toMatch(/surface:\s*['"]/)
    expect(src).not.toMatch(/logEvent\(\s*['"]/)
  })

  it('SURFACES continua só com canais', () => {
    expect(Object.values(SURFACES).sort()).toEqual(['alarm', 'mobile', 'push'])
  })
})
