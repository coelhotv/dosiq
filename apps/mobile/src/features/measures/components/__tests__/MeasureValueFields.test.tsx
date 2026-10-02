// MeasureValueFields — 069 A2 / T021: o passo 2 da dose abre com o teclado FECHADO (A-D4);
// o MeasureLogSheet segue abrindo com foco (default). Vírgula e '' são do salvador (DoseWeightPrompt).
import { describe, it, expect, afterEach } from '@jest/globals'
import React from 'react'
import { render } from '@testing-library/react-native'

import MeasureValueFields from '../MeasureValueFields'

const base = { unit: 'kg', isPa: false, value: '', onChangeValue: jest.fn(), valueSec: '', onChangeValueSec: jest.fn(), errorMsg: null }

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('MeasureValueFields — foco', () => {
  it('default abre com foco (comportamento do MeasureLogSheet)', () => {
    const { getByLabelText } = render(<MeasureValueFields {...base} />)
    expect(getByLabelText('Valor da medida em kg').props.autoFocus).toBe(true)
  })
  it('autoFocus={false} é respeitado (passo 2 da dose)', () => {
    const { getByLabelText } = render(<MeasureValueFields {...base} autoFocus={false} />)
    expect(getByLabelText('Valor da medida em kg').props.autoFocus).toBe(false)
  })
  it('valor digitado com vírgula é mostrado como digitado', () => {
    const { getByLabelText } = render(<MeasureValueFields {...base} value="82,5" />)
    expect(getByLabelText('Valor da medida em kg').props.value).toBe('82,5')
  })
})
