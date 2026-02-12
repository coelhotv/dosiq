import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TitrationWizard from './TitrationWizard'

// Mock Button since it's used in component
vi.mock('../ui/Button', () => ({
  default: ({ children, onClick, type }) => (
    <button onClick={onClick} type={type}>
      {children}
    </button>
  )
}))

describe('TitrationWizard', () => {
  it('renders correctly with empty schedule', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    expect(screen.getByText('📈 Regime de Titulação')).toBeInTheDocument()
    expect(screen.getByText('Defina a evolução da dose ao longo do tempo.')).toBeInTheDocument()
    expect(screen.getByText('Adicionar Nova Etapa')).toBeInTheDocument()
  })

  it('renders correctly with existing schedule', () => {
    const schedule = [
      { days: 7, dosage: 1, note: 'Introdução' },
      { days: 14, dosage: 2, note: 'Aumento' }
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    expect(screen.getByText('Etapa 1')).toBeInTheDocument()
    expect(screen.getByText('Etapa 2')).toBeInTheDocument()
    // Find the summary element and verify it contains the total days
    const summaryElement = screen.getByText((content) => content.includes('21') && content.includes('dias'))
    expect(summaryElement).toBeInTheDocument()
  })

  it('adds a new stage', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    // Find inputs in the add-stage-form section by their position
    const addFormInputs = screen.getAllByRole('spinbutton')
    const daysInput = addFormInputs[0]
    const dosageInput = addFormInputs[1]
    const noteInput = screen.getByPlaceholderText('Nota (opcional)')

    fireEvent.change(daysInput, { target: { value: '7' } })
    fireEvent.change(dosageInput, { target: { value: '1' } })
    fireEvent.change(noteInput, { target: { value: 'Introdução' } })

    fireEvent.click(screen.getByText('➕ Adicionar Etapa'))

    expect(onChange).toHaveBeenCalledWith([
      { days: 7, dosage: 1, note: 'Introdução' }
    ])
  })

  it('removes a stage', () => {
    const schedule = [
      { days: 7, dosage: 1, note: 'Introdução' },
      { days: 14, dosage: 2, note: 'Aumento' }
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    const removeButtons = screen.getAllByTitle('Remover etapa')
    fireEvent.click(removeButtons[0])

    expect(onChange).toHaveBeenCalledWith([
      { days: 14, dosage: 2, note: 'Aumento' }
    ])
  })

  it('updates a stage field', () => {
    const schedule = [
      { days: 7, dosage: 1, note: 'Introdução' }
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    // Find inputs in the stages-list section
    const stageInputs = screen.getAllByRole('spinbutton')
    const daysInput = stageInputs[0] // First input is for the first stage
    fireEvent.change(daysInput, { target: { value: '10' } })

    expect(onChange).toHaveBeenCalledWith([
      { days: 10, dosage: 1, note: 'Introdução' }
    ])
  })

  it('calculates total days correctly', () => {
    const schedule = [
      { days: 7, dosage: 1, note: 'Introdução' },
      { days: 14, dosage: 2, note: 'Aumento' },
      { days: 21, dosage: 3, note: 'Manutenção' }
    ]
    const onChange = vi.fn()
    render(<TitrationWizard schedule={schedule} onChange={onChange} />)

    // Find the summary element and verify it contains the total days
    const summaryElement = screen.getByText((content) => content.includes('42') && content.includes('dias'))
    expect(summaryElement).toBeInTheDocument()
  })

  it('resets form after adding stage', () => {
    const onChange = vi.fn()
    render(<TitrationWizard schedule={[]} onChange={onChange} />)

    // Find inputs in the add-stage-form section by their position
    const addFormInputs = screen.getAllByRole('spinbutton')
    const daysInput = addFormInputs[0]
    const dosageInput = addFormInputs[1]
    const noteInput = screen.getByPlaceholderText('Nota (opcional)')

    fireEvent.change(daysInput, { target: { value: '7' } })
    fireEvent.change(dosageInput, { target: { value: '1' } })
    fireEvent.change(noteInput, { target: { value: 'Introdução' } })

    fireEvent.click(screen.getByText('➕ Adicionar Etapa'))

    // Note should be reset but days and dosage should remain
    expect(daysInput.value).toBe('7')
    expect(dosageInput.value).toBe('1')
    expect(noteInput.value).toBe('')
  })

  it('syncs with schedule prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TitrationWizard schedule={[]} onChange={onChange} />)

    expect(screen.queryByText('Etapa 1')).not.toBeInTheDocument()

    rerender(<TitrationWizard schedule={[{ days: 7, dosage: 1, note: 'Introdução' }]} onChange={onChange} />)

    expect(screen.getByText('Etapa 1')).toBeInTheDocument()
  })
})
