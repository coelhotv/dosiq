// spec 054 FR-009 (+ emenda 2026-10-14) — card do alarme crítico com a faixa de estado do aparelho.
import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

const mockStatus = jest.fn()
jest.mock('@platform/alarms/alarmService', () => ({ getCriticalAlarmDeviceStatus: () => mockStatus() }))
const mockEnablePush = jest.fn()
jest.mock('@platform/notifications/pushPermission', () => ({ requestPushOrOpenSettings: (...a: any[]) => mockEnablePush(...a) }))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

import CriticalAlarmCard from '../CriticalAlarmCard'

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS

beforeEach(() => {
  RN.Platform.OS = 'ios'
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('CriticalAlarmCard — faixa por gravidade', () => {
  it('ativo ⇒ "Ativo neste iPhone", sem ação', async () => {
    mockStatus.mockResolvedValue({ kind: 'active' })
    const { findByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    expect(await findByText('Ativo neste iPhone')).toBeTruthy()
  })

  it('bloqueado ⇒ "não vai tocar" e abre Ajustes', async () => {
    mockStatus.mockResolvedValue({ kind: 'blocked' })
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any)
    const { findByText, getByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    fireEvent.press(await findByText('Notificações desligadas'))
    expect(getByText(/não vai tocar/)).toBeTruthy()
    expect(spy).toHaveBeenCalled()
  })

  it('🔴 crítico negado no iOS ⇒ "toca como alarme comum", NUNCA "não vai tocar" (PO-3)', async () => {
    mockStatus.mockResolvedValue({ kind: 'degraded', fix: 'settings' })
    const { findByText, queryByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    expect(await findByText('Alarme crítico desligado em Ajustes')).toBeTruthy()
    expect(queryByText(/não vai tocar/)).toBeNull()
  })

  it('nunca perguntado ⇒ toque abre o pedido (sheet), não os Ajustes', async () => {
    mockStatus.mockResolvedValue({ kind: 'degraded', fix: 'request' })
    const onRequest = jest.fn()
    const spy = jest.spyOn(Linking, 'openSettings')
    const { findByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} onRequestPermission={onRequest} />)
    fireEvent.press(await findByText('Alarme crítico ainda não permitido'))
    expect(onRequest).toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  it('leitura falhou ⇒ sem faixa (não afirma nada)', async () => {
    mockStatus.mockResolvedValue({ kind: 'unknown' })
    const { queryByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    await waitFor(() => expect(mockStatus).toHaveBeenCalled())
    expect(queryByText(/Ativo|desligad/)).toBeNull()
  })

  it('desligado ⇒ sem faixa e sem consultar o SO', () => {
    const { queryByText } = render(<CriticalAlarmCard criticalAlarm={false} onToggle={jest.fn()} />)
    expect(queryByText('Ativo neste iPhone')).toBeNull()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it('Android ativo ⇒ "Ativo neste aparelho"', async () => {
    RN.Platform.OS = 'android'
    mockStatus.mockResolvedValue({ kind: 'active' })
    const { findByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    expect(await findByText('Ativo neste aparelho')).toBeTruthy()
  })

  it('readOnly (detalhe) ⇒ sem toggle, com "Ligado"', async () => {
    mockStatus.mockResolvedValue({ kind: 'active' })
    const { queryByLabelText, getByText, findByText } = render(<CriticalAlarmCard readOnly criticalAlarm />)
    expect(queryByLabelText('Alarme crítico')).toBeNull()
    expect(getByText('Ligado')).toBeTruthy()
    await findByText('Ativo neste iPhone')
  })

  it('toggle chama onToggle', () => {
    const onToggle = jest.fn()
    const { getByLabelText } = render(<CriticalAlarmCard criticalAlarm={false} onToggle={onToggle} />)
    fireEvent(getByLabelText('Alarme crítico'), 'valueChange', true)
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})

// 054 emenda FR-008: variante Android do sheet substitui o guia de tela cheia.
describe('CriticalAlertPrimerSheet — variante android', () => {
  const Sheet = require('../CriticalAlertPrimerSheet').default
  it('mostra o passo extra e "Abrir configurações" chama onContinue', () => {
    const onContinue = jest.fn()
    const { getByText } = render(
      <Sheet visible variant="android" androidMessage="Ligue tela cheia" pushDenied={false} onContinue={onContinue} onDismiss={jest.fn()} />
    )
    expect(getByText('Falta um passo no seu celular')).toBeTruthy()
    expect(getByText('Ligue tela cheia')).toBeTruthy()
    fireEvent.press(getByText('Abrir configurações'))
    expect(onContinue).toHaveBeenCalled()
  })

  it('iOS mantém o texto do alarme crítico e a nota de push negado', () => {
    const { getByText } = render(<Sheet visible pushDenied onContinue={jest.fn()} onDismiss={jest.fn()} />)
    expect(getByText('Alarme que toca mesmo no silencioso')).toBeTruthy()
    expect(getByText(/os lembretes comuns continuam sem chegar/)).toBeTruthy()
  })
})

// 054 C-24: card GLOBAL nas Preferências.
describe('CriticalAlarmCard — scope global (C-24)', () => {
  it('sem toggle, faixa sempre visível', async () => {
    mockStatus.mockResolvedValue({ kind: 'active' })
    const { queryByLabelText, findByText, queryByText } = render(<CriticalAlarmCard scope="global" criticalAlarm />)
    expect(await findByText('Ativo neste iPhone')).toBeTruthy()
    expect(queryByLabelText('Alarme crítico')).toBeNull()
    expect(queryByText('Ligado')).toBeNull()
  })

  it('🔴 push desligado ⇒ aponta para o "Ativar" de cima, SEM botão próprio', async () => {
    mockStatus.mockResolvedValue({ kind: 'blocked', reason: 'push' })
    const spy = jest.spyOn(Linking, 'openSettings')
    const { findByText, queryByRole } = render(<CriticalAlarmCard scope="global" criticalAlarm />)
    fireEvent.press(await findByText('Notificações desligadas'))
    expect(spy).not.toHaveBeenCalled()
    expect(queryByRole('button')).toBeNull()
  })

  it('canal Android silenciado ⇒ atalho para Ajustes', async () => {
    RN.Platform.OS = 'android'
    mockStatus.mockResolvedValue({ kind: 'blocked', reason: 'channel' })
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any)
    const { findByText } = render(<CriticalAlarmCard scope="global" criticalAlarm />)
    fireEvent.press(await findByText('Notificações desligadas'))
    expect(spy).toHaveBeenCalled()
  })

  it('crítico negado ⇒ "ficam mudos no modo silencioso", nunca "toca como alarme comum"', async () => {
    mockStatus.mockResolvedValue({ kind: 'degraded', fix: 'settings' })
    const { findByText, queryByText } = render(<CriticalAlarmCard scope="global" criticalAlarm />)
    expect(await findByText(/ficam mudos no silencioso e no Foco/)).toBeTruthy()
    expect(queryByText(/alarme comum/)).toBeNull()
  })
})

// 054 C-25: canal silenciado no Android.
describe('CriticalAlarmCard — canal silenciado (C-25)', () => {
  it('faixa "Alarme silenciado em Ajustes" com atalho', async () => {
    RN.Platform.OS = 'android'
    mockStatus.mockResolvedValue({ kind: 'degraded', fix: 'settings', reason: 'channel_silenced' })
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any)
    const { findByText, getByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    fireEvent.press(await findByText('Alarme silenciado em Ajustes'))
    expect(getByText(/chega sem som/)).toBeTruthy()
    expect(spy).toHaveBeenCalled()
  })
})

// 054 C-32: canal do alarme sem "Exibir na tela" no Android.
describe('CriticalAlarmCard — canal sem aviso na tela (C-32)', () => {
  it('faixa "Alarme sem aviso na tela" com atalho', async () => {
    RN.Platform.OS = 'android'
    mockStatus.mockResolvedValue({ kind: 'degraded', fix: 'settings', reason: 'channel_no_popup' })
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any)
    const { findByText, getByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    fireEvent.press(await findByText('Alarme sem aviso na tela'))
    expect(getByText(/não aparece na tela/)).toBeTruthy()
    expect(spy).toHaveBeenCalled()
  })
})

// 054 C-33: push não permitido com pedido possível ⇒ o toque pede ao SO (o helper decide Ajustes).
describe('CriticalAlarmCard — push com pedido possível (C-33)', () => {
  it('🔴 toque chama o pedido do SO, não abre Ajustes direto', async () => {
    RN.Platform.OS = 'android'
    mockStatus.mockResolvedValue({ kind: 'blocked', reason: 'push', canRequest: true })
    mockEnablePush.mockResolvedValue(true)
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any)
    const { findByText, getByText } = render(<CriticalAlarmCard criticalAlarm onToggle={jest.fn()} />)
    fireEvent.press(await findByText('Notificações desligadas'))
    await waitFor(() => expect(mockEnablePush).toHaveBeenCalled())
    expect(getByText(/Toque para ativar/)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
