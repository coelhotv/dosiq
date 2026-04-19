import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ViewModeToggle from '../ViewModeToggle'

afterEach(() => {
  vi.clearAllMocks()
})

describe('ViewModeToggle', () => {
  it('renderiza dois botões (Hora e Plano)', () => {
    render(<ViewModeToggle mode="time" onChange={vi.fn()} hasTreatmentPlans={true} />)
    expect(screen.getByText(/Hora/)).toBeInTheDocument()
    expect(screen.getByText(/Plano/)).toBeInTheDocument()
  })

  it('marca botão ativo com classe --active', () => {
    const { container } = render(
      <ViewModeToggle mode="plan" onChange={vi.fn()} hasTreatmentPlans={true} />
    )
    const buttons = container.querySelectorAll('.view-mode-toggle__btn')
    const activeBtn = container.querySelector('.view-mode-toggle__btn--active')
    expect(activeBtn.textContent).toContain('Plano')
    expect(buttons).toHaveLength(2)
  })

  it('chama onChange com o modo selecionado', () => {
    const onChange = vi.fn()
    render(<ViewModeToggle mode="time" onChange={onChange} hasTreatmentPlans={true} />)
    fireEvent.click(screen.getByText(/Plano/))
    expect(onChange).toHaveBeenCalledWith('plan')
  })

  it('retorna null quando hasTreatmentPlans=false', () => {
    const { container } = render(
      <ViewModeToggle mode="time" onChange={vi.fn()} hasTreatmentPlans={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('tem aria-pressed correto', () => {
    render(<ViewModeToggle mode="time" onChange={vi.fn()} hasTreatmentPlans={true} />)
    const horaBtn = screen.getByText(/Hora/).closest('button')
    const planoBtn = screen.getByText(/Plano/).closest('button')
    expect(horaBtn).toHaveAttribute('aria-pressed', 'true')
    expect(planoBtn).toHaveAttribute('aria-pressed', 'false')
  })
})
