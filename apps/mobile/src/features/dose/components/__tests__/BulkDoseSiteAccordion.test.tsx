// BulkDoseRegisterModal — accordion de local no lote (spec 071 PR2, D-5).
// Abre sozinho só com exatamente 1 injetável marcada; com 2+ marcadas, todos nascem fechados.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('../../hooks/usePlanProtocols', () => ({ usePlanProtocols: jest.fn() }))
jest.mock('../../services/doseService', () => ({
  registerDoseMany: jest.fn(),
  getLastInjectionSite: jest.fn(() => Promise.resolve(null)),
}))
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: jest.fn() }) }))

const { usePlanProtocols } = require('../../hooks/usePlanProtocols')

import BulkDoseRegisterModal from '../BulkDoseRegisterModal'

const inj = (id: string) => ({
  id,
  name: `Protocolo ${id}`,
  dosage_per_intake: 1,
  medicine: { id: `m-${id}`, name: `Caneta ${id}`, presentation: 'injetavel' },
  treatment_plan: { id: 'plan-1', name: 'Plano' },
})
const oral = (id: string) => ({
  id,
  name: `Protocolo ${id}`,
  dosage_per_intake: 1,
  medicine: { id: `m-${id}`, name: `Comprimido ${id}`, presentation: 'comprimido' },
  treatment_plan: { id: 'plan-1', name: 'Plano' },
})

const PROPS = {
  visible: true,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
  mode: 'plan',
  planId: 'plan-1',
  scheduledTime: '08:00',
  treatmentPlanName: 'Plano',
  userId: 'u1',
}

const renderWith = (protocols: object[]) => {
  usePlanProtocols.mockReturnValue({ protocols, loading: false, error: null })
  return render(<BulkDoseRegisterModal {...PROPS} />)
}

describe('BulkDoseRegisterModal — accordion de local (D-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('1 injetável marcada (+ oral): bloco de local abre sozinho', () => {
    const { getAllByTestId, getByText } = renderWith([inj('p1'), oral('p2')])
    expect(getAllByTestId('injection-site-toggle')).toHaveLength(1)
    expect(getByText('Não informar')).toBeTruthy()
  })

  it('2 injetáveis marcadas: nenhum bloco abre sozinho', () => {
    const { getAllByTestId, queryByText } = renderWith([inj('p1'), inj('p2')])
    expect(getAllByTestId('injection-site-toggle')).toHaveLength(2)
    expect(queryByText('Não informar')).toBeNull()
  })
})
