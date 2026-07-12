// onboardingMedicineAnvisa.test.ts — regressão do passo 2 (medicamentos) do onboarding.
//
// A base ANVISA traz `regulatoryCategory` cru ('Biologico', 'Gases Medicinais'); o enum do
// schema é acentuado e fechado. Sem normalizar, o safeParse falhava em `regulatory_category`
// — um campo que a tela do onboarding NÃO renderiza — e o usuário ficava preso no passo 2
// com "Verifique os campos destacados" sem nenhum campo destacado.

import { medicineCreateSchema, normalizeRegulatoryCategory } from '@dosiq/core'

/** Valores do form do passo 2 após o auto-fill da ANVISA. */
function buildFormValues(rawRegulatoryCategory: string) {
  return {
    type: 'medicamento',
    dosage_unit: 'mg',
    presentation: 'comprimido',
    name: 'Losartana Potássica',
    dosage_per_pill: '50',
    active_ingredient: 'losartana potássica',
    regulatory_category: normalizeRegulatoryCategory(rawRegulatoryCategory),
  }
}

describe('onboarding passo 2 — auto-fill da ANVISA', () => {
  it.each([
    ['Biologico', 'Biológico'],
    ['Generico', 'Genérico'],
    ['SIMILAR', 'Similar'],
    ['Gases Medicinais', 'Outros'],
  ])('normaliza %s → %s e o schema aceita', (raw, expected) => {
    const values = buildFormValues(raw)
    expect(values.regulatory_category).toBe(expected)

    const result = medicineCreateSchema.safeParse(values)
    expect(result.success).toBe(true)
  })

  it('categoria crua SEM normalizar é rejeitada — e o erro cai num campo invisível na tela', () => {
    const values = { ...buildFormValues('Biologico'), regulatory_category: 'Biologico' }

    const result = medicineCreateSchema.safeParse(values)
    expect(result.success).toBe(false)

    const paths = result.error.issues.map((issue) => String(issue.path[0]))
    expect(paths).toContain('regulatory_category')
    // Nenhum campo renderizado no passo 2 tem erro → daí o toast "mudo" que travava o smoke.
    expect(paths).not.toContain('name')
    expect(paths).not.toContain('dosage_per_pill')
    expect(paths).not.toContain('dosage_unit')
  })
})
