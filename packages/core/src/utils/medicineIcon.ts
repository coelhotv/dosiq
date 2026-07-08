/**
 * medicineIcon.js — fonte única do ícone de identificação do medicamento
 * (012 Fase A — decisão PO smoke 2026-06-10).
 *
 * O core NÃO importa lucide (puro, sem deps de UI): retorna o NOME canônico
 * do glifo (kebab-case lucide). Cada plataforma faz o binding nome→componente
 * (web: lucide-react · mobile: lucide-react-native) num mapa local fino.
 *
 * Prioridade: suplemento (categoria) > presentation (forma) > derivação legada
 * por dosage_unit (medicamentos antigos sem presentation) > pill.
 */

export const MEDICINE_ICON_BY_PRESENTATION = Object.freeze({
  capsula: 'pill',
  comprimido: 'tablets',
  liquido: 'droplets',
  injetavel: 'syringe',
  pomada: 'soap-dispenser-droplet',
  spray: 'spray-can',
  // 'outro' cai no fallback 'pill'
})

export const SUPPLEMENT_ICON = 'pill-bottle'

/**
 * Nome canônico do ícone lucide para um medicamento.
 * @param {{type?: string, presentation?: string|null, dosage_unit?: string|null}|null} medicine
 * @returns {'pill'|'tablets'|'droplets'|'syringe'|'soap-dispenser-droplet'|'spray-can'|'pill-bottle'}
 */
interface MedicineIconInput {
  type?: string
  presentation?: string | null
  dosage_unit?: string | null
}

export function getMedicineIconName(medicine: MedicineIconInput | null | undefined): string {
  if (!medicine) return 'pill'
  if (medicine.type === 'suplemento') return SUPPLEMENT_ICON

  const byPresentation = medicine.presentation
    ? MEDICINE_ICON_BY_PRESENTATION[medicine.presentation as keyof typeof MEDICINE_ICON_BY_PRESENTATION]
    : undefined
  if (byPresentation) return byPresentation

  // Legado sem presentation: líquido derivado da unidade (decisão-mãe 022).
  if (typeof medicine.dosage_unit === 'string' && medicine.dosage_unit.endsWith('/ml')) {
    return 'droplets'
  }
  return 'pill'
}
