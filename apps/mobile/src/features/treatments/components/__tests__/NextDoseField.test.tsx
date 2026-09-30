// 086 US-3 — "Quando é a próxima dose?" + prévia. Relógio fixo: sáb, 10 out 2026, 14:00 (São Paulo).
// A prévia vem do core (`listUpcomingDoseDates`, mesma recorrência do gerador — PO-6); aqui só a
// forma: dia da semana, "hoje" em destaque, linha de "hoje já passou" (PO-11) e pergunta só na
// criação (PO-7).
import React from 'react'
import { render } from '@testing-library/react-native'
import NextDoseField from '../NextDoseField'

jest.mock('@shared/components/form', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    FormDatePicker: ({ label, minimumDate }) => (
      <Text testID="date-picker">{`${label}|min:${minimumDate?.getDate()}/${minimumDate?.getMonth() + 1}`}</Text>
    ),
  }
})

const monthly = (over = {}) => ({
  frequency: 'intervalo_dias',
  interval_days: 30,
  time_schedule: ['08:00'],
  start_date: '2026-10-10',
  end_date: null,
  ...over,
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-10-10T14:00:00-03:00'))
})
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

function textOf(el) {
  const kids = el.props.children
  return (Array.isArray(kids) ? kids : [kids])
    .flat(Infinity)
    .map((k) => (typeof k === 'string' ? k : k?.props ? textOf(k) : ''))
    .join('')
}

describe('NextDoseField (086)', () => {
  it('criação: pergunta "Quando é a próxima dose?" com mínimo = hoje (PO-7)', () => {
    const { getByTestId } = render(<NextDoseField values={monthly()} askDate dateValue={null} onDateChange={jest.fn()} />)
    expect(getByTestId('date-picker').props.children).toBe('Quando é a próxima dose?|min:10/10')
  })

  it('edição: sem a pergunta, só a prévia (FR-017)', () => {
    const { queryByTestId, getByTestId } = render(
      <NextDoseField values={monthly({ start_date: '2026-08-01' })} askDate={false} dateValue={null} onDateChange={jest.fn()} />
    )
    expect(queryByTestId('date-picker')).toBeNull()
    expect(getByTestId('next-dose-preview')).toBeTruthy()
  })

  it('hoje com horário passado ⇒ hoje fora + linha do primeiro lembrete (PO-11 / E-1)', () => {
    const { getByTestId, getByText } = render(<NextDoseField values={monthly()} askDate dateValue={null} onDateChange={jest.fn()} />)
    expect(textOf(getByTestId('next-dose-preview').props.children[0])).toBe(
      'Próximas doses: seg, 09 nov · qua, 09 dez · sex, 08 jan'
    )
    expect(getByText('O horário de hoje já passou — o primeiro lembrete será em seg, 09 nov.')).toBeTruthy()
  })

  it('hoje com horário por vir ⇒ "hoje" em destaque e sem linha de aviso (D-9)', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <NextDoseField values={monthly({ time_schedule: ['20:00'] })} askDate dateValue={null} onDateChange={jest.fn()} />
    )
    expect(textOf(getByTestId('next-dose-preview').props.children[0])).toBe(
      'Próximas doses: hoje · seg, 09 nov · qua, 09 dez'
    )
    expect(getByText('hoje').props.style).toBeTruthy()
    expect(queryByTestId('next-dose-dropped')).toBeNull()
  })

  it('término corta a série ⇒ menos de 3 datas', () => {
    const { getByTestId } = render(
      <NextDoseField values={monthly({ end_date: '2026-11-20' })} askDate dateValue={null} onDateChange={jest.fn()} />
    )
    expect(textOf(getByTestId('next-dose-preview').props.children[0])).toBe('Próximas doses: seg, 09 nov')
  })

  it('sem horário ⇒ nenhuma prévia', () => {
    const { queryByTestId } = render(
      <NextDoseField values={monthly({ time_schedule: [] })} askDate dateValue={null} onDateChange={jest.fn()} />
    )
    expect(queryByTestId('next-dose-preview')).toBeNull()
  })
})
