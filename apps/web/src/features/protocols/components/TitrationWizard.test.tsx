import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TitrationWizard from './TitrationWizard'

// Mock Button since it's used in component
vi.mock('../ui/Button', () => ({
  default: ({ children, onClick, type }) => (
    <button onClick={onClick} type={type}>
      {children}
    </button>
  ),
}))

describe('TitrationWizard', () => {
  it('renders correctly with empty schedule', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    expect(screen.getByText('📈 Regime de Titulação')).toBeInTheDocument()
    expect(screen.getByText(/Defina a evolução da dose ao longo do tempo/)).toBeInTheDocument()
    expect(screen.getByText('Nova Etapa')).toBeInTheDocument()
  })

  it('renders correctly with existing schedule', () => {
    const schedule = [
      { duration_days: 7, dosage: 1, description: 'Introdução' },
      { duration_days: 14, dosage: 2, description: 'Aumento' },
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    expect(screen.getByText('Etapa 1')).toBeInTheDocument()
    expect(screen.getByText('Etapa 2')).toBeInTheDocument()
    // Find the summary element and verify it contains the total days
    const summaryElement = screen.getByText(
      (content) => content.includes('21') && content.includes('dias')
    )
    expect(summaryElement).toBeInTheDocument()
  })

  it('adds a new stage', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    // Dose virou input text (inputMode decimal, R-270) — busca por placeholder
    const daysInput = screen.getAllByRole('spinbutton')[0]
    const dosageInput = screen.getByPlaceholderText('Ex: 0,25')
    const noteInput = screen.getByPlaceholderText(/Nota \(opcional\)/)

    fireEvent.change(daysInput, { target: { value: '7' } })
    fireEvent.change(dosageInput, { target: { value: '1' } })
    fireEvent.change(noteInput, { target: { value: 'Introdução' } })

    fireEvent.click(screen.getByText('✓ Gravar Etapa'))

    expect(onChange).toHaveBeenCalledWith([
      { duration_days: 7, dosage: 1, description: 'Introdução', requires_new_medicine: false },
    ])
  })

  it('aceita vírgula PT-BR na dose da nova etapa (R-270): "0,25" → 0.25', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Ex: 0,25'), { target: { value: '0,25' } })
    fireEvent.click(screen.getByText('✓ Gravar Etapa'))

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ dosage: 0.25 })])
  })

  it('dose inválida ou vazia não adiciona etapa', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Ex: 0,25'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('✓ Gravar Etapa'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a stage', () => {
    const schedule = [
      { duration_days: 7, dosage: 1, description: 'Introdução' },
      { duration_days: 14, dosage: 2, description: 'Aumento' },
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    const removeButtons = screen.getAllByTitle('Remover etapa')
    fireEvent.click(removeButtons[0])

    expect(onChange).toHaveBeenCalledWith([{ duration_days: 14, dosage: 2, description: 'Aumento' }])
  })

  it('updates a stage field', () => {
    const schedule = [{ duration_days: 7, dosage: 1, description: 'Introdução' }]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    // Find inputs in the stages-list section
    const stageInputs = screen.getAllByRole('spinbutton')
    const daysInput = stageInputs[0] // First input is for the first stage
    fireEvent.change(daysInput, { target: { value: '10' } })

    expect(onChange).toHaveBeenCalledWith([
      { duration_days: 10, dosage: 1, description: 'Introdução' },
    ])
  })

  it('calculates total days correctly (incl. fallback legado days/note)', () => {
    const schedule = [
      { duration_days: 7, dosage: 1, description: 'Introdução' },
      { duration_days: 14, dosage: 2, description: 'Aumento' },
      { days: 21, dosage: 3, note: 'Manutenção' }, // legado pré-canônico
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    // Find the summary element and verify it contains the total days
    const summaryElement = screen.getByText(
      (content) => content.includes('42') && content.includes('dias')
    )
    expect(summaryElement).toBeInTheDocument()
  })

  it('resets form after adding stage', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    const daysInput = screen.getAllByRole('spinbutton')[0]
    const dosageInput = screen.getByPlaceholderText('Ex: 0,25')
    const noteInput = screen.getByPlaceholderText(/Nota \(opcional\)/)

    fireEvent.change(daysInput, { target: { value: '7' } })
    fireEvent.change(dosageInput, { target: { value: '1' } })
    fireEvent.change(noteInput, { target: { value: 'Introdução' } })

    fireEvent.click(screen.getByText('✓ Gravar Etapa'))

    // Note should be reset but days and dosage should remain
    expect((daysInput as HTMLInputElement).value).toBe('7')
    expect((dosageInput as HTMLInputElement).value).toBe('1')
    expect((noteInput as HTMLInputElement).value).toBe('')
  })

  it('syncs with schedule prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TitrationWizard schedule={[]} onChange={onChange} />)

    expect(screen.queryByText('Etapa 1')).not.toBeInTheDocument()

    rerender(
      <TitrationWizard
        schedule={[{ duration_days: 7, dosage: 1, description: 'Introdução' }]}
        onChange={onChange}
      />
    )

    expect(screen.getByText('Etapa 1')).toBeInTheDocument()
  })
})
