// DoseRegisterModal — quantidade padrão (spec 090, smoke 28/09 23:16).
//
// O campo nasce vazio com a dose do tratamento só como PLACEHOLDER. Confirmar sem digitar tem de
// registrar a dose do tratamento: `quantity` começa '' e `'' ?? defaultQty` NÃO cai no default
// (`??` só pula null/undefined) — parseFloat('') = NaN ⇒ "Quantidade deve ser maior que zero."

import { describe, it, expect, afterEach } from '@jest/globals'
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../../services/doseService', () => ({
  registerDose: jest.fn(),
  getLastInjectionSite: jest.fn(),
}))
jest.mock('@shared/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }))
jest.mock('lucide-react-native', () => ({ AlertTriangle: 'AlertTriangle' }))

const { registerDose } = require('../../services/doseService')

import DoseRegisterModal from '../DoseRegisterModal'

const PROTOCOL = {
  id: 'p1',
  medicine_id: 'm1',
  dosage_per_intake: 2,
  intake_unit: null,
  medicine: { id: 'm1', name: 'Stima', presentation: 'comprimido', dosage_per_pill: 10, dosage_unit: 'mg' },
}

const renderModal = () =>
  render(
    <DoseRegisterModal visible protocol={PROTOCOL} scheduledTime="23:10" medicineName="Stima" onClose={jest.fn()} onSuccess={jest.fn()} />
  )

describe('DoseRegisterModal — quantidade', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('🔴 Confirmar sem digitar registra a dose do tratamento', async () => {
    jest.mocked(registerDose).mockResolvedValue({ success: true, data: {} } as any)
    const { getByText, queryByText } = renderModal()
    fireEvent.press(getByText('Confirmar'))
    await waitFor(() => expect(registerDose).toHaveBeenCalled())
    expect(jest.mocked(registerDose).mock.calls[0][0]).toMatchObject({ protocol_id: 'p1', quantity_taken: 2 })
    expect(queryByText('Quantidade deve ser maior que zero.')).toBeNull()
  })

  it('quantidade digitada vale sobre a do tratamento', async () => {
    jest.mocked(registerDose).mockResolvedValue({ success: true, data: {} } as any)
    const { getByText, getByPlaceholderText } = renderModal()
    fireEvent.changeText(getByPlaceholderText('2'), '1,5')
    fireEvent.press(getByText('Confirmar'))
    await waitFor(() => expect(registerDose).toHaveBeenCalled())
    expect(jest.mocked(registerDose).mock.calls[0][0]).toMatchObject({ quantity_taken: 1.5 })
  })
})

// 069 A1 — caracterização: congela o contrato ATUAL de saída do modal antes do passo 2 (A2).
describe('DoseRegisterModal — caracterização (069 A1)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  const renderWith = (onSuccess = jest.fn(), onClose = jest.fn()) => ({
    onSuccess,
    onClose,
    ...render(
      <DoseRegisterModal visible protocol={PROTOCOL} scheduledTime="08:00" medicineName="Stima" onClose={onClose} onSuccess={onSuccess} />
    ),
  })

  it('renderiza título, medicamento e horário', () => {
    const { getByText } = renderWith()
    expect(getByText('Tomar dose')).toBeTruthy()
    expect(getByText('Stima')).toBeTruthy()
    expect(getByText('08:00')).toBeTruthy()
  })

  it('confirmar com sucesso chama onSuccess 1× e não chama onClose', async () => {
    jest.mocked(registerDose).mockResolvedValue({ success: true, data: {} } as any)
    const { getByText, onSuccess, onClose } = renderWith()
    fireEvent.press(getByText('Confirmar'))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('erro do registerDose aparece no modal e onSuccess não é chamado', async () => {
    jest.mocked(registerDose).mockResolvedValue({ success: false, error: 'Falha ao registrar dose' } as any)
    const { getByText, findByText, onSuccess } = renderWith()
    fireEvent.press(getByText('Confirmar'))
    expect(await findByText('Falha ao registrar dose')).toBeTruthy()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('Cancelar chama onClose sem registrar', () => {
    const { getByText, onClose } = renderWith()
    fireEvent.press(getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(registerDose).not.toHaveBeenCalled()
  })
})
