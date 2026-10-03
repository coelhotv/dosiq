// Fixture compartilhada do relatório clínico (spec 097): janela de 7 dias (24–30/09/2026,
// America/Sao_Paulo). Datas locais literais; instantes com offset -03 explícito (AP-270).
// Inclui 1 tratamento arquivado e 1 pausado.
import type {
  ReportDoseDayRow,
  ReportInputs,
  ReportMedicineRow,
  ReportProtocolRow,
} from '../reportTypes'

export const med = (over: Partial<ReportMedicineRow> & { id: string; name: string }): ReportMedicineRow => ({
  active_ingredient: null,
  dosage_per_pill: null,
  dosage_unit: 'mg',
  units_per_ml: null,
  concentration_volume_ml: null,
  presentation: 'comprimido',
  type: 'medicamento',
  archived_at: null,
  ...over,
})

export const proto = (over: Partial<ReportProtocolRow> & { id: string; medicine_id: string }): ReportProtocolRow => ({
  name: null,
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

export const dd = (protocol_id: string, medicine_id: string, day: string, slot: string, c: Partial<ReportDoseDayRow>): ReportDoseDayRow => ({
  protocol_id,
  medicine_id,
  day,
  slot,
  taken_count: 0,
  missed_count: 0,
  paused_count: 0,
  skipped_count: 0,
  pending_count: 0,
  ...c,
})

export const DAYS = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']

export function fixture(over: Partial<ReportInputs> = {}): ReportInputs {
  const medicines = [
    med({ id: 'm_met', name: 'Glifage', active_ingredient: 'Metformina', dosage_per_pill: 850 }),
    med({ id: 'm_moun', name: 'Mounjaro', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 10, concentration_volume_ml: 0.5 }),
    med({ id: 'm_lev', name: 'Puran', dosage_per_pill: 50, dosage_unit: 'mcg' }),
    med({ id: 'm_old', name: 'Losartana', dosage_per_pill: 50 }),
  ]
  const protocols = [
    proto({ id: 'p_met', medicine_id: 'm_met', time_schedule: ['08:00', '20:00'] }),
    proto({ id: 'p_moun', medicine_id: 'm_moun', frequency: 'semanal', time_schedule: ['09:00'], intake_unit: 'mg', dosage_per_intake: 5, start_date: '2026-08-01', end_date: '2026-10-05' }),
    // pausado hoje: active=false (pausar grava active=false — adherenceLogic.ts:360)
    proto({ id: 'p_lev', medicine_id: 'm_lev', time_schedule: ['07:00'], active: false, paused_at: '2026-09-27T10:00:00-03:00' }),
    // arquivado (094) no dia 27
    proto({ id: 'p_old', medicine_id: 'm_old', active: false, archived_at: '2026-09-27T15:00:00-03:00' }),
  ]
  const doseDays: ReportDoseDayRow[] = [
    ...DAYS.flatMap((d, i) => [
      dd('p_met', 'm_met', d, '08:00', { taken_count: 1 }),
      // noite: falta no dia 25 e no dia 29
      dd('p_met', 'm_met', d, '20:00', i === 1 || i === 5 ? { missed_count: 1 } : { taken_count: 1 }),
    ]),
    dd('p_moun', 'm_moun', '2026-09-25', '09:00', { taken_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-24', '07:00', { taken_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-25', '07:00', { taken_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-26', '07:00', { missed_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-27', '07:00', { paused_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-28', '07:00', { paused_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-29', '07:00', { skipped_count: 1 }),
    dd('p_old', 'm_old', '2026-09-24', '08:00', { taken_count: 1 }),
    dd('p_old', 'm_old', '2026-09-25', '08:00', { taken_count: 1 }),
    dd('p_old', 'm_old', '2026-09-26', '08:00', { taken_count: 1 }),
    // hoje ainda pendente: fora do denominador (ADR-054)
    dd('p_met', 'm_met', '2026-09-30', '22:00', { pending_count: 1 }),
  ]
  return {
    window: { from: '2026-09-24', to: '2026-09-30', days: 7 },
    timezone: 'America/Sao_Paulo',
    profile: { displayName: 'Ana', birthDate: '1960-05-02', allergies: ['Dipirona'], bloodType: null },
    stockTrackingEnabled: true,
    protocols,
    medicines,
    doseDays,
    titrationSteps: [],
    stockTotals: [
      { medicine_id: 'm_met', total_quantity: 20 },
      { medicine_id: 'm_moun', total_quantity: 20 },
    ],
    biomarkers: [
      { id: 'b1', type: 'glicemia', value: 110, value_secondary: null, unit: 'mg/dL', measured_at: '2026-09-26T23:30:00-03:00', context: 'jejum' },
    ],
    medicineLogs: [],
    ...over,
  }
}

export const GEN = '2026-09-30T18:00:00-03:00'
