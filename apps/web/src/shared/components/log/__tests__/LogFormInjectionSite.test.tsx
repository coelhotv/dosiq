import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogForm from '@/shared/components/log/LogForm'

vi.mock('@shared/services/api/logService', () => ({
  logService: { getLastInjectionSite: vi.fn(() => Promise.resolve('braco_e')) },
}))

vi.mock('@utils/dateUtils', () => ({
  getNow: () => new Date('2026-05-02T12:00:00'),
  parseISO: (s) => new Date(s),
  parseLocalDatetime: (s) => new Date(s),
}))

const protocols = [
  {
    id: 'p-inj',
    medicine_id: 'm-inj',
    name: 'Semaglutida',
    medicine: { name: 'Ozempic', presentation: 'injetavel' },
    dosage_per_intake: 1,
    active: true,
  },
]

const regionOf = (site: string) =>
  screen.getAllByRole('radio').find((el) => el.getAttribute('data-site') === site) as Element

describe('LogForm — sítio de injeção pelo mapa (071)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('injection: accordion nasce fechado no registro e sem <select> de sítio (AC-1, D-2)', async () => {
    render(<LogForm protocols={protocols} onSave={vi.fn()} onCancel={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: /Local de aplicação/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(toggle).toHaveTextContent('Última: Braço (esquerdo)'))
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(document.querySelector('select[name="injection_site"]')).toBeNull()
  })

  it('injection: região dorsal escolhida vira payload canônico gluteo_e (AC-2)', async () => {
    const onSave = vi.fn()
    render(<LogForm protocols={protocols} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Local de aplicação/ }))
    await waitFor(() => expect(document.activeElement).toBe(regionOf('abdomen_e')))
    fireEvent.click(regionOf('gluteo_e'))
    expect(screen.getByRole('button', { name: /Local de aplicação/ })).toHaveTextContent(
      'Glúteo (esquerdo)'
    )
    fireEvent.click(screen.getByText('Registrar Dose'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ injection_site: 'gluteo_e' }))
    )
  })

  it('injection: "Não informar" grava null (AC-7)', async () => {
    const onSave = vi.fn()
    render(
      <LogForm
        protocols={protocols}
        initialValues={{ id: 'log-1', protocol_id: 'p-inj', injection_site: 'coxa_d' }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Não informar' }))
    fireEvent.click(screen.getByText('Atualizar Registro'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ injection_site: null, id: 'log-1' }))
    )
  })

  it('injection: na edição o accordion abre por padrão com o valor salvo (D-2, d1)', () => {
    render(
      <LogForm
        protocols={protocols}
        initialValues={{ id: 'log-1', protocol_id: 'p-inj', injection_site: 'gluteo_d' }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Local de aplicação/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(regionOf('gluteo_d')).toHaveAttribute('aria-checked', 'true')
  })
})
