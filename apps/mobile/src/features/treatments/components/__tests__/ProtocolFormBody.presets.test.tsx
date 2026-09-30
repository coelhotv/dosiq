// 086 T015 — presets de horário plugados no formulário completo (criar/editar; FR-008).

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ProtocolFormBody from '../ProtocolFormBody'

jest.mock('@treatments/hooks/useIntervalCadenceAvailability', () => ({
  useIntervalCadenceAvailability: () => ({ available: true, settled: true }),
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

describe('ProtocolFormBody — presets de horário (086 T015)', () => {
  it('diário: chips visíveis; tocar 12/12 grava os horários calculados no form', () => {
    const form = makeForm({ time_schedule: [] })
    const { getByTestId } = render(<ProtocolFormBody {...baseProps} form={form} />)
    fireEvent.press(getByTestId('schedule-preset-12h'))
    expect(form.handleChange).toHaveBeenCalledWith('time_schedule', ['08:00', '20:00'])
  })

  it('edição de 07:00/15:00/23:00 abre com 8/8 marcado', () => {
    const form = makeForm({ time_schedule: ['07:00', '15:00', '23:00'] })
    const { getByTestId } = render(<ProtocolFormBody {...baseProps} isEditMode form={form} />)
    expect(getByTestId('schedule-preset-8h').props.accessibilityState.checked).toBe(true)
  })

  it('dias_alternados também tem chips', () => {
    const { getByTestId } = render(<ProtocolFormBody {...baseProps} form={makeForm({ frequency: 'dias_alternados' })} />)
    expect(getByTestId('schedule-presets')).toBeTruthy()
  })

  it.each(['semanal', 'intervalo_dias', 'quando_necessário'])('%s: sem chips, só a lista (FR-008)', (frequency) => {
    const form = makeForm({ frequency, interval_days: frequency === 'intervalo_dias' ? 30 : null, weekdays: [] })
    const { queryByTestId, getByLabelText } = render(<ProtocolFormBody {...baseProps} form={form} />)
    expect(queryByTestId('schedule-presets')).toBeNull()
    expect(getByLabelText('Adicionar horário')).toBeTruthy()
  })
})
