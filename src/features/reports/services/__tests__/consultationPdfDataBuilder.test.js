import { describe, it, expect } from 'vitest'
import { addDays, formatLocalDate } from '@utils/dateUtils.js'
import {
  buildConsultationPdfData,
  formatTreatmentLabel,
  formatMedicinePresentation,
  formatIntakeDose,
  formatFrequency,
  formatDailyDose,
} from '../consultationPdfDataBuilder.js'

describe('consultationPdfDataBuilder', () => {
  const now = new Date()
  const past = formatLocalDate(addDays(now, -20))
  const future = formatLocalDate(addDays(now, 20))

  const medicines = [
    {
      id: 'med-1',
      name: 'Losartana',
      dosage_per_pill: 50,
      dosage_unit: 'mg',
      notes: 'Tomar ao acordar',
    },
    {
      id: 'med-2',
      name: 'Ansitec',
      dosage_per_pill: 10,
      dosage_unit: 'mg',
    },
  ]

  const protocols = [
    {
      id: 'prot-1',
      name: 'Hipertensao',
      medicine_id: 'med-1',
      active: true,
      dosage_per_intake: 2,
      time_schedule: ['08:00', '20:00'],
      start_date: past,
      end_date: future,
    },
    {
      id: 'prot-2',
      name: 'Ansiedade',
      medicine_id: 'med-2',
      active: true,
      dosage_per_intake: 1,
      time_schedule: ['22:00'],
      titration_schedule: [{ dosage: 1, days: 3 }],
      start_date: past,
      end_date: future,
    },
  ]

  const consultationData = {
    patientInfo: {
      name: 'Joao Silva',
      age: 45,
      emergencyCard: {
        allergies: ['Penicilina'],
        blood_type: 'O+',
      },
    },
    adherenceSummary: {
      last30d: { score: 82, taken: 24, expected: 30, punctuality: 90 },
      last90d: { score: 76, taken: 72, expected: 90, punctuality: 85 },
    },
    stockAlerts: [
      { medicineId: 'med-1', medicineName: 'Losartana', severity: 'warning', daysRemaining: 1 },
      { medicineId: 'med-2', medicineName: 'Ansitec', severity: 'critical', daysRemaining: 0 },
    ],
    prescriptionStatus: [
      { protocolId: 'prot-1', status: 'vigente', daysRemaining: 20, endDate: future },
      { protocolId: 'prot-2', status: 'vencendo', daysRemaining: 4, endDate: future },
    ],
    activeTitrations: [
      {
        protocolId: 'prot-2',
        medicineId: 'med-2',
        medicineName: 'Ansitec',
        currentStep: 2,
        totalSteps: 3,
        currentDay: 5,
        totalDays: 7,
        progressPercent: 67,
        isTransitionDue: true,
        stageNote: 'Aumentar a dose',
        daysRemaining: 2,
        currentDosage: 1,
      },
    ],
  }

  const dashboardData = {
    medicines,
    protocols,
    logs: [],
    stockSummary: [
      {
        medicine: { id: 'med-1', name: 'Losartana' },
        total: 0,
        dailyIntake: 4,
        daysRemaining: 0,
        isZero: true,
        isLow: false,
      },
      {
        medicine: { id: 'med-2', name: 'Ansitec' },
        total: 20,
        dailyIntake: 1,
        daysRemaining: 20,
        isZero: false,
        isLow: false,
      },
    ],
  }

  it('formata labels e doses clinicas corretamente', () => {
    const protocol = protocols[0]
    const medicine = medicines[0]

    expect(formatTreatmentLabel(protocol, medicine)).toBe('Hipertensao - Losartana')
    expect(formatMedicinePresentation(medicine)).toBe('50 mg por comprimido')
    expect(formatIntakeDose(protocol, medicine)).toBe('2 comprimidos (100 mg)')
    expect(formatFrequency(protocol)).toBe('2x/dia • 08:00, 20:00')
    expect(formatDailyDose(protocol, medicine)).toBe('200 mg/dia')
  })

  it('monta o modelo editorial do PDF com resumo, tratamentos e alertas', () => {
    const pdfData = buildConsultationPdfData({
      consultationData,
      dashboardData,
      period: '30d',
      generatedAt: new Date('2026-03-24T10:30:00'),
      title: 'Consulta Medica',
    })

    expect(pdfData.title).toBe('Consulta Medica')
    expect(pdfData.period).toBe('30d')
    expect(pdfData.patient.name).toBe('Joao Silva')
    expect(pdfData.summaryCards).toHaveLength(6)
    expect(pdfData.activeTreatments).toHaveLength(2)
    expect(pdfData.activeTreatments[0]).toMatchObject({
      label: 'Ansiedade - Ansitec',
      presentation: '10 mg por comprimido',
      dosePerIntake: '1 comprimido (10 mg)',
      frequency: '1x/dia • 22:00',
      dailyDose: '10 mg/dia',
      status: 'Ativo',
    })
    expect(pdfData.stockRows[0].severity).toBe('critical')
    expect(pdfData.prescriptionRows[0]).toMatchObject({
      label: 'Hipertensao - Losartana',
      statusLabel: 'Vigente',
    })
    expect(pdfData.titrationRows).toHaveLength(1)
    expect(pdfData.attentionItems.length).toBeGreaterThan(0)
    expect(pdfData.adherence.trend7d).toHaveLength(7)
    expect(pdfData.clinicalNotes[0]).toContain('Penicilina')
  })
})
