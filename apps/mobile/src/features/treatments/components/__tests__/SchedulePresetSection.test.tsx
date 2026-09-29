// 086 US-1 — presets de horário. O preset marcado é DERIVADO dos horários (PO-2/INV-2):
// estes testes dirigem o componente como o form dirige (controlado), e conferem que a tela nunca
// afirma um intervalo que os horários não seguem.

import React, { useState } from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import SchedulePresetSection from '../SchedulePresetSection'

// O seletor de hora nativo não roda no jest: o dublê expõe um botão que escolhe 06:30.
jest.mock('@shared/components/form', () => {
  const { Pressable, Text } = jest.requireActual('react-native')
  return {
    FormTimePicker: ({ name, label, value, onChange }) => (
      <Pressable
        testID="anchor-picker"
        onPress={() => {
          const d = new Date(value)
          d.setHours(6, 30, 0, 0)
          onChange(name, d)
        }}
      >
        <Text>{`${label} · ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`}</Text>
      </Pressable>
    ),
  }
})

function Harness({ initial = [], showPresets = true, onChangeSpy = jest.fn() }) {
  const [value, setValue] = useState(initial)
  return (
    <SchedulePresetSection
      value={value}
      showPresets={showPresets}
      onChange={(next) => {
        onChangeSpy(next)
        setValue(next)
      }}
    />
  )
}

function checkedOf(utils, key) {
  return utils.getByTestId(`schedule-preset-${key}`).props.accessibilityState.checked
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('SchedulePresetSection (086)', () => {
  it('formulário novo: lista vazia, nenhum chip marcado, sem âncora (FR-025)', () => {
    const utils = render(<Harness />)
    expect(['1x', '12h', '8h', '6h'].map((k) => checkedOf(utils, k))).toEqual([false, false, false, false])
    expect(utils.queryByTestId('anchor-picker')).toBeNull()
    expect(utils.queryByTestId('schedule-custom')).toBeNull()
    expect(utils.getByTestId('schedule-presets').props.accessibilityRole).toBe('radiogroup')
  })

  it('8/8 → âncora 06:30 → 3 horários; troca para 12/12 preserva a âncora (PO-3 jest)', () => {
    const spy = jest.fn()
    const utils = render(<Harness onChangeSpy={spy} />)
    fireEvent.press(utils.getByTestId('schedule-preset-8h'))
    expect(spy).toHaveBeenLastCalledWith(['07:00', '15:00', '23:00'])
    fireEvent.press(utils.getByTestId('anchor-picker'))
    expect(spy).toHaveBeenLastCalledWith(['06:30', '14:30', '22:30'])
    expect(checkedOf(utils, '8h')).toBe(true)
    fireEvent.press(utils.getByTestId('schedule-preset-12h'))
    expect(spy).toHaveBeenLastCalledWith(['06:30', '18:30'])
    expect(checkedOf(utils, '12h')).toBe(true)
    expect(utils.getByText('Primeira dose do dia · 06:30')).toBeTruthy()
  })

  it('edição manual que quebra a regularidade desmarca e mostra "Horários personalizados" (PO-2)', () => {
    const utils = render(<Harness initial={['07:00', '15:00', '23:00']} />)
    expect(checkedOf(utils, '8h')).toBe(true)
    fireEvent.press(utils.getByLabelText('Remover horário 15:00'))
    expect(['1x', '12h', '8h', '6h'].map((k) => checkedOf(utils, k))).toEqual([false, false, false, false])
    expect(utils.getByText('Horários personalizados')).toBeTruthy()
    expect(utils.queryByTestId('anchor-picker')).toBeNull()
  })

  it('edição manual que vira OUTRO preset marca o outro (derivação)', () => {
    const utils = render(<Harness initial={['08:00', '14:00', '20:00']} />)
    expect(utils.getByText('Horários personalizados')).toBeTruthy()
    fireEvent.press(utils.getByLabelText('Remover horário 14:00'))
    expect(checkedOf(utils, '12h')).toBe(true)
  })

  it('reabrir tratamento salvo 07:00/15:00/23:00 ⇒ 8/8 com primeira dose 07:00 (US-1)', () => {
    const utils = render(<Harness initial={['07:00', '15:00', '23:00']} />)
    expect(checkedOf(utils, '8h')).toBe(true)
    expect(utils.getByText('Primeira dose do dia · 07:00')).toBeTruthy()
  })

  it('1x ao dia: sem linha de âncora; o horário da lista é o controle', () => {
    const utils = render(<Harness initial={['03:00']} />)
    expect(checkedOf(utils, '1x')).toBe(true)
    expect(utils.queryByTestId('anchor-picker')).toBeNull()
    expect(utils.queryByTestId('schedule-early-notice')).toBeNull() // 1 dose: sem aviso
  })

  it('8/8 → 1x: um horário = âncora corrente', () => {
    const spy = jest.fn()
    const utils = render(<Harness initial={['06:30', '14:30', '22:30']} onChangeSpy={spy} />)
    fireEvent.press(utils.getByTestId('schedule-preset-1x'))
    expect(spy).toHaveBeenLastCalledWith(['06:30'])
  })

  it('aviso de madrugada: texto exato, só com preset de ≥2 doses em [00:00, 05:00) (PO-11)', () => {
    const utils = render(<Harness initial={['00:00', '06:00', '12:00', '18:00']} />)
    const notice = utils.getByTestId('schedule-early-notice')
    expect(notice.props.accessibilityLiveRegion).toBe('polite')
    expect(utils.getByText('A dose das 00:00 cai de madrugada. Se preferir, ajuste a primeira dose do dia.')).toBeTruthy()
  })

  it('05:30/13:30/21:30 não dispara aviso; horários manuais de madrugada também não', () => {
    expect(render(<Harness initial={['05:30', '13:30', '21:30']} />).queryByTestId('schedule-early-notice')).toBeNull()
    expect(render(<Harness initial={['02:00', '09:00']} />).queryByTestId('schedule-early-notice')).toBeNull()
  })

  it('showPresets=false: sem chips nem aviso, só a lista (FR-008)', () => {
    const utils = render(<Harness initial={['00:00', '12:00']} showPresets={false} />)
    expect(utils.queryByTestId('schedule-presets')).toBeNull()
    expect(utils.queryByTestId('schedule-early-notice')).toBeNull()
    expect(utils.queryByTestId('schedule-custom')).toBeNull()
    expect(utils.getByLabelText('Adicionar horário')).toBeTruthy()
  })

  it('"Adicionar horário" segue disponível com preset marcado (FR-007)', () => {
    const utils = render(<Harness initial={['08:00', '20:00']} />)
    expect(utils.getByLabelText('Adicionar horário').props.accessibilityState.disabled).toBe(false)
  })
})
