/**
 * @fileoverview Testes para o componente EmergencyQRCode
 * @module features/emergency/components/__tests__/EmergencyQRCode
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import EmergencyQRCode from '../EmergencyQRCode'

// Mock da biblioteca qrcode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockedQRCodeData'),
  },
}))

describe('EmergencyQRCode', () => {
  const mockCardData = {
    name: 'João Silva',
    blood_type: 'A+',
    allergies: ['Penicilina', 'Dipirona'],
  }

  const mockMedications = [
    { name: 'Losartana', dosage: '50', unit: 'mg', frequency: '1x/dia' },
    { name: 'Metformina', dosage: '500', unit: 'mg', frequency: '2x/dia' },
  ]

  const mockLastUpdated = '2026-03-05T10:00:00.000Z'

  it('deve renderizar o estado de loading inicialmente', () => {
    render(
      <EmergencyQRCode
        cardData={mockCardData}
        medications={mockMedications}
        lastUpdated={mockLastUpdated}
      />
    )

    expect(screen.getByText(/Gerando QR code/i)).toBeInTheDocument()
  })

  it('deve exibir mensagem quando não há dados', () => {
    render(<EmergencyQRCode cardData={null} medications={[]} />)

    expect(screen.getByText(/Dados insuficientes para gerar QR code/i)).toBeInTheDocument()
  })

  it('deve renderizar QR code quando dados são fornecidos', async () => {
    render(
      <EmergencyQRCode
        cardData={mockCardData}
        medications={mockMedications}
        lastUpdated={mockLastUpdated}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText(/QR Code do Cartão de Emergência/i)).toBeInTheDocument()
    })
  })

  it('deve exibir botões de ação quando QR code é gerado', async () => {
    render(
      <EmergencyQRCode
        cardData={mockCardData}
        medications={mockMedications}
        lastUpdated={mockLastUpdated}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Salvar Imagem/i)).toBeInTheDocument()
      expect(screen.getByText(/Compartilhar/i)).toBeInTheDocument()
    })
  })

  it('deve exibir dica de uso como tela de bloqueio', async () => {
    render(
      <EmergencyQRCode
        cardData={mockCardData}
        medications={mockMedications}
        lastUpdated={mockLastUpdated}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Salve esta imagem como tela de bloqueio/i)).toBeInTheDocument()
    })
  })

  it('deve exibir hint sobre escanear o QR code', async () => {
    render(
      <EmergencyQRCode
        cardData={mockCardData}
        medications={mockMedications}
        lastUpdated={mockLastUpdated}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Escaneie para ver informações médicas em emergências/i)).toBeInTheDocument()
    })
  })
})
