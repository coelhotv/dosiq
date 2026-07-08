import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmergencyCardForm from '../EmergencyCardForm'

vi.mock('@features/emergency/services/emergencyCardService', () => ({
  emergencyCardService: {
    save: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } })
  }
}))

describe('EmergencyCardForm Smoke Test', () => {
  it('renders correctly', () => {
    render(<EmergencyCardForm onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Contatos de Emergência' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alergias' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tipo Sanguíneo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Observações' })).toBeInTheDocument()
  })
})
