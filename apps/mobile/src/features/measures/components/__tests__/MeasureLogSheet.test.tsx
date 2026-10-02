// MeasureLogSheet — caracterização (069 A1). Congela o comportamento ATUAL antes de extrair o
// miolo (MeasureValueFields): vírgula PT-BR, lockedType, valor ≤ 0 rejeitado, foco no campo.
// Framework: Jest (jest-expo). jest.mock é hoisted — factories sem vars externas.

import { describe, it, expect, afterEach } from '@jest/globals'
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
  DateTimePickerAndroid: { open: jest.fn() },
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}))
jest.mock('@shared/utils/haptics', () => ({ selectionTap: jest.fn() }))
jest.mock('lucide-react-native', () => ({ Ruler: 'Ruler', Check: 'Check', Calendar: 'Calendar' }))

import MeasureLogSheet from '../MeasureLogSheet'

const VALUE_LABEL_KG = 'Valor da medida em kg'

// O sheet faz reset() num setTimeout(0) ao abrir (MeasureLogSheet: useMeasureSheetState). Esperar
// esse tick antes de interagir — senão o reset apaga o que o teste digitou (no aparelho, o usuário
// nunca digita antes dele).
const renderSheet = async (props = {}) => {
  const onSaved = jest.fn((p) => Promise.resolve(p))
  const onClose = jest.fn()
  const utils = render(<MeasureLogSheet open onClose={onClose} onSaved={onSaved} lockedType="peso" {...props} />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  return { ...utils, onSaved, onClose }
}

describe('MeasureLogSheet — caracterização (069 A1)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('peso com vírgula é gravado como número decimal', async () => {
    const { getByLabelText, onSaved, onClose } = await renderSheet()
    fireEvent.changeText(getByLabelText(VALUE_LABEL_KG), '72,5')
    fireEvent.press(getByLabelText('Salvar medida'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0]).toMatchObject({ type: 'peso', value: 72.5, unit: 'kg', context: null })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('lockedType esconde as abas e mostra só o tipo travado', async () => {
    const { getByText, queryByLabelText } = await renderSheet()
    expect(getByText('Peso')).toBeTruthy()
    expect(queryByLabelText('Glicemia')).toBeNull()
  })

  it('sem lockedType mostra as abas de tipo', async () => {
    const { getByLabelText } = await renderSheet({ lockedType: null })
    expect(getByLabelText('Glicemia')).toBeTruthy()
    expect(getByLabelText('Peso')).toBeTruthy()
  })

  it.each(['0', '-1', '', 'abc'])('valor inválido %p é rejeitado com erro inline e nada é gravado', async (raw) => {
    const { getByLabelText, findByText, onSaved } = await renderSheet()
    fireEvent.changeText(getByLabelText(VALUE_LABEL_KG), raw)
    fireEvent.press(getByLabelText('Salvar medida'))
    expect(await findByText('Digite um valor válido maior que zero.')).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('campo de valor abre com foco', async () => {
    const { getByLabelText } = await renderSheet()
    expect(getByLabelText(VALUE_LABEL_KG).props.autoFocus).toBe(true)
  })

  it('falha do onSaved mostra erro e mantém o sheet aberto', async () => {
    const onSaved = jest.fn(() => Promise.reject(new Error('rede')))
    const { getByLabelText, findByText, onClose } = await renderSheet({ onSaved })
    fireEvent.changeText(getByLabelText(VALUE_LABEL_KG), '80')
    fireEvent.press(getByLabelText('Salvar medida'))
    expect(await findByText('Não foi possível salvar. Nada foi gravado — tente novamente.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
