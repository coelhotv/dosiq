import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { INJECTION_SITES, getInjectionSiteLabel } from '@dosiq/core'
import BodyMapSelector from '@shared/components/log/BodyMapSelector'

const radios = () => screen.getAllByRole('radio')
const region = (site: string) =>
  radios().find((el) => el.getAttribute('data-site') === site) as Element

describe('BodyMapSelector (071)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('renderiza as 8 regiões na ordem canônica, com nome derivado do core (PO-4)', () => {
    render(<BodyMapSelector value={null} onChange={vi.fn()} />)
    const all = radios()
    expect(all.map((el) => el.getAttribute('data-site'))).toEqual(INJECTION_SITES.map((s) => s.value))
    for (const el of all) {
      const site = el.getAttribute('data-site')
      expect(el).toHaveAttribute('aria-label', getInjectionSiteLabel(site))
      expect(el).toHaveAttribute('aria-checked', 'false')
      expect(el).toHaveAttribute('tabindex', '0')
    }
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('glúteo E/D ficam na vista das costas; abdômen/braço/coxa na frente (AC-3)', () => {
    const { container } = render(<BodyMapSelector value={null} onChange={vi.fn()} />)
    const costas = container.querySelector('svg[data-face="costas"]') as HTMLElement
    const frente = container.querySelector('svg[data-face="frente"]') as HTMLElement
    const sites = (svg: HTMLElement) =>
      within(svg).getAllByRole('radio').map((el) => el.getAttribute('data-site'))
    expect(sites(costas)).toEqual(['gluteo_e', 'gluteo_d'])
    expect(sites(frente)).toEqual(['abdomen_e', 'abdomen_d', 'braco_e', 'braco_d', 'coxa_e', 'coxa_d'])
  })

  it('selecionar região dorsal devolve o valor canônico do enum (AC-2)', () => {
    const onChange = vi.fn()
    render(<BodyMapSelector value={null} onChange={onChange} />)
    fireEvent.click(region('gluteo_e'))
    expect(onChange).toHaveBeenCalledWith('gluteo_e')
  })

  it('teclado: Enter e Espaço selecionam a região (AC-8)', () => {
    const onChange = vi.fn()
    render(<BodyMapSelector value={null} onChange={onChange} />)
    fireEvent.keyDown(region('coxa_d'), { key: 'Enter' })
    fireEvent.keyDown(region('braco_e'), { key: ' ' })
    expect(onChange).toHaveBeenNthCalledWith(1, 'coxa_d')
    expect(onChange).toHaveBeenNthCalledWith(2, 'braco_e')
  })

  it('re-clique na região já selecionada devolve null (D7, AC-14)', () => {
    const onChange = vi.fn()
    render(<BodyMapSelector value="coxa_e" onChange={onChange} />)
    expect(region('coxa_e')).toHaveAttribute('aria-checked', 'true')
    expect(region('coxa_e')).toHaveAttribute('aria-label', 'Coxa (esquerda), selecionado')
    fireEvent.click(region('coxa_e'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('"Não informar" sempre visível e devolve null (D7, AC-7/AC-14)', () => {
    const onChange = vi.fn()
    render(<BodyMapSelector value="abdomen_d" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Não informar' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('disabled: região, teclado, lista e "Não informar" não disparam onChange (AC-15)', () => {
    const onChange = vi.fn()
    render(<BodyMapSelector value="abdomen_e" onChange={onChange} disabled />)
    fireEvent.click(region('gluteo_d'))
    fireEvent.keyDown(region('gluteo_d'), { key: 'Enter' })
    fireEvent.click(region('abdomen_e'))
    fireEvent.click(screen.getByRole('button', { name: 'Não informar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Coxa (direita)' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(region('gluteo_d')).toHaveAttribute('tabindex', '-1')
  })

  it('lista textual é fallback equivalente: 8 opções que selecionam e desmarcam (AC-9)', () => {
    const onChange = vi.fn()
    render(<BodyMapSelector value="braco_d" onChange={onChange} />)
    const list = screen.getByRole('group', { name: /escolha pela lista/i })
    const buttons = within(list).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(INJECTION_SITES.map((s) => s.label))
    fireEvent.click(within(list).getByRole('button', { name: 'Glúteo (direito)' }))
    fireEvent.click(within(list).getByRole('button', { name: 'Braço (direito)' }))
    expect(onChange).toHaveBeenNthCalledWith(1, 'gluteo_d')
    expect(onChange).toHaveBeenNthCalledWith(2, null)
  })

  it('último sítio: destacado no mapa e descrito em texto (AC-4)', () => {
    render(<BodyMapSelector value={null} onChange={vi.fn()} lastUsedSite="braco_e" />)
    expect(region('braco_e')).toHaveAttribute('aria-label', 'Braço (esquerdo), última aplicação')
    expect(region('braco_e').getAttribute('class')).toContain('body-map__region--last')
    expect(screen.getByText(/Última aplicação:/)).toHaveTextContent('Braço (esquerdo)')
  })

  it('mesmo sítio da última aplicação mostra alerta não-bloqueante (AC-5)', () => {
    const { rerender } = render(
      <BodyMapSelector value="coxa_d" onChange={vi.fn()} lastUsedSite="braco_e" />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    rerender(<BodyMapSelector value="braco_e" onChange={vi.fn()} lastUsedSite="braco_e" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Mesmo local da última aplicação')
    expect(region('braco_e')).toHaveAttribute(
      'aria-label',
      'Braço (esquerdo), selecionado, última aplicação'
    )
  })

  it('hint de absorção do sítio selecionado continua aparecendo (AC-6)', () => {
    render(<BodyMapSelector value="abdomen_e" onChange={vi.fn()} />)
    expect(screen.getByText('absorção mais rápida')).toBeInTheDocument()
  })
})
