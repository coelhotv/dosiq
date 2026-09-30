// BodyMapSelector (RN) + InjectionSitePicker — spec 071 PR2 (PO-4 RN, PO-8 RN, D-2/D-5).
// Regiões e lista derivam de INJECTION_SITES (core) — nada hardcoded além dos valores de prova.

import { describe, it, expect, afterEach, jest } from '@jest/globals'
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { INJECTION_SITES, getInjectionSiteLabel } from '@dosiq/core'
import BodyMapSelector from '../BodyMapSelector'
import InjectionSitePicker from '../InjectionSitePicker'

const renderMap = (props = {}) => {
  const onChange = jest.fn()
  const utils = render(<BodyMapSelector value={null} onChange={onChange} {...props} />)
  return { ...utils, onChange }
}

describe('BodyMapSelector (RN)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('desenha exatamente uma região por sítio do enum, com nome do core', () => {
    const { getByTestId } = renderMap()
    for (const site of INJECTION_SITES) {
      expect(getByTestId(`bodymap-region-${site.value}`).props.accessibilityLabel).toBe(
        getInjectionSiteLabel(site.value)
      )
    }
  })

  it('tocar região dorsal devolve o valor canônico gluteo_e', () => {
    const { getByTestId, onChange } = renderMap()
    fireEvent.press(getByTestId('bodymap-region-gluteo_e'))
    expect(onChange).toHaveBeenCalledWith('gluteo_e')
  })

  it('D7: re-tocar a região selecionada devolve null', () => {
    const { getByTestId, onChange } = renderMap({ value: 'coxa_d' })
    fireEvent.press(getByTestId('bodymap-region-coxa_d'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('D7: "Não informar" devolve null', () => {
    const { getByText, onChange } = renderMap({ value: 'braco_e' })
    fireEvent.press(getByText('Não informar'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('disabled: região, lista e "Não informar" não disparam onChange', () => {
    const { getByTestId, getByText, onChange } = renderMap({ value: 'braco_e', disabled: true })
    fireEvent.press(getByTestId('bodymap-region-abdomen_e'))
    fireEvent.press(getByText('Não informar'))
    fireEvent.press(getByText('Escolher pela lista'))
    fireEvent.press(getByTestId('bodymap-list-coxa_e'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('estado vai no nome falado da região (selecionado / última aplicação)', () => {
    const { getByTestId } = renderMap({ value: 'coxa_e', lastUsedSite: 'abdomen_d' })
    expect(getByTestId('bodymap-region-coxa_e').props.accessibilityLabel).toBe(
      `${getInjectionSiteLabel('coxa_e')}, selecionado`
    )
    expect(getByTestId('bodymap-region-abdomen_d').props.accessibilityLabel).toBe(
      `${getInjectionSiteLabel('abdomen_d')}, última aplicação`
    )
  })

  it('lista textual: radiogroup com 8 radios e estado selecionado (AC-9)', () => {
    const { getByText, getByTestId, onChange } = renderMap({ value: 'gluteo_d' })
    fireEvent.press(getByText('Escolher pela lista'))
    for (const site of INJECTION_SITES) {
      const item = getByTestId(`bodymap-list-${site.value}`)
      expect(item.props.accessibilityRole).toBe('radio')
      expect(item.props.accessibilityState.selected).toBe(site.value === 'gluteo_d')
    }
    fireEvent.press(getByTestId('bodymap-list-abdomen_e'))
    expect(onChange).toHaveBeenCalledWith('abdomen_e')
  })

  it('repetido: alerta não-bloqueante + hint de absorção', () => {
    const { getByText } = renderMap({ value: 'abdomen_e', lastUsedSite: 'abdomen_e' })
    expect(getByText('Mesmo local da última aplicação — considere rotacionar.')).toBeTruthy()
  })

  it('primeira vez: sem legenda de última aplicação; valor fora do enum não quebra', () => {
    const { queryByText, getByText } = renderMap({ value: 'x' })
    expect(queryByText('última aplicação')).toBeNull()
    expect(getByText('Última aplicação:', { exact: false })).toBeTruthy()
  })
})

describe('InjectionSitePicker (accordion)', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('fechado por padrão: subtexto mostra a última aplicação, sem mapa', () => {
    const { getByText, queryByText } = render(
      <InjectionSitePicker value={null} onChange={jest.fn()} lastInjectionSite="coxa_e" />
    )
    expect(getByText(`Última: ${getInjectionSiteLabel('coxa_e')}`)).toBeTruthy()
    expect(queryByText('Não informar')).toBeNull()
  })

  it('defaultOpen (edição, D-2): mapa aberto ao montar; toque no toggle fecha', () => {
    const { getByText, queryByText, getByTestId } = render(
      <InjectionSitePicker value="braco_d" onChange={jest.fn()} defaultOpen />
    )
    expect(getByText('Não informar')).toBeTruthy()
    fireEvent.press(getByTestId('injection-site-toggle'))
    expect(queryByText('Não informar')).toBeNull()
  })

  it('fechado com valor: subtexto é o valor escolhido', () => {
    const { getAllByText } = render(<InjectionSitePicker value="gluteo_e" onChange={jest.fn()} />)
    expect(getAllByText(getInjectionSiteLabel('gluteo_e')).length).toBeGreaterThan(0)
  })
})
