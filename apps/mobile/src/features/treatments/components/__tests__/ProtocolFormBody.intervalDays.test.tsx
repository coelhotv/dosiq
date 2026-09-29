// 085 C2 — campo N da cadência "a cada N dias" no formulário mobile.
//
// Trava: o campo só existe com `intervalo_dias`; o texto vira NÚMERO antes de ir ao form (o Zod
// valida número — string faria o erro chegar em inglês, ou 23514 do banco); vazio vira null, e o
// refine do schema pede o valor em PT.

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ProtocolFormBody from '../ProtocolFormBody'

let mockAvailable = true
jest.mock('@treatments/hooks/useIntervalCadenceAvailability', () => ({
  useIntervalCadenceAvailability: () => ({ available: mockAvailable, settled: true }),
}))

function makeForm(values = {}) {
  return {
    values: { name: '', dosage_per_intake: 1, time_schedule: ['08:00'], frequency: 'diário', ...values },
    errors: {},
    touched: {},
    setValue: jest.fn(),
    setFieldValue: jest.fn(),
    handleChange: jest.fn(),
    setValues: jest.fn(),
    handleBlur: jest.fn(),
  }
}

const baseProps = {
  medicine: { id: 'm1', name: 'Depo', dosage_unit: 'mg', presentation: 'injetavel' },
  onOpenMedicineSheet: jest.fn(),
  onOpenTitration: jest.fn(),
  isEditMode: false,
  plans: [],
  planField: { mode: 'select', planId: null, inline: null },
  onPlanFieldChange: jest.fn(),
  onDoseChange: jest.fn(),
  onStartDateChange: jest.fn(),
  onEndDateChange: jest.fn(),
  titrationStepCount: 0,
  titrationSteps: [],
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockAvailable = true
})

describe('ProtocolFormBody — N da cadência por intervalo (085 C2)', () => {
  it('sem intervalo_dias não há campo N', () => {
    const { queryByPlaceholderText } = render(<ProtocolFormBody {...baseProps} form={makeForm()} />)
    expect(queryByPlaceholderText('Ex.: 30')).toBeNull()
  })

  it('com intervalo_dias exibe o N salvo e converte a digitação em número', () => {
    const form = makeForm({ frequency: 'intervalo_dias', interval_days: 90 })
    const { getByPlaceholderText, getByText } = render(<ProtocolFormBody {...baseProps} form={form} />)
    const input = getByPlaceholderText('Ex.: 30')
    expect(input.props.value).toBe('90')
    expect(getByText(/De 2 a 180 dias/)).toBeTruthy()

    fireEvent.changeText(input, '30')
    expect(form.handleChange).toHaveBeenCalledWith('interval_days', 30)
    fireEvent.changeText(input, '3a')
    expect(form.handleChange).toHaveBeenLastCalledWith('interval_days', 3)
    fireEvent.changeText(input, '')
    expect(form.handleChange).toHaveBeenLastCalledWith('interval_days', null)
  })
})

describe('ProtocolFormBody — "Mensal (a cada 30 dias)" e próxima dose (086 T026)', () => {
  function openPeriodicity(utils) {
    fireEvent.press(utils.getByLabelText('Periodicidade'))
  }

  it('trava true ⇒ Mensal oferecida; escolher grava intervalo_dias/30 num patch só (PO-5)', () => {
    const form = makeForm()
    const utils = render(<ProtocolFormBody {...baseProps} form={form} />)
    openPeriodicity(utils)
    fireEvent.press(utils.getByText('Mensal (a cada 30 dias)'))
    expect(form.setValues).toHaveBeenCalledWith({ frequency: 'intervalo_dias', interval_days: 30 })
  })

  it('trava false ⇒ nem Mensal nem "A cada X dias" (INV-5)', () => {
    mockAvailable = false
    const utils = render(<ProtocolFormBody {...baseProps} form={makeForm()} />)
    openPeriodicity(utils)
    expect(utils.queryByText('Mensal (a cada 30 dias)')).toBeNull()
    expect(utils.queryByText('A cada X dias')).toBeNull()
  })

  it('sair de Mensal para Diário limpa interval_days no mesmo patch (FM-8 / E-4)', () => {
    const form = makeForm({ frequency: 'intervalo_dias', interval_days: 30 })
    const utils = render(<ProtocolFormBody {...baseProps} isEditMode form={form} />)
    openPeriodicity(utils)
    fireEvent.press(utils.getByText('Diário'))
    expect(form.setValues).toHaveBeenCalledWith({ frequency: 'diário', interval_days: null })
  })

  it('edição de intervalo_dias/30 abre como "Mensal (a cada 30 dias)", sem o campo N (FR-014)', () => {
    const utils = render(
      <ProtocolFormBody {...baseProps} isEditMode form={makeForm({ frequency: 'intervalo_dias', interval_days: 30 })} />
    )
    expect(utils.getAllByText('Mensal (a cada 30 dias)').length).toBeGreaterThan(0)
    expect(utils.queryByPlaceholderText('Ex.: 30')).toBeNull()
  })

  it('edição de intervalo_dias/30 com trava hoje false: Mensal segue exibida (valor corrente nunca some)', () => {
    mockAvailable = false
    const utils = render(
      <ProtocolFormBody {...baseProps} isEditMode form={makeForm({ frequency: 'intervalo_dias', interval_days: 30 })} />
    )
    expect(utils.getAllByText('Mensal (a cada 30 dias)').length).toBeGreaterThan(0)
  })

  it('edição de N=45 abre em "A cada X dias" com 45', () => {
    const utils = render(
      <ProtocolFormBody {...baseProps} isEditMode form={makeForm({ frequency: 'intervalo_dias', interval_days: 45 })} />
    )
    expect(utils.getByPlaceholderText('Ex.: 30').props.value).toBe('45')
  })

  it('criação em dias: pergunta "Quando é a próxima dose?" e NÃO há "Data do início" duplicado (PO-7)', () => {
    const utils = render(
      <ProtocolFormBody
        {...baseProps}
        form={makeForm({ frequency: 'intervalo_dias', interval_days: 30, start_date: '2026-10-10' })}
      />
    )
    expect(utils.getByLabelText('Quando é a próxima dose?')).toBeTruthy()
    expect(utils.queryByLabelText('Data do início')).toBeNull()
  })

  it('edição em dias: "Data do início", sem a pergunta de próxima dose (FR-017)', () => {
    const utils = render(
      <ProtocolFormBody
        {...baseProps}
        isEditMode
        form={makeForm({ frequency: 'intervalo_dias', interval_days: 30, start_date: '2026-05-01' })}
      />
    )
    expect(utils.getByLabelText('Data do início')).toBeTruthy()
    expect(utils.queryByLabelText('Quando é a próxima dose?')).toBeNull()
  })

  it('criação diária mantém "Data do início" como hoje (guard PO-7)', () => {
    const utils = render(<ProtocolFormBody {...baseProps} form={makeForm({ start_date: '2026-10-10' })} />)
    expect(utils.getByLabelText('Data do início')).toBeTruthy()
    expect(utils.queryByLabelText('Quando é a próxima dose?')).toBeNull()
  })
})
