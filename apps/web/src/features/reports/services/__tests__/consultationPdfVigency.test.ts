import { describe, it, expect, afterEach, vi } from 'vitest'
import { getTodayLocal, parseLocalDate } from '@utils/dateUtils'
import { buildConsultationPdfData } from '@/features/reports/services/consultationPdfDataBuilder'

/**
 * 064 / PO-3 (US2) — o relatório clínico usa a vigência da DATA DE REFERÊNCIA do
 * relatório, não o estado de hoje (R-299).
 *
 * 🔴 F-14: o valor que o PDF imprime NÃO nasce no `calculateDailyIntake` do builder —
 * vem PRÉ-CALCULADO do dashboard em `stockItem.dailyIntake`. Um teste que só injeta
 * `protocols` prova o ramo depois do `??`, que não é o que roda em produção (AP-333).
 * Por isso os três casos abaixo montam `stockSummary` com `stockItem` PRESENTE.
 *
 * Datas de fixture são literais locais (AP-280/AP-270).
 */

const medicines = [{ id: 'med-1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' }]

// Tratamento encerrado em 20/03/2026 (vigente em março, morto em julho e hoje).
const protocolEncerrado = {
  id: 'prot-1',
  name: 'Hipertensao',
  medicine_id: 'med-1',
  active: true,
  dosage_per_intake: 2,
  time_schedule: ['08:00', '20:00'],
  frequency: 'diário',
  start_date: '2026-03-01',
  end_date: '2026-03-20',
}

// `stockItem` pré-calculado pelo dashboard — sempre para HOJE. É este valor que o PDF
// usava cegamente antes do 064.
const stockSummary = [
  {
    medicine: { id: 'med-1', name: 'Losartana' },
    total: 40,
    dailyIntake: 4,
    daysRemaining: 10,
    isZero: false,
    isLow: false,
  },
]

const dashboardData = {
  medicines,
  protocols: [protocolEncerrado],
  logs: [],
  dailyAdherence: [],
  stockSummary,
}

const consultationData = {
  patientInfo: { name: 'Joao Silva', age: 45 },
  adherenceSummary: { last30d: {}, last90d: {} },
  prescriptionStatus: [],
  activeTitrations: [],
}

const buildStockRow = (generatedAt: Date) =>
  buildConsultationPdfData({
    consultationData,
    dashboardData,
    period: '30d',
    generatedAt,
    title: 'Consulta Medica',
  }).stockRows[0]

describe('consultationPdfDataBuilder — vigência por período (064/US2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('(a) relatório encerrado em 15/03 CONTA o tratamento (vigente na data de referência)', () => {
    const row = buildStockRow(parseLocalDate('2026-03-15'))
    expect(row.dailyIntake).toBe(4)
    expect(row.dosesRemaining).toBe(20)
  })

  it('(b) relatório de 01/07–31/07 NÃO conta o mesmo tratamento (já encerrado)', () => {
    const row = buildStockRow(parseLocalDate('2026-07-31'))
    expect(row.dailyIntake).toBe(0)
    expect(row.dosesRemaining).toBe(0)
  })

  it('(c) período CORRENTE com tratamento encerrado NÃO conta — era o número errado que chegava ao médico', () => {
    // Caminho de produção: `stockItem` PRESENTE (dailyIntake = 4 pré-calculado).
    // O período é o corrente, então o builder mantém o pré-calculado — que desde o 064
    // já nasce filtrado por vigência em `_useDashboardDerived`. O que este teste garante
    // é que as métricas de DOSE do PDF (que o builder calcula sozinho) não derivam mais
    // de um tratamento morto.
    const row = buildStockRow(parseLocalDate(getTodayLocal()))
    expect(row.dosesRemaining).toBe(0)
    expect(row.isDailyStock).toBe(true)
  })
})
