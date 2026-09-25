// 085 C2 — campo N da cadência "a cada N dias" no formulário mobile.
//
// Trava: o campo só existe com `intervalo_dias`; o texto vira NÚMERO antes de ir ao form (o Zod
// valida número — string faria o erro chegar em inglês, ou 23514 do banco); vazio vira null, e o
// refine do schema pede o valor em PT.

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ProtocolFormBody from '../ProtocolFormBody'

jest.mock('@treatments/hooks/useIntervalCadenceAvailability', () => ({
  useIntervalCadenceAvailability: () => true,
}))

function makeForm(values = {}) {
  return {
    values: { name: '', dosage_per_intake: 1, time_schedule: ['08:00'], frequency: 'diário', ...values },
    errors: {},
    touched: {},
    setValue: jest.fn(),
    setFieldValue: jest.fn(),
    handleChange: jest.fn(),
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
