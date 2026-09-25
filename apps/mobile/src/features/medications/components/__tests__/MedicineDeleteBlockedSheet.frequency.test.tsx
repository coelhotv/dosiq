// 085 C2 — rótulo de frequência na folha "não dá para excluir".
// As chaves do mapa eram SEM acento e o banco grava COM acento: `diário` e `quando_necessário`
// apareciam crus. Este teste trava o rótulo legível e o N da cadência por intervalo.

import React from 'react'
import { render } from '@testing-library/react-native'
import { MedicineDeleteBlockedSheet } from '../MedicineDeleteBlockedSheet'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('MedicineDeleteBlockedSheet — frequência (085 C2)', () => {
  it('mostra rótulo legível e o N', () => {
    const protocols = [
      { id: 'a', name: 'Manhã', frequency: 'diário', time_schedule: ['08:00'] },
      { id: 'b', name: 'Dor', frequency: 'quando_necessário', time_schedule: ['08:00'] },
      { id: 'c', name: 'Depo', frequency: 'intervalo_dias', interval_days: 90, time_schedule: ['09:00'] },
    ]
    const { getByText, queryByText } = render(
      <MedicineDeleteBlockedSheet
        visible
        medicineName="X"
        protocols={protocols}
        onCancel={jest.fn()}
        onOpenProtocol={jest.fn()}
        onOpenStock={jest.fn()}
      />
    )
    expect(getByText('Diário · 1 horário')).toBeTruthy()
    expect(getByText('Quando necessário · 1 horário')).toBeTruthy()
    expect(getByText('A cada 90 dias · 1 horário')).toBeTruthy()
    expect(queryByText(/quando_necessário|intervalo_dias/)).toBeNull()
  })
})
