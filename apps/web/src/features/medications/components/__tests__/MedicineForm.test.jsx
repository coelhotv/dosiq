import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MedicineForm from '../MedicineForm'

vi.mock('@shared/components/ui/animations/ShakeEffect', () => ({
  default: ({ children }) => <div data-testid="shake-effect">{children}</div>
}))

vi.mock('../MedicineAutocomplete', () => ({
  default: () => <div data-testid="medicine-autocomplete">MedicineAutocomplete</div>
}))

vi.mock('../LaboratoryAutocomplete', () => ({
  default: () => <div data-testid="laboratory-autocomplete">LaboratoryAutocomplete</div>
}))

describe('MedicineForm Smoke Test', () => {
  it('renders correctly', () => {
    render(<MedicineForm onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Novo Medicamento')).toBeInTheDocument()
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByText(/Nome do Remédio/)).toBeInTheDocument()
    expect(screen.getByText(/Princípio Ativo/)).toBeInTheDocument()
    expect(screen.getByText(/Classe Terapêutica/)).toBeInTheDocument()
    expect(screen.getByText(/Marca \/ Laboratório/)).toBeInTheDocument()
  })
})
