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
