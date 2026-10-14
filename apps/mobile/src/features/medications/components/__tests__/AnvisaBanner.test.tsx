// 066 Slice C (DESIGN_DECISOES C5.3) — topo do cadastro: busca pela lista oficial da ANVISA.

import React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { AnvisaBanner } from '../AnvisaBanner'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('AnvisaBanner', () => {
  it('vazio: selo de origem, campo de busca falso e divisor do caminho manual', () => {
    const onPress = jest.fn()
    const { getByText, getByLabelText } = render(<AnvisaBanner onPress={onPress} />)
    expect(getByText('Lista oficial da ANVISA')).toBeTruthy()
    expect(getByText('Preenche nome, concentração e apresentação com os dados oficiais.')).toBeTruthy()
    expect(getByText('ou preencha à mão')).toBeTruthy()
    fireEvent.press(getByLabelText('Buscar remédio pelo nome'))
    expect(onPress).toHaveBeenCalled()
  })

  it('preenchido: selo + rótulo do remédio + "Trocar" reabre a busca', () => {
    const onPress = jest.fn()
    const { getByText, queryByText } = render(<AnvisaBanner onPress={onPress} filledLabel="Clopidogrel 75 mg" />)
    expect(getByText('Preenchido pela lista da ANVISA')).toBeTruthy()
    expect(getByText('Clopidogrel 75 mg')).toBeTruthy()
    expect(queryByText('ou preencha à mão')).toBeNull()
    fireEvent.press(getByText('Trocar'))
    expect(onPress).toHaveBeenCalled()
  })

  it('aceita uma 2ª ação no mesmo card (lugar do scan na D1)', () => {
    const { getByText } = render(<AnvisaBanner onPress={jest.fn()}><Text>Ler o código de barras</Text></AnvisaBanner>)
    expect(getByText('Ler o código de barras')).toBeTruthy()
  })
})
