// BulkDoseRegisterModal.test.jsx — testes unitários (N1.5)
// Framework: Jest (jest-expo) — rodar em apps/mobile/
//
// NOTA: jest.mock é hoisted pelo Babel — factories não podem referenciar vars externas.
// Usar require() após jest.mock para acessar as funções mock (padrão AP-116/N1.4).

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

// --- Mocks de módulo ---

const MOCK_PROTOCOLS = [
  { id: 'p1', name: 'Protocolo A', dosage_per_intake: 1, medicine: { id: 'm1', name: 'Remédio A' }, treatment_plan: { id: 'plan-1', name: 'Plano Cardio' } },
  { id: 'p2', name: 'Protocolo B', dosage_per_intake: 2, medicine: { id: 'm2', name: 'Remédio B' }, treatment_plan: { id: 'plan-1', name: 'Plano Cardio' } },
  { id: 'p3', name: 'Protocolo C', dosage_per_intake: 1, medicine: { id: 'm3', name: 'Remédio C' }, treatment_plan: { id: 'plan-1', name: 'Plano Cardio' } },
  { id: 'p4', name: 'Protocolo D', dosage_per_intake: 1, medicine: { id: 'm4', name: 'Remédio D' }, treatment_plan: { id: 'plan-1', name: 'Plano Cardio' } },
]

jest.mock('../../hooks/usePlanProtocols', () => ({
  usePlanProtocols: jest.fn(),
}))

jest.mock('../../services/doseService', () => ({
  registerDoseMany: jest.fn(),
}))

// Lucide icons não são necessários para os testes funcionais
jest.mock('lucide-react-native', () => ({
  CheckCircle: 'CheckCircle',
  Circle: 'Circle',
}))

// Acesso às funções mock após hoisting
const { usePlanProtocols } = require('../../hooks/usePlanProtocols')
const { registerDoseMany } = require('../../services/doseService')

import BulkDoseRegisterModal from '../BulkDoseRegisterModal'

const DEFAULT_PROPS = {
  visible: true,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
  mode: 'plan',
  planId: 'plan-1',
  scheduledTime: '08:00',
  treatmentPlanName: 'Plano Cardio',
  userId: 'user-test-123',
}

describe('BulkDoseRegisterModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usePlanProtocols.mockReturnValue({
      protocols: MOCK_PROTOCOLS,
      loading: false,
      error: null,
    })
    registerDoseMany.mockResolvedValue({
      success: true,
      results: [
        { id: 'log-1', success: true },
        { id: 'log-2', success: true },
        { id: 'log-3', success: true },
        { id: 'log-4', success: true },
      ],
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('renderiza 4 medicamentos pré-marcados quando modal está visível', async () => {
    const { getByText } = render(<BulkDoseRegisterModal {...DEFAULT_PROPS} />)

    // Todos os 4 medicamentos devem aparecer
    expect(getByText('Remédio A')).toBeTruthy()
    expect(getByText('Remédio B')).toBeTruthy()
    expect(getByText('Remédio C')).toBeTruthy()
    expect(getByText('Remédio D')).toBeTruthy()

    // CTA deve mostrar 4 doses (todos pré-marcados)
    await waitFor(() => {
      expect(getByText('Registrar 4 doses')).toBeTruthy()
    })
  })

  it('desmarcar 1 medicamento atualiza o CTA para "Registrar 3 doses"', async () => {
    const { getByText } = render(<BulkDoseRegisterModal {...DEFAULT_PROPS} />)

    // Aguardar pré-seleção
    await waitFor(() => {
      expect(getByText('Registrar 4 doses')).toBeTruthy()
    })

    // Desmarcar Remédio A (press no item)
    const itemA = getByText('Remédio A')
    fireEvent.press(itemA)

    await waitFor(() => {
      expect(getByText('Registrar 3 doses')).toBeTruthy()
    })
  })

  it('submit com todos marcados chama registerDoseMany com 4 logs', async () => {
    const { getByText } = render(<BulkDoseRegisterModal {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(getByText('Registrar 4 doses')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(getByText('Registrar 4 doses'))
    })

    await waitFor(() => {
      expect(registerDoseMany).toHaveBeenCalledTimes(1)
      const callArg = registerDoseMany.mock.calls[0][0]
      expect(callArg).toHaveLength(4)
      expect(callArg.map(l => l.protocol_id).sort()).toEqual(['p1', 'p2', 'p3', 'p4'].sort())
    })
  })

  it('submit com 1 desmarcado chama registerDoseMany com 3 logs', async () => {
    const onSuccess = jest.fn()
    registerDoseMany.mockResolvedValue({
      success: true,
      results: [
        { id: 'log-1', success: true },
        { id: 'log-2', success: true },
        { id: 'log-3', success: true },
      ],
    })

    const { getByText } = render(
      <BulkDoseRegisterModal {...DEFAULT_PROPS} onSuccess={onSuccess} />
    )

    await waitFor(() => {
      expect(getByText('Registrar 4 doses')).toBeTruthy()
    })

    // Desmarcar Remédio D
    fireEvent.press(getByText('Remédio D'))

    await waitFor(() => {
      expect(getByText('Registrar 3 doses')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(getByText('Registrar 3 doses'))
    })

    await waitFor(() => {
      expect(registerDoseMany).toHaveBeenCalledTimes(1)
      const callArg = registerDoseMany.mock.calls[0][0]
      expect(callArg).toHaveLength(3)
      expect(callArg.map(l => l.protocol_id)).not.toContain('p4')
      expect(onSuccess).toHaveBeenCalledWith({ successCount: 3 })
    })
  })
})
