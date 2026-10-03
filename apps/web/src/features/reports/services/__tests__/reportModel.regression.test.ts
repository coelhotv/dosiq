// Regressão dos números herdados (spec 097 PO-1, C-2 do A1): o montador novo do core deve dar os
// MESMOS números que o builder legado do PDF web para a mesma entrada — vigência por data (064),
// dose por tomada (073), dose total no ciclo (085), dose-only (044) e "dura até" do estoque.
// Vive na web porque o core não importa a web. Apagado junto com o legado no Slice A2.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportModel, type ReportInputs, type ReportMedicineRow, type ReportProtocolRow } from '@dosiq/core'
import { buildConsultationPdfData } from '../consultationPdfDataBuilder'

const med = (over: Partial<ReportMedicineRow> & { id: string; name: string }): ReportMedicineRow => ({
  active_ingredient: null,
  dosage_per_pill: null,
  dosage_unit: 'mg',
  units_per_ml: null,
  concentration_volume_ml: null,
  presentation: 'comprimido',
  type: 'medicamento',
  shelf_life_days: null,
  archived_at: null,
  ...over,
})

const proto = (over: Partial<ReportProtocolRow> & { id: string; medicine_id: string }): ReportProtocolRow => ({
  name: `T ${over.id}`,
  frequency: 'diário',
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  interval_days: null,
  weekdays: null,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  paused_at: null,
  archived_at: null,
  ...over,
})

// Cobre os formatos que já foram bug: sólido 2x/dia, insulina U-100 (UI), GLP-1 semanal em mg,
// trimestral em mL, PRN, encerrado antes do fim, começa depois do fim, pausado.
const MEDICINES = [
  med({ id: 'm_met', name: 'Glifage', dosage_per_pill: 850 }),
  med({ id: 'm_ins', name: 'Lantus', presentation: 'injetavel', dosage_unit: 'ui/ml', dosage_per_pill: 100, units_per_ml: 100 }),
  med({ id: 'm_glp', name: 'Ozempic', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 1.34 }),
  med({ id: 'm_tri', name: 'Depo', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 150 }),
  med({ id: 'm_prn', name: 'Dipirona', dosage_per_pill: 500 }),
  med({ id: 'm_end', name: 'Amoxil', dosage_per_pill: 500 }),
  med({ id: 'm_fut', name: 'Futuro', dosage_per_pill: 10 }),
  med({ id: 'm_pau', name: 'Puran', dosage_per_pill: 50, dosage_unit: 'mcg' }),
]
const PROTOCOLS = [
  proto({ id: 'p_met', medicine_id: 'm_met', time_schedule: ['08:00', '20:00'] }),
  proto({ id: 'p_ins', medicine_id: 'm_ins', time_schedule: ['22:00'], intake_unit: 'UI', dosage_per_intake: 10 }),
  proto({ id: 'p_glp', medicine_id: 'm_glp', frequency: 'semanal', intake_unit: 'mg', dosage_per_intake: 0.5, weekdays: ['seg'] }),
  proto({ id: 'p_tri', medicine_id: 'm_tri', frequency: 'personalizado', interval_days: 90, intake_unit: 'ml', dosage_per_intake: 1 }),
  proto({ id: 'p_prn', medicine_id: 'm_prn', frequency: 'quando_necessário', time_schedule: [] }),
  proto({ id: 'p_end', medicine_id: 'm_end', end_date: '2026-09-20' }),
  proto({ id: 'p_fut', medicine_id: 'm_fut', start_date: '2026-10-15' }),
  proto({ id: 'p_pau', medicine_id: 'm_pau', active: false, paused_at: '2026-09-25T10:00:00-03:00' }),
]
const STOCK = [
  { medicine_id: 'm_met', total_quantity: 45 },
  { medicine_id: 'm_ins', total_quantity: 3 },
]

const AS_OF = '2026-09-30'

function newInputs(stockTrackingEnabled: boolean): ReportInputs {
  return {
    window: { from: '2026-09-01', to: AS_OF, days: 30 },
    timezone: 'America/Sao_Paulo',
    profile: { displayName: null, birthDate: null, allergies: [], bloodType: null },
    stockTrackingEnabled,
    protocols: PROTOCOLS,
    medicines: MEDICINES,
    doseDays: [],
    titrationSteps: [],
    stockTotals: STOCK,
    biomarkers: [],
    medicineLogs: [],
  }
}

function legacy(stockTrackingEnabled: boolean) {
  return buildConsultationPdfData({
    consultationData: {},
    dashboardData: {
      protocols: PROTOCOLS,
      medicines: MEDICINES,
      stockTrackingEnabled,
      stockSummary: STOCK.map((s) => ({ medicine: { id: s.medicine_id }, total: s.total_quantity })),
    },
    period: '30d',
    // Fim do período ≠ hoje: o legado recalcula o estoque em asOf, como o novo (sem pré-cálculo).
    generatedAt: AS_OF,
  })
}

describe('regressão 097 PO-1 — números herdados do PDF legado', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('mesmo conjunto de tratamentos vigentes no fim do período (064, 073/F-18)', () => {
    const old = legacy(true).activeTreatments.map((r) => r.id).sort()
    const neu = buildReportModel(newInputs(true), { generatedAt: AS_OF }).medications.map((r) => r.protocolId).sort()
    expect(neu).toEqual(old)
    expect(neu).not.toContain('p_end')
    expect(neu).not.toContain('p_fut')
  })

  it('mesma dose por tomada e mesma dose total no ciclo, tratamento a tratamento (073/F-17, 085)', () => {
    const old = new Map(legacy(true).activeTreatments.map((r) => [r.id, r]))
    const neu = buildReportModel(newInputs(true), { generatedAt: AS_OF }).medications
    expect(neu.length).toBeGreaterThan(0)
    for (const row of neu) {
      const o = old.get(row.protocolId)
      expect({ id: row.protocolId, dose: row.dosePerIntake, cycle: row.cycleDose }).toEqual({
        id: row.protocolId,
        dose: o?.dosePerIntake,
        cycle: o?.cycleDose,
      })
    }
  })

  it('mesmo "dura até" do estoque em asOf (064/US2)', () => {
    const old = new Map(legacy(true).stockRows.map((r) => [r.id, r.daysRemaining]))
    const neu = buildReportModel(newInputs(true), { generatedAt: AS_OF }).stock ?? []
    expect(neu.length).toBe(2)
    for (const row of neu) expect(row.daysRemaining).toBe(old.get(row.medicineId))
  })

  it('dose-only: os dois sem estoque (044)', () => {
    expect(legacy(false).stockRows).toEqual([])
    expect(buildReportModel(newInputs(false), { generatedAt: AS_OF }).stock).toBeNull()
  })
})
