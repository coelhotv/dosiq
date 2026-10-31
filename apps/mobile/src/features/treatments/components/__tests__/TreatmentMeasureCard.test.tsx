// TreatmentMeasureCard.test.tsx — spec 100 B · PO-7: estados do card de glicemia/PA (sem julgamento, ADR-062).
import { describe, it, expect, afterEach } from '@jest/globals'
import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'

const mockGetNow = jest.fn(() => new Date(2026, 9, 30, 10, 0))
jest.mock('@dosiq/core', () => ({ ...jest.requireActual('@dosiq/core'), getNow: () => mockGetNow() }))
jest.mock('lucide-react-native', () => ({ Ruler: 'Ruler', AlertCircle: 'AlertCircle', ChevronRight: 'ChevronRight' }))
const mockNavigate = jest.fn()
jest.mock('@navigation/navigateCrossTab', () => ({ navigateCrossTab: (...a: unknown[]) => mockNavigate(...a) }))
jest.mock('@shared/utils/haptics', () => ({ selectionTap: jest.fn() }))
jest.mock('@measures/components/ScatterTrend', () => (props) => {
  const { Text } = require('react-native')
  return <Text testID="scatter">{`${props.unit}|${props.isPa}|${props.items.length}`}</Text>
})
jest.mock('@measures/components/MeasureLogSheet', () => () => null)
const mockList = jest.fn()
jest.mock('@measures/services/measuresRepo', () => ({
  measuresRepo: { list: (...a: unknown[]) => mockList(...a), create: jest.fn() },
}))

import TreatmentMeasureCard from '../TreatmentMeasureCard'

const day = (d: number) => ({ measured_at: new Date(2026, 9, d, 8, 0).toISOString(), value: 100 })

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('TreatmentMeasureCard', () => {
  it('glicemia com 3 dias na semana desenha o ScatterTrend em mg/dL', async () => {
    mockList.mockResolvedValue([day(28), day(29), day(30)])
    const utils = render(<TreatmentMeasureCard measure="glicemia" />)
    expect((await utils.findByTestId('scatter')).props.children).toBe('mg/dL|false|3')
    expect(utils.getByText('GLICEMIA DURANTE O TRATAMENTO')).toBeTruthy()
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ type: 'glicemia' }))
    // Paridade com o card de peso: com gráfico, link para a lista — sem botão de registrar
    expect(utils.queryByText('Registrar glicemia')).toBeNull()
    fireEvent.press(utils.getByText('Ver todas as glicemias'))
    expect(mockNavigate).toHaveBeenCalledWith(expect.anything(), expect.anything(), { type: 'glicemia' })
  })
  it('glicemia com 2 dias mostra o vazio dizendo o que falta, com o botão de registrar', async () => {
    mockList.mockResolvedValue([day(29), day(30)])
    const utils = render(<TreatmentMeasureCard measure="glicemia" />)
    expect(await utils.findByText('Falta 1 dia com medida')).toBeTruthy()
    expect(utils.queryByTestId('scatter')).toBeNull()
    expect(utils.getByText('Registrar glicemia')).toBeTruthy()
  })
  it('PA com 2 dias já desenha, com 2 séries', async () => {
    mockList.mockResolvedValue([day(29), day(30)])
    const utils = render(<TreatmentMeasureCard measure="pressao_arterial" />)
    expect((await utils.findByTestId('scatter')).props.children).toBe('mmHg|true|2')
  })
  it('erro de leitura ⇒ estado vermelho, nunca vazio', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    const utils = render(<TreatmentMeasureCard measure="pressao_arterial" />)
    await waitFor(() => expect(utils.getByTestId('measure-card-error')).toBeTruthy())
    expect(utils.queryByTestId('measure-card-empty')).toBeNull()
  })
})
