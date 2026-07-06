// Regressão AP-266: DoseListItem crashava ao renderizar dose tomada (taken_at presente).
// Causa raiz: _formatTakenTime dependia de formatLocalDate (core, retorna só YYYY-MM-DD)
// + split(' ')[1] → undefined → TypeError. Fix: getUserTime(parseISO(takenAt)).
import { render } from '@testing-library/react-native'
import DoseListItem from '../DoseListItem'

describe('DoseListItem', () => {
  it('renderiza dose tomada (taken_at presente) sem lançar', () => {
    const dose = {
      status: 'done',
      taken_at: '2026-07-06T11:00:00Z',
      scheduledTime: '08:00',
      medicine: { name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' },
      protocol: { dosage_per_intake: 1 },
    }
    expect(() => render(<DoseListItem dose={dose} onRegister={() => {}} />)).not.toThrow()
  })

  it('renderiza dose pendente sem taken_at', () => {
    const dose = {
      status: 'pending',
      scheduledTime: '08:00',
      medicine: { name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' },
      protocol: { dosage_per_intake: 1 },
    }
    const { getByText } = render(<DoseListItem dose={dose} onRegister={() => {}} />)
    expect(getByText('08:00')).toBeTruthy()
  })
})
