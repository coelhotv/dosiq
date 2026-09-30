// 086 D-13 — linha "Próxima dose" do estado "Nenhuma dose hoje". Relógio: qua, 30 set 2026, 12:00.
import { summarizeNextDose } from '../nextDoseSummary'

const NOW = new Date(2026, 8, 30, 12, 0, 0)
const monthly = (over = {}) => ({
  name: 'Mesigyna', active: true, frequency: 'intervalo_dias', interval_days: 30,
  time_schedule: ['16:00'], start_date: '2026-10-10', end_date: null, ...over,
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('summarizeNextDose (086)', () => {
  it('agendado para 10/out ⇒ "Próxima dose: sáb, 10 out às 16:00 · Mesigyna"', () => {
    expect(summarizeNextDose([monthly()], NOW)).toBe('Próxima dose: sáb, 10 out às 16:00 · Mesigyna')
  })

  it('escolhe a mais cedo entre vários', () => {
    const weekly = { name: 'Ozempic', active: true, frequency: 'semanal', weekdays: ['friday'], time_schedule: ['09:00'], start_date: '2026-09-01', end_date: null }
    const out = summarizeNextDose([monthly(), weekly], NOW)
    expect(out).toMatch(/^Próxima dose: (amanhã|sex, 02 out) às 09:00 · Ozempic$/)
  })

  it('amanhã e hoje por extenso', () => {
    expect(summarizeNextDose([monthly({ start_date: '2026-10-01' })], NOW)).toBe('Próxima dose: amanhã às 16:00 · Mesigyna')
    expect(summarizeNextDose([monthly({ start_date: '2026-09-30' })], NOW)).toBe('Próxima dose: hoje às 16:00 · Mesigyna')
  })

  it('nada futuro ⇒ null (PRN, sem horário, lista vazia)', () => {
    expect(summarizeNextDose([monthly({ frequency: 'quando_necessário' })], NOW)).toBeNull()
    expect(summarizeNextDose([monthly({ time_schedule: [] })], NOW)).toBeNull()
    expect(summarizeNextDose([], NOW)).toBeNull()
    expect(summarizeNextDose(null, NOW)).toBeNull()
  })
})
