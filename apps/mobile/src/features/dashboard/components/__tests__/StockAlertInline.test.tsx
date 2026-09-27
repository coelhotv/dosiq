// StockAlertInline.test.tsx — stock_low_viewed (spec 065 PR C2 / PO-5). Evento de VISUALIZAÇÃO:
// nasce na tela (exceção declarada do FR-13).
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import React from 'react'
import { render } from '@testing-library/react-native'

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

// useFocusEffect → useEffect: roda no "foco" (mount) e quando as deps mudam.
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react')
  return { useFocusEffect: (cb) => useEffect(cb, [cb]) }
})

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
