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
    expect(screen.getByText('📞 Contatos de Emergência')).toBeInTheDocument()
    expect(screen.getByText('⚠️ Alergias')).toBeInTheDocument()
    expect(screen.getByText('🩸 Tipo Sanguíneo')).toBeInTheDocument()
    expect(screen.getByText('📝 Observações')).toBeInTheDocument()
  })
})
