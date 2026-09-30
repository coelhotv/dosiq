// 086 D-14 / PO-13 — card de tratamento ativo com início futuro diz "Começa em DD mmm".
// Relógio fixo: 30 set 2026 (São Paulo).
import React from 'react'
import { render } from '@testing-library/react-native'
import TreatmentCard from '../TreatmentCard'

const base = {
  name: 'Mesigyna',
  frequency: 'intervalo_dias',
  interval_days: 30,
  time_schedule: ['16:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  medicine: { name: 'Mesigyna' },
  titration_steps: [],
  active: true,
  end_date: null,
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-09-30T12:00:00-03:00'))
})
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('TreatmentCard — agendado (086)', () => {
  it('ativo com início futuro ⇒ "Começa em 10 out"', () => {
    const { getByText } = render(<TreatmentCard treatment={{ ...base, start_date: '2026-10-10' }} onPress={jest.fn()} />)
    expect(getByText('Começa em 10 out')).toBeTruthy()
  })

  it('ativo em curso ⇒ sem badge de início', () => {
    const { queryByText } = render(<TreatmentCard treatment={{ ...base, start_date: '2026-09-01' }} onPress={jest.fn()} />)
    expect(queryByText(/Começa em/)).toBeNull()
  })

  it('pausado com início futuro ⇒ "Pausado", não "Começa em"', () => {
    const { getByText, queryByText } = render(
      <TreatmentCard treatment={{ ...base, active: false, start_date: '2026-10-10' }} tabStatus="pausado" onPress={jest.fn()} />
    )
    expect(getByText('Pausado')).toBeTruthy()
    expect(queryByText(/Começa em/)).toBeNull()
  })
})
