import { describe, it, expect } from 'vitest'
import { buildPatientContext } from '../buildPatientContext'
import { validateChatbotContextData } from '../chatbotContextSchema'

// Trava-drift de paridade (FR-011 / PO-5): com o builder centralizado no core, as 3
// superfícies (web/Telegram/mobile) consomem a MESMA função. Dado o MESMO ChatbotContextData
// (saída do fetcher canônico, CON-028), o contexto produzido é idêntico — divergência só
// poderia vir do input, que o seam Zod valida. Aqui: fixture golden → string estável e
// determinística (mesmo input → mesma saída), independente da superfície que chamou.

const goldenContextData = {
  medicines: [
    {
      id: 'med-1',
      name: 'Metformina',
      active_ingredient: 'Cloridrato de Metformina',
      therapeutic_class: 'Antidiabetico',
      dosage_per_pill: 500,
      dosage_unit: 'mg',
      stock: [{ quantity: 30 }],
    },
    {
      id: 'med-2',
      name: 'Losartana',
      active_ingredient: 'Losartana Potássica',
      therapeutic_class: 'Anti-hipertensivo',
      dosage_per_pill: 50,
      dosage_unit: 'mg',
      stock: [{ quantity: 5 }],
    },
  ],
  protocols: [
    { medicine_id: 'med-1', active: true, frequency: 'diario', time_schedule: ['08:00', '20:00'], treatment_plan: { id: 'tp-1', name: 'diabetes' } },
    { medicine_id: 'med-2', active: true, frequency: 'diario', time_schedule: ['08:00'] }, // sem plano → flat
  ],
  logs: [],
  stockSummary: [
    { medicine: { id: 'med-1' }, total: 30, daysRemaining: 15, dailyIntake: 2, isZero: false, isLow: false },
    { medicine: { id: 'med-2' }, total: 5, daysRemaining: 5, dailyIntake: 1, isZero: false, isLow: true },
  ],
  stats: { adherence: 0.9 },
  doseInstances: [],
  treatmentPlans: [],
}

describe('paridade cross-surface do contexto do chatbot', () => {
  it('o fixture golden é um ChatbotContextData válido (CON-028)', () => {
    const validation = validateChatbotContextData(goldenContextData)
    expect(validation.success).toBe(true)
  })

  it('mesmo input → mesma string (determinístico, agnóstico de superfície)', () => {
    const webPath = buildPatientContext(goldenContextData)
    const serverPath = buildPatientContext(goldenContextData)
    expect(webPath).toBe(serverPath)
  })

  it('produz as seções unificadas esperadas (formato canônico único + grouping)', () => {
    const ctx = buildPatientContext(goldenContextData)
    expect(ctx).toContain('Tratamentos ativos: 2')
    expect(ctx).toContain('Metformina')
    expect(ctx).toContain('Losartana')
    expect(ctx).toContain('Adesão ultimos 7 dias: 90%')
    // grouping: Metformina no plano "diabetes"; Losartana (sem plano) flat ANTES do header
    expect(ctx).toContain('Plano "diabetes":')
    expect(ctx).not.toContain('Sem plano')
    expect(ctx.indexOf('Losartana')).toBeLessThan(ctx.indexOf('Plano "diabetes":'))
    expect(ctx.indexOf('Plano "diabetes":')).toBeLessThan(ctx.indexOf('Metformina'))
    // Losartana com daysRemaining 5 (≤7) → alerta de estoque na string unificada
    expect(ctx).toContain('Atenção de estoque:')
    expect(ctx).toContain('Losartana: estoque baixo')
  })
})
