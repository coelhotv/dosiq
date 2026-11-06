// supplyRunwayBadges.test.tsx — spec 105 Fatia B (PO-105-G4 / PO-105-5): o que a pessoa VÊ.
// Esparso/etapa de passagem ⇒ sem "Crítico", sem vermelho; saldo em doses continua (FR-G5);
// item mostra a data de compra do core (FR-009). Diário ⇒ como hoje.

import React from 'react'
import { render } from '@testing-library/react-native'
import StockLevelBadge from '../StockLevelBadge'
import StockIndicators from '../StockIndicators'
import StockItem from '../StockItem'
import { colors } from '@shared/styles/tokens'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

const supply = { status: 'due', date: '2026-11-08', medicineId: 'm', reason: 'sparse', protocolId: 'p' }

describe('superfícies de estoque (105 G4 / FR-009)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('badge PLANNED: sem "Crítico", saldo em doses visível', () => {
    const { queryByText, getByText } = render(
      <StockLevelBadge status="PLANNED" daysRemaining={0} dosesRemaining={0} isDailyStock={false} />,
    )
    expect(queryByText('Crítico')).toBeNull()
    expect(getByText('Planejado')).toBeTruthy()
    expect(getByText('0 doses')).toBeTruthy()
  })

  it('badge CRITICAL (diário) segue como hoje', () => {
    const { getByText } = render(<StockLevelBadge status="CRITICAL" daysRemaining={2} dosesRemaining={2} isDailyStock />)
    expect(getByText('Crítico')).toBeTruthy()
    expect(getByText('2 dias')).toBeTruthy()
  })

  it('KPI do detalhe: elegível ⇒ número neutro; diário com runway curto ⇒ vermelho', () => {
    const planned = render(<StockIndicators saldo={5} dailyConsumption={2} daysRemaining={1} dosesRemaining={3} isDailyStock={false} runwayAlertExpected={false} />)
    expect(planned.getByText('3').props.style).toEqual(expect.arrayContaining([{ color: colors.text.primary }]))
    const daily = render(<StockIndicators saldo={5} dailyConsumption={2} daysRemaining={1} isDailyStock />)
    expect(daily.getByText('1').props.style).toEqual(expect.arrayContaining([{ color: colors.status.error }]))
  })

  it('item elegível mostra "Próxima compra até DD/MM" e o saldo', () => {
    const { getByTestId, getByText } = render(
      <StockItem medicine={{ name: 'Inj', totalQuantity: 0, hasPurchases: true, hasActiveProtocol: true, status: 'PLANNED', dosesRemaining: 0, isDailyStock: false, supply }} />,
    )
    expect(getByTestId('stock-item-supply').props.children).toBe('Próxima compra até 08/11')
    expect(getByText(/Saldo:/)).toBeTruthy()
  })

  it('item sem data (no_date) ⇒ sem linha de compra (FR-010)', () => {
    const { queryByTestId } = render(
      <StockItem medicine={{ name: 'Inj', totalQuantity: 0, hasPurchases: true, hasActiveProtocol: true, status: 'PLANNED', supply: { status: 'no_date' } }} />,
    )
    expect(queryByTestId('stock-item-supply')).toBeNull()
  })
})
