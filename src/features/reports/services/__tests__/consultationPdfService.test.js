import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const createDocMock = () => {
    let pages = 1
    const doc = {
      setFillColor: vi.fn(),
      rect: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
      roundedRect: vi.fn(),
      addPage: vi.fn(() => {
        pages += 1
      }),
      getNumberOfPages: vi.fn(() => pages),
      setPage: vi.fn(),
      setProperties: vi.fn(),
      splitTextToSize: vi.fn((value) => (Array.isArray(value) ? value : String(value).split('\n'))),
      output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
    }

    return doc
  }

  return {
    mockJsPdf: vi.fn(function JsPdfMock() {
      return createDocMock()
    }),
    mockAutoTable: vi.fn(),
    mockBuildConsultationPdfData: vi.fn(),
    mockPdfData: {
      title: 'Consulta Medica',
      period: '30d',
      generatedAtLabel: '24/03/2026 10:30',
      patient: {
        name: 'Joao Silva',
        age: 45,
      },
      summaryCards: [
        { label: 'Adesao 30d', value: '82%', meta: '24/30 doses', tone: 'success' },
        { label: 'Adesao 90d', value: '76%', meta: '72/90 doses', tone: 'warning' },
        { label: 'Pontualidade', value: '90%', meta: 'Janela de tolerancia', tone: 'success' },
        { label: 'Tratamentos ativos', value: '2', meta: '2 medicamentos', tone: 'info' },
        { label: 'Alertas criticos', value: '1', meta: '1 em atencao', tone: 'danger' },
        { label: 'Titulacoes', value: '1', meta: '1 vencendo', tone: 'warning' },
      ],
      activeTreatments: [
        {
          label: 'Hipertensao - Losartana',
          presentation: '50 mg por comprimido',
          dosePerIntake: '2 comprimidos (100 mg)',
          frequency: '2x/dia',
          dailyDose: '200 mg/dia',
          status: 'Ativo',
        },
      ],
      adherence: {
        last30d: { score: 82, taken: 24, expected: 30, punctuality: 90 },
        last90d: { score: 76, taken: 72, expected: 90, punctuality: 85 },
        trend7d: [
          { label: '18/03', taken: 1, expected: 2, score: 50, status: 'Atencao' },
          { label: '19/03', taken: 2, expected: 2, score: 100, status: 'Excelente' },
        ],
      },
      stockRows: [
        {
          label: 'Hipertensao - Losartana',
          totalQuantity: 4,
          dailyIntake: 4,
          daysRemaining: 1,
          severity: 'warning',
          message: 'Estoque baixo',
        },
      ],
      prescriptionRows: [
        {
          label: 'Hipertensao - Losartana',
          status: 'vigente',
          statusLabel: 'Vigente',
          daysRemaining: 20,
          endDate: '2026-04-13',
        },
      ],
      titrationRows: [
        {
          label: 'Ansiedade - Ansitec',
          currentStep: 2,
          totalSteps: 3,
          currentDosage: 1,
          progressPercent: 67,
          daysRemaining: 2,
          isTransitionDue: true,
          stageNote: 'Aumentar a dose',
        },
      ],
      attentionItems: [
        { label: 'Hipertensao - Losartana', detail: 'Estoque baixo: 1 dias', tone: 'warning' },
      ],
      clinicalNotes: ['Sem alergias registradas no cartao de emergencia', 'Tipo sanguineo: O+'],
    },
  }
})

vi.mock('../consultationPdfDataBuilder.js', () => ({
  buildConsultationPdfData: mocks.mockBuildConsultationPdfData,
}))

vi.mock('jspdf', () => ({
  jsPDF: mocks.mockJsPdf,
}))

vi.mock('jspdf-autotable', () => ({
  default: mocks.mockAutoTable,
}))

import { generateConsultationPDF } from '../consultationPdfService.js'

describe('consultationPdfService', () => {
  beforeEach(() => {
    mocks.mockJsPdf.mockImplementation(function JsPdfMock() {
      let pages = 1
      return {
        setFillColor: vi.fn(),
        rect: vi.fn(),
        setFontSize: vi.fn(),
        setTextColor: vi.fn(),
        text: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        line: vi.fn(),
        roundedRect: vi.fn(),
        addPage: vi.fn(() => {
          pages += 1
        }),
        getNumberOfPages: vi.fn(() => pages),
        setPage: vi.fn(),
        setProperties: vi.fn(),
        splitTextToSize: vi.fn((value) => (Array.isArray(value) ? value : String(value).split('\n'))),
        output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
      }
    })
    mocks.mockAutoTable.mockClear()
    mocks.mockBuildConsultationPdfData.mockClear()
  })

  it('gera um blob de PDF usando o builder e imports dinamicos', async () => {
    mocks.mockBuildConsultationPdfData.mockReturnValue(mocks.mockPdfData)

    const blob = await generateConsultationPDF({
      consultationData: { patientInfo: { name: 'Joao Silva' } },
      dashboardData: { medicines: [], protocols: [], logs: [], stockSummary: [] },
      period: '30d',
      title: 'Consulta Medica',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(mocks.mockBuildConsultationPdfData).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationData: { patientInfo: { name: 'Joao Silva' } },
        period: '30d',
        title: 'Consulta Medica',
      })
    )
    expect(mocks.mockJsPdf).toHaveBeenCalledTimes(1)
    expect(mocks.mockAutoTable).toHaveBeenCalled()

    const doc = mocks.mockJsPdf.mock.results[0].value
    expect(doc.setProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Consulta Medica',
        subject: 'Consulta medica',
      })
    )
    expect(doc.splitTextToSize).toHaveBeenCalledWith('Consulta Medica', expect.any(Number))
    expect(doc.splitTextToSize).toHaveBeenCalledWith('Joao Silva', expect.any(Number))
    expect(doc.output).toHaveBeenCalledWith('blob')
    expect(doc.setPage).toHaveBeenCalled()
  })
})
