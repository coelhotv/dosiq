// StockAlertInline.test.tsx — stock_low_viewed (spec 065 PR C2 / PO-5). Evento de VISUALIZAÇÃO:
// nasce na tela (exceção declarada do FR-13).
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

// useFocusEffect → useEffect: roda no "foco" (mount) e quando as deps mudam.
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react')
  return { useFocusEffect: (cb) => useEffect(cb, [cb]) }
})

const mockCrossTab = jest.fn()
jest.mock('@navigation/navigateCrossTab', () => ({
  navigateCrossTab: (...args) => mockCrossTab(...args),
}))

import StockAlertInline from '../StockAlertInline'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('StockAlertInline — stock_low_viewed', () => {
  it('sem alertas → nada renderizado e nada emitido', () => {
    const { toJSON } = render(<StockAlertInline alerts={[]} />)
    expect(toJSON()).toBeNull()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('banner crítico → kind critical + count, sem nome nem treatment_id', () => {
    render(<StockAlertInline alerts={[{ medicineName: 'X', daysRemaining: 5 }, { medicineName: 'Y', daysRemaining: 1 }]} />)
    expect(mockLogEvent).toHaveBeenCalledWith('stock_low_viewed', { surface: 'mobile', kind: 'critical', count: 2 })
  })

  it('re-render com o mesmo nível/contagem NÃO re-emite; mudança de nível re-emite', () => {
    const alerts = [{ medicineName: 'X', daysRemaining: 5 }]
    const { rerender } = render(<StockAlertInline alerts={alerts} />)
    rerender(<StockAlertInline alerts={[...alerts]} />)
    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenLastCalledWith('stock_low_viewed', { surface: 'mobile', kind: 'low', count: 1 })
    rerender(<StockAlertInline alerts={[{ medicineName: 'X', daysRemaining: 1 }]} />)
    expect(mockLogEvent).toHaveBeenCalledTimes(2)
  })

  it('não muta o array do pai (sort in-place antigo)', () => {
    const alerts = [{ daysRemaining: 5 }, { daysRemaining: 1 }]
    render(<StockAlertInline alerts={alerts} />)
    expect(alerts[0].daysRemaining).toBe(5)
  })
})

// 090 S-6: o banner prometia "leva ao remédio" e não tinha toque. Leva ao ESTOQUE do remédio.
describe('StockAlertInline — toque', () => {
  it('abre o detalhe de estoque do remédio mais crítico (aba Estoque)', () => {
    const { getByTestId } = render(
      <StockAlertInline alerts={[{ medicineId: 'm1', medicineName: 'X', daysRemaining: 5 }, { medicineId: 'm2', medicineName: 'Y', daysRemaining: 1 }]} />
    )
    fireEvent.press(getByTestId('stock-alert-banner'))
    expect(mockCrossTab).toHaveBeenCalledWith('Estoque', 'StockDetail', { medicineId: 'm2', medicineName: 'Y' })
  })
})

// 103 G1: plano não diário fala em doses (como a aba Estoque, ADR-067), não em dias de runway.
describe('StockAlertInline — texto por cadência (103 G1)', () => {
  it('semanal com 1 dose ⇒ "Resta apenas 1 dose."', () => {
    const { getByText } = render(<StockAlertInline alerts={[{ medicineName: 'Wegovy', daysRemaining: 7, dosesRemaining: 1, isDailyStock: false }]} />)
    expect(getByText('Resta apenas 1 dose.')).toBeTruthy()
    expect(getByText('Estoque Baixo: Wegovy')).toBeTruthy()
  })

  it('não diário com 3 doses ⇒ "Restam apenas 3 doses."', () => {
    const { getByText } = render(<StockAlertInline alerts={[{ medicineName: 'X', daysRemaining: 6, dosesRemaining: 3, isDailyStock: false }]} />)
    expect(getByText('Restam apenas 3 doses.')).toBeTruthy()
  })

  it('fração menor que 1 dose ⇒ sem estoque, banner crítico', () => {
    const { getByText } = render(<StockAlertInline alerts={[{ medicineName: 'X', daysRemaining: 4, dosesRemaining: 0, isDailyStock: false }]} />)
    expect(getByText('Não há estoque para a próxima dose.')).toBeTruthy()
    expect(mockLogEvent).toHaveBeenCalledWith('stock_low_viewed', { surface: 'mobile', kind: 'critical', count: 1 })
  })

  // Saldo 0: stockDoseMetrics sai cedo com isDaily=true (core stock.ts) — a mensagem não pode depender da cadência.
  it.each([[true], [false]])('saldo zerado (isDailyStock=%p) ⇒ sem estoque, nunca "0 dias"', (isDailyStock) => {
    const { getByText, queryByText } = render(<StockAlertInline alerts={[{ medicineName: 'Wegovy', daysRemaining: 0, dosesRemaining: 0, isDailyStock }]} />)
    expect(getByText('Não há estoque para a próxima dose.')).toBeTruthy()
    expect(queryByText(/0 dias/)).toBeNull()
    expect(getByText('Sem estoque: Wegovy')).toBeTruthy()
    expect(queryByText(/Estoque Baixo/)).toBeNull()
  })

  it('diário ou sem métrica de doses ⇒ mantém dias', () => {
    const { getByText, rerender } = render(<StockAlertInline alerts={[{ medicineName: 'X', daysRemaining: 5, dosesRemaining: 5, isDailyStock: true }]} />)
    expect(getByText('Resta apenas para 5 dias.')).toBeTruthy()
    rerender(<StockAlertInline alerts={[{ medicineName: 'X', daysRemaining: 1 }]} />)
    expect(getByText('Resta apenas para 1 dia.')).toBeTruthy()
  })
})
