// 066 Slice C (PO-1 · DESIGN_DECISOES C5.2) — passo 2: só a concentração (+ forma); laboratório
// como 2º nível só p/ marca com 2+ fabricantes; "‹" volta um nível; saída sempre disponível.

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { CmedPresentationStep, concentrationLabel, formLabel } from '../CmedPresentationStep'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

const AMOXI = [
  { strength: '500 mg + 125 mg', dose: 500, unit: 'mg', form: 'comprimido', rowIdx: 1, laboratories: [] },
  { strength: '875 mg + 125 mg', dose: 875, unit: 'mg', form: 'comprimido', rowIdx: 3, laboratories: [] },
]
const ATACAND = [{
  strength: '8 mg', dose: 8, unit: 'mg', form: 'comprimido', rowIdx: 5,
  laboratories: [{ laboratory: 'AstraZeneca', rowIdx: 5 }, { laboratory: 'Biopas', rowIdx: 6 }],
}]

function renderStep(props: Partial<React.ComponentProps<typeof CmedPresentationStep>> = {}) {
  const handlers = { onPick: jest.fn(), onSkip: jest.fn(), onBack: jest.fn() }
  const utils = render(<CmedPresentationStep title="Remédio" options={AMOXI} {...handlers} {...props} />)
  return { ...utils, ...handlers }
}

describe('CmedPresentationStep', () => {
  it('pergunta a embalagem e lista as concentrações completas com a forma (D9), sem quantidade', () => {
    const { getByText, queryByText, onPick } = renderStep()
    expect(getByText('Qual embalagem você tem?')).toBeTruthy()
    expect(getByText('Escolha a concentração escrita na embalagem ou na receita.')).toBeTruthy()
    expect(getByText('500 mg + 125 mg')).toBeTruthy()
    expect(queryByText(/comprimidos/)).toBeNull()
    fireEvent.press(getByText('875 mg + 125 mg'))
    expect(onPick).toHaveBeenCalledWith(3)
  })

  it('marca com 2 fabricantes abre direto o laboratório quando é a única concentração', () => {
    const { getByText, onPick } = renderStep({ options: ATACAND })
    expect(getByText('Qual laboratório está escrito na sua embalagem?')).toBeTruthy()
    fireEvent.press(getByText('Biopas'))
    expect(onPick).toHaveBeenCalledWith(6)
  })

  it('"‹" no laboratório volta às concentrações; nas concentrações volta à busca', () => {
    const options = [...AMOXI, { ...ATACAND[0], rowIdx: 7 }]
    const { getByText, getByLabelText, queryByText, onBack } = renderStep({ options })
    fireEvent.press(getByText('8 mg'))
    expect(getByText('Qual laboratório está escrito na sua embalagem?')).toBeTruthy()
    fireEvent.press(getByLabelText('Voltar'))
    expect(queryByText('Qual laboratório está escrito na sua embalagem?')).toBeNull()
    expect(onBack).not.toHaveBeenCalled()
    fireEvent.press(getByLabelText('Voltar'))
    expect(onBack).toHaveBeenCalled()
  })

  it('preparando mostra o aviso e mantém a saída e a volta (INV-3)', () => {
    const { getByText, getByLabelText, onSkip, onBack } = renderStep({ options: [], preparing: true })
    expect(getByText('Buscando na lista completa de embalagens da ANVISA...')).toBeTruthy()
    fireEvent.press(getByText('Minha embalagem não está aqui'))
    expect(onSkip).toHaveBeenCalled()
    fireEvent.press(getByLabelText('Voltar'))
    expect(onBack).toHaveBeenCalled()
  })

  it('rótulos: concentração ausente e forma desconhecida não quebram', () => {
    expect(concentrationLabel({ strength: null, dose: null, unit: null })).toBe('Concentração não informada')
    expect(formLabel('comprimido')).toBe('comprimido')
    expect(formLabel('xpto')).toBeNull()
    expect(formLabel(null)).toBeNull()
  })
})
