import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  useDashboard: vi.fn(),
  getConsultationData: vi.fn(),
  generateConsultationPDF: vi.fn(),
  shareReport: vi.fn(),
  shareNative: vi.fn(),
  copyToClipboard: vi.fn(),
  track: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: mocks.useDashboard,
}))

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
  },
}))

vi.mock('@shared/services/cachedServices', () => ({
  cachedAdherenceService: {
    getDailyAdherenceFromView: vi.fn((days) =>
      Promise.resolve(
        Array.from({ length: days }, (_, index) => ({
          date: `2026-03-${String(index + 1).padStart(2, '0')}`,
          taken: 10,
          expected: 10,
          adherence: 100,
        }))
      )
    ),
  },
}))

vi.mock('@features/consultation/services/consultationDataService', () => ({
  getConsultationData: mocks.getConsultationData,
}))

vi.mock('../../services/consultationPdfService.js', () => ({
  generateConsultationPDF: mocks.generateConsultationPDF,
}))

vi.mock('../../services/shareService', () => ({
  shareReport: mocks.shareReport,
  shareNative: mocks.shareNative,
  copyToClipboard: mocks.copyToClipboard,
}))

vi.mock('@dashboard/services/analyticsService', () => ({
  analyticsService: {
    track: mocks.track,
  },
}))

import ReportGenerator from '../ReportGenerator.jsx'

describe('ReportGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useDashboard.mockReturnValue({
      medicines: [{ id: 'med-1', name: 'Ansitec' }],
      protocols: [{ id: 'prot-1', medicine_id: 'med-1', active: true }],
      logs: [{ id: 'log-1', protocol_id: 'prot-1', quantity_taken: 1 }],
      stockSummary: [],
      stats: { score: 90 },
      dailyAdherence: [{ date: '2026-03-24', taken: 1, expected: 1, adherence: 100 }],
    })

    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          email: 'joao.silva@email.com',
          user_metadata: {
            name: 'Joao Silva',
          },
        },
      },
    })

    mocks.getConsultationData.mockReturnValue({
      patientInfo: { name: 'Joao Silva' },
      activeMedicines: [],
      adherenceSummary: {},
      stockAlerts: [],
      prescriptionStatus: [],
      activeTitrations: [],
      generatedAt: '2026-03-24T10:30:00.000Z',
    })

    mocks.generateConsultationPDF.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
  })

  it('gera o PDF clinico usando o pipeline de consulta', async () => {
    render(<ReportGenerator onClose={vi.fn()} />)

    await waitFor(() => {
      expect(mocks.getUser).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: /gerar pdf clínico/i }))

    await waitFor(() => {
      expect(mocks.getConsultationData).toHaveBeenCalledWith(
        expect.objectContaining({
          medicines: [{ id: 'med-1', name: 'Ansitec' }],
          protocols: [{ id: 'prot-1', medicine_id: 'med-1', active: true }],
        }),
        'Joao Silva',
        null,
        'joao.silva@email.com'
      )
    })

    await waitFor(() => {
      expect(mocks.generateConsultationPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          consultationData: expect.objectContaining({
            patientInfo: { name: 'Joao Silva' },
          }),
          dashboardData: expect.objectContaining({
            medicines: [{ id: 'med-1', name: 'Ansitec' }],
            dailyAdherence: expect.any(Array),
          }),
          period: '30d',
          title: 'Dosiq - Consulta Médica',
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/resumo clínico gerado com sucesso/i)).toBeInTheDocument()
    })
  })
})
