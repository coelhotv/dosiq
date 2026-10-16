// spec 054 FR-008b / C-12 — fluxo do toggle por estado de Critical Alerts e do push (S4/S5/S6).
import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

const mockSetting = jest.fn()
const mockRequestCritical = jest.fn()
jest.mock('@platform/alarms/alarmService', () => ({
  getCriticalAlertSetting: () => mockSetting(),
  requestCriticalAlertPermission: () => mockRequestCritical(),
}))
const mockEnablePush = jest.fn()
const mockPushStatus = jest.fn()
jest.mock('@platform/notifications/pushPermission', () => ({
  enablePushAtIntent: (...a: any[]) => mockEnablePush(...a),
  getPushPermissionStatus: () => mockPushStatus(),
}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
const mockResync = jest.fn()
jest.mock('@platform/alarms/alarmResyncBus', () => ({ triggerAlarmResync: () => mockResync() }))

import { useCriticalAlarmToggle } from '../useCriticalAlarmToggle'

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS

function setup() {
  const setCritical = jest.fn()
  const onEnabledAndroid = jest.fn()
  const { result } = renderHook(() => useCriticalAlarmToggle({ setCritical, onEnabledAndroid }))
  return { result, setCritical, onEnabledAndroid }
}

beforeEach(() => {
  RN.Platform.OS = 'ios'
  mockEnablePush.mockResolvedValue({ granted: true, blocked: false })
  mockPushStatus.mockResolvedValue({ status: 'granted' })
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('useCriticalAlarmToggle — iOS', () => {
  it('crítico NÃO perguntado ⇒ abre o sheet ANTES de qualquer diálogo do SO', async () => {
    mockSetting.mockResolvedValue('undetermined')
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    expect(result.current.primerVisible).toBe(true)
    expect(mockRequestCritical).not.toHaveBeenCalled()
    expect(mockEnablePush).not.toHaveBeenCalled()
    expect(setCritical).not.toHaveBeenCalled()
  })

  it('sheet com push negado ⇒ pushDenied true (nota de lembretes)', async () => {
    mockSetting.mockResolvedValue('undetermined')
    mockPushStatus.mockResolvedValue({ status: 'denied' })
    const { result } = setup()
    await act(() => result.current.onToggle(true))
    expect(result.current.pushDenied).toBe(true)
  })

  it('Continuar + crítico concedido ⇒ liga, resync, mesmo com push negado (S6)', async () => {
    mockSetting.mockResolvedValue('undetermined')
    mockRequestCritical.mockResolvedValue(true)
    mockEnablePush.mockResolvedValue({ granted: false, blocked: true })
    const alertSpy = jest.spyOn(Alert, 'alert')
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    await act(() => result.current.onPrimerContinue())
    expect(result.current.primerVisible).toBe(false)
    expect(setCritical).toHaveBeenCalledWith(true)
    expect(mockResync).toHaveBeenCalledTimes(1)
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('Continuar + crítico negado + push ok ⇒ liga em modo normal', async () => {
    mockSetting.mockResolvedValue('undetermined')
    mockRequestCritical.mockResolvedValue(false)
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    await act(() => result.current.onPrimerContinue())
    expect(setCritical).toHaveBeenCalledWith(true)
    expect(mockResync).not.toHaveBeenCalled()
  })

  it('Continuar + crítico negado + push bloqueado ⇒ NÃO liga e mostra o aviso', async () => {
    mockSetting.mockResolvedValue('undetermined')
    mockRequestCritical.mockResolvedValue(false)
    mockEnablePush.mockResolvedValue({ granted: false, blocked: true })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    await act(() => result.current.onPrimerContinue())
    expect(setCritical).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledTimes(1)
  })

  it('Agora não ⇒ fecha sem pedir nada e o toggle fica desligado', async () => {
    mockSetting.mockResolvedValue('undetermined')
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    act(() => result.current.onPrimerDismiss())
    expect(result.current.primerVisible).toBe(false)
    expect(mockRequestCritical).not.toHaveBeenCalled()
    expect(setCritical).not.toHaveBeenCalled()
  })

  it('crítico já autorizado ⇒ liga sem sheet', async () => {
    mockSetting.mockResolvedValue('authorized')
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    expect(result.current.primerVisible).toBe(false)
    expect(setCritical).toHaveBeenCalledWith(true)
  })

  it('crítico negado ⇒ modo normal, sem sheet e sem pedir o crítico (PO-3)', async () => {
    mockSetting.mockResolvedValue('denied')
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    expect(result.current.primerVisible).toBe(false)
    expect(mockRequestCritical).not.toHaveBeenCalled()
    expect(setCritical).toHaveBeenCalledWith(true)
  })

  it('desligar ⇒ grava false sem consultar nada', async () => {
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(false))
    expect(setCritical).toHaveBeenCalledWith(false)
    expect(mockSetting).not.toHaveBeenCalled()
  })
})

describe('useCriticalAlarmToggle — Android (FR-008 intacto)', () => {
  it('push ok ⇒ guia de tela cheia + liga; nunca consulta o crítico', async () => {
    RN.Platform.OS = 'android'
    const { result, setCritical, onEnabledAndroid } = setup()
    await act(() => result.current.onToggle(true))
    expect(onEnabledAndroid).toHaveBeenCalled()
    expect(setCritical).toHaveBeenCalledWith(true)
    expect(mockSetting).not.toHaveBeenCalled()
  })

  it('push negado ⇒ não liga', async () => {
    RN.Platform.OS = 'android'
    mockEnablePush.mockResolvedValue({ granted: false, blocked: false })
    const { result, setCritical } = setup()
    await act(() => result.current.onToggle(true))
    expect(setCritical).not.toHaveBeenCalled()
  })
})
