import { describe, it, expect } from 'vitest'
import { addDays, formatLocalDate } from '@utils/dateUtils'
import {
  buildConsultationPdfData,
  formatTreatmentLabel,
} from '@/features/reports/services/consultationPdfDataBuilder'

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
      intake_unit: null,
      frequency: 'diário',
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
      intake_unit: null,
      frequency: 'diário',
      time_schedule: ['22:00'],
      // 029 F6: era `titration_schedule: [{ dosage: 1, days: 3 }]` (jsonb N1 dropado). A nota
      // do PDF deixou de derivar da titulação — ver o comentário no builder: os tratamentos
      // desta rota trazem só o RECORTE da escada por `protocol_id` (AP-311), e nota instável
      // num documento clínico é pior que nota ausente.
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
      last30d: { score: 82, taken: 24, expected: 30, punctuality: 90, currentStreak: 7 },
      last90d: { score: 76, taken: 72, expected: 90, punctuality: 85, currentStreak: 7 },
      currentStreak: 7,
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
    dailyAdherence: [],
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

  it('formata dose, cadencia e status pelos formatadores do core (073 F-1/F-2/F-17/F-18)', () => {
    // 🔴 073/E-6: este teste TRAVAVA o bug — afirmava '2 comprimidos (100 mg)' para uma dose
    // que já vinha em massa e '1x/dia' para tratamento semanal. As asserções foram invertidas:
    // agora ele falha se alguém reintroduzir um formatador local.
    const generatedAt = new Date(`${formatLocalDate(now)}T10:30:00`)
    const clinicalMedicines = [
      { id: 'm-lantus', name: 'Lantus', dosage_per_pill: 100, dosage_unit: 'ui/ml' },
      { id: 'm-ozem', name: 'Ozempic', dosage_per_pill: 2.68, dosage_unit: 'mg/ml' },
      { id: 'm-dip', name: 'Dipirona', dosage_per_pill: 500, dosage_unit: 'mg/ml' },
      { id: 'm-selo', name: 'Selozok', dosage_per_pill: 25, dosage_unit: 'mg' },
    ]
    const clinicalProtocols = [
      {
        id: 'p-lantus', name: 'Diabetes', medicine_id: 'm-lantus', active: true,
        dosage_per_intake: 10, intake_unit: 'UI', frequency: 'diário',
        time_schedule: ['22:00'], start_date: past, end_date: future,
      },
      {
        id: 'p-ozem', name: 'GLP-1', medicine_id: 'm-ozem', active: true,
        dosage_per_intake: 2.4, intake_unit: 'mg', frequency: 'semanal',
        time_schedule: ['09:00'], start_date: past, end_date: future,
      },
      {
        // Par de NÃO-OMISSÃO invertido: encerrado antes da geração ⇒ fora da listagem.
        id: 'p-dip', name: 'Dor', medicine_id: 'm-dip', active: true,
        dosage_per_intake: 15, intake_unit: 'gotas', frequency: 'diário',
        time_schedule: ['08:00'], start_date: past,
        end_date: formatLocalDate(addDays(now, -4)),
      },
      {
        id: 'p-selo', name: 'Pressao', medicine_id: 'm-selo', active: true,
        dosage_per_intake: 1, intake_unit: null, frequency: 'diário',
        time_schedule: ['08:00', '20:00'], start_date: past, end_date: future,
      },
    ]

    const pdfData = buildConsultationPdfData({
      consultationData: {},
      dashboardData: { medicines: clinicalMedicines, protocols: clinicalProtocols },
      generatedAt,
    })
    const byLabel = Object.fromEntries(pdfData.activeTreatments.map((row) => [row.label, row]))

    expect(formatTreatmentLabel(clinicalProtocols[0], clinicalMedicines[0])).toBe('Diabetes - Lantus')

    // F-17: a dose de tomada NÃO é multiplicada pela concentração quando já vem em massa.
    expect(byLabel['Diabetes - Lantus']).toMatchObject({
      presentation: '100 UI/mL',
      dosePerIntake: '10 UI (≈ 0,1 mL)',
      frequency: 'Diário • 1 tomada • 22:00',
      dailyDose: '10 UI (≈ 0,1 mL) por dia',
      status: 'Vigente',
    })
    expect(byLabel['Diabetes - Lantus'].dosePerIntake).not.toContain('1.000')

    // F-2/E-1: semanal deixa de ser tratado como diário — a média do dia usa o fator 1/7,
    // o MESMO que a página de estoque deste documento já aplicava (2,4 ÷ 7 ≈ 0,343 mg).
    expect(byLabel['GLP-1 - Ozempic']).toMatchObject({
      dosePerIntake: '2,4 mg (≈ 0,9 mL)',
      frequency: 'Semanal • 1 tomada • 09:00',
      dailyDose: '0,343 mg (≈ 0,13 mL) por dia',
    })

    // F-1: nada de " por comprimido" colado em caneta/frasco.
    expect(byLabel['GLP-1 - Ozempic'].presentation).toBe('2,68 mg/mL')

    // F-18: o encerrado some da listagem (e não sai "Ativo" na pág. 2 e "Vencida" na pág. 5).
    expect(byLabel['Dor - Dipirona']).toBeUndefined()

    // RC5: PRN não ganha cadência nem "dose diária" inventadas.
    const prn = buildConsultationPdfData({
      consultationData: {},
      dashboardData: {
        medicines: [{ id: 'm-prn', name: 'Dipirona', dosage_per_pill: 500, dosage_unit: 'mg' }],
        protocols: [{
          id: 'p-prn', name: 'Dor', medicine_id: 'm-prn', active: true,
          dosage_per_intake: 1, intake_unit: null, frequency: 'quando_necessário',
          time_schedule: ['08:00'], start_date: past, end_date: future,
        }],
      },
      generatedAt,
    })
    expect(prn.activeTreatments[0]).toMatchObject({
      frequency: 'Quando Necessário',
      dailyDose: 'sob demanda',
    })

    // Par de não-omissão: o sólido vigente continua presente e correto.
    expect(byLabel['Pressao - Selozok']).toMatchObject({
      presentation: '25 mg',
      dosePerIntake: '1 un. (25 mg)',
      dailyDose: '2 un. (50 mg) por dia',
      status: 'Vigente',
    })

    // F-22 (parte numérica): o card da pág. 1 conta o MESMO conjunto da tabela da pág. 2.
    const treatmentsCard = pdfData.summaryCards.find((c) => c.label === 'Tratamentos vigentes')
    expect(treatmentsCard.value).toBe(String(pdfData.activeTreatments.length))
    expect(treatmentsCard.value).toBe('3')
  })

  it('monta o modelo editorial do PDF com resumo, tratamentos e alertas', () => {
    const pdfData = buildConsultationPdfData({
      consultationData,
      dashboardData,
      period: '30d',
      // 073: a vigência é avaliada em `generatedAt` (R-299). O fixture é relativo a hoje,
      // então a data de geração tem de ser hoje — com a data fixa antiga o teste passaria a
      // afirmar "nenhum tratamento vigente", que é o oposto do que ele quer provar.
      generatedAt: new Date(`${formatLocalDate(now)}T10:30:00`),
      title: 'Consulta Medica',
    })

    expect(pdfData.title).toBe('Consulta Medica')
    expect(pdfData.period).toBe('30d')
    expect(pdfData.patient.name).toBe('Joao Silva')
    expect(pdfData.patient.handle).toBeNull()
    // 073/F-22: 6, não 7 — o card "Adesão 30d" some quando o período selecionado JÁ é 30 dias
    // (era a mesma métrica impressa duas vezes) e "Pontualidade" só entra se for distinta.
    expect(pdfData.summaryCards).toHaveLength(6)
    expect(pdfData.summaryCards.map((card) => card.label)).not.toContain('Adesão 30d')
    expect(pdfData.activeTreatments).toHaveLength(2)
    expect(pdfData.activeTreatments[0]).toMatchObject({
      label: 'Ansiedade - Ansitec',
      presentation: '10 mg',
      dosePerIntake: '1 un. (10 mg)',
      frequency: 'Diário • 1 tomada • 22:00',
      dailyDose: '1 un. (10 mg) por dia',
      status: 'Vigente',
    })
    expect(pdfData.stockRows[0].severity).toBe('critical')
    expect(pdfData.prescriptionRows[0]).toMatchObject({
      label: 'Hipertensao - Losartana',
      statusLabel: 'Vigente',
    })
    expect(pdfData.titrationRows).toHaveLength(1)
    expect(pdfData.attentionItems.length).toBeGreaterThan(0)
    expect(pdfData.adherence.trend).toHaveLength(30)
    expect(pdfData.adherence.trendLabel).toBe('30 dias')
    expect(pdfData.adherence.selectedPeriod).toMatchObject({
      label: '30 dias',
      score: 82,
      taken: 24,
      expected: 30,
    })
    expect(pdfData.summaryCards[0]).toMatchObject({
      label: 'Adesão 30 dias',
      value: '82%',
      meta: '24/30 doses',
    })
    expect(pdfData.clinicalNotes[0]).toContain('Penicilina')
  })

  it('imprime estoque e receitas em linguagem legivel (073 F-19/F-21)', () => {
    const generatedAt = new Date(`${formatLocalDate(now)}T10:30:00`)
    const overdue = formatLocalDate(addDays(now, -3))
    const pdfData = buildConsultationPdfData({
      consultationData: {
        prescriptionStatus: [
          { protocolId: 'prot-1', status: 'vencida', daysRemaining: -3, endDate: overdue },
          { protocolId: 'prot-2', status: 'vencendo', daysRemaining: 1, endDate: future },
        ],
      },
      dashboardData: {
        medicines: [
          { id: 'med-liq', name: 'Ozempic', dosage_per_pill: 2.68, dosage_unit: 'mg/ml' },
        ],
        protocols: [
          {
            id: 'p-liq', name: 'GLP-1', medicine_id: 'med-liq', active: true,
            dosage_per_intake: 2.4, intake_unit: 'mg', frequency: 'semanal',
            time_schedule: ['09:00'], start_date: past, end_date: future,
          },
        ],
        stockSummary: [
          {
            medicine: { id: 'med-liq', name: 'Ozempic' },
            total: 3, dailyIntake: 0.12786, daysRemaining: 23, isZero: false, isLow: false,
          },
        ],
      },
      generatedAt,
    })

    // F-19: número pt-BR com no máximo 2 casas E a unidade — não "0.1278656716417910".
    expect(pdfData.stockRows[0]).toMatchObject({
      totalQuantityLabel: '3 mL',
      dailyIntakeLabel: '0,13 mL',
    })

    // F-21: nada de "-3"; data em dd/mm/aaaa (R-020 — parseLocalDate, não UTC midnight).
    expect(pdfData.prescriptionRows[0].daysLabel).toBe('vencida há 3 dias')
    expect(pdfData.prescriptionRows[0].endDateLabel).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    expect(pdfData.prescriptionRows[1].daysLabel).toBe('1 dia')
  })

  it('declara a titulacao em manutencao no PDF (073 F-24)', () => {
    const pdfData = buildConsultationPdfData({
      consultationData: {
        activeTitrations: [
          {
            protocolId: 'prot-2',
            medicineId: 'med-2',
            medicineName: 'Ansitec',
            isMaintenance: true,
            currentStep: 4,
            totalSteps: 4,
            progressPercent: null,
            isTransitionDue: false,
            daysRemaining: null,
            currentDosage: 2.4,
            currentDoseLabel: '2,4 mg',
            maintenanceSince: '11/03/2026',
            stageNote: null,
          },
        ],
      },
      dashboardData,
      generatedAt: new Date(`${formatLocalDate(now)}T10:30:00`),
    })

    // O gate do PDF é `titrationRows.length > 0`: a linha PRECISA existir, senão o documento
    // não menciona a escada que o paciente subiu.
    expect(pdfData.titrationRows).toHaveLength(1)
    expect(pdfData.titrationRows[0]).toMatchObject({
      progressLabel: 'dose alvo',
      stageLabel: '4/4',
      isMaintenance: true,
    })
    expect(pdfData.titrationRows[0].stageNote).toBe('Dose alvo: 2,4 mg desde 11/03/2026')
  })

  it('prefere a serie diaria consolidada do dashboard quando disponivel', () => {
    const dailyAdherence = [
      { date: past, taken: 8, expected: 10, adherence: 80 },
      { date: future, taken: 10, expected: 10, adherence: 100 },
    ]

    const pdfData = buildConsultationPdfData({
      consultationData,
      dashboardData: {
        ...dashboardData,
        dailyAdherence,
      },
      period: '7d',
      generatedAt: new Date(`${formatLocalDate(now)}T10:30:00`),
      title: 'Consulta Medica',
    })

    expect(pdfData.adherence.trend.slice(-2)).toEqual([
      expect.objectContaining({ taken: 8, expected: 10, score: 80 }),
      expect.objectContaining({ taken: 10, expected: 10, score: 100 }),
    ])
    expect(pdfData.adherence.selectedPeriod).toMatchObject({
      label: '7 dias',
      score: 90,
      taken: 18,
      expected: 20,
    })
  })

  it('usa o handle do email como fallback quando o nome nao existe', () => {
    const pdfData = buildConsultationPdfData({
      consultationData: {
        ...consultationData,
        patientInfo: {
          ...consultationData.patientInfo,
          name: '',
        },
      },
      dashboardData,
      period: '30d',
      generatedAt: new Date('2026-03-24T10:30:00'),
      title: 'Consulta Medica',
      patientEmail: 'joao.silva@email.com',
    })

    expect(pdfData.patient.name).toBe('Joao Silva')
    expect(pdfData.patient.handle).toBe('joao.silva')
  })

  it('conta a adesao diaria por evento de dose, nao por quantidade de comprimidos', () => {
    const today = formatLocalDate(new Date())
    const dailyProtocol = {
      id: 'prot-3',
      name: 'Dor',
      medicine_id: 'med-1',
      active: true,
      dosage_per_intake: 2,
      time_schedule: ['08:00'],
      start_date: past,
      end_date: future,
    }

    const pdfData = buildConsultationPdfData({
      consultationData: {
        ...consultationData,
      },
      dashboardData: {
        ...dashboardData,
        protocols: [dailyProtocol],
        logs: [
          {
            id: 'log-1',
            protocol_id: 'prot-3',
            medicine_id: 'med-1',
            taken_at: new Date(`${today}T08:10:00-03:00`).toISOString(),
            quantity_taken: 2,
          },
        ],
      },
      period: '7d',
      generatedAt: new Date(`${formatLocalDate(now)}T10:30:00`),
      title: 'Consulta Medica',
    })

    const todayRow = pdfData.adherence.trend[pdfData.adherence.trend.length - 1]
    expect(todayRow.taken).toBe(1)
    expect(todayRow.expected).toBe(1)
    expect(todayRow.score).toBe(100)
  })
})
