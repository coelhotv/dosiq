import { isLiquidDosageUnit } from '@dosiq/core'
import FormInput from '@shared/components/form/FormInput'

// FR-031 (ADR-066) · spec 113 (FR-005): denominador do rótulo ("Mounjaro 2,5 mg / 0,5 mL" ⇒ 0,5).
// Um campo só para o form completo e o onboarding; aparece com unidade líquida (/ml). Vazio = 1 mL.

interface ConcentrationVolumeFieldProps {
  dosageUnit: string | null | undefined
  /** `formProps(form, 'concentration_volume_ml')` + `onChange` da tela. */
  inputProps: Record<string, any>
}

export function ConcentrationVolumeField({ dosageUnit, inputProps }: ConcentrationVolumeFieldProps) {
  if (!isLiquidDosageUnit(dosageUnit)) return null
  return (
    <FormInput
      name="concentration_volume_ml"
      label="Volume da concentração (mL no rótulo)"
      keyboardType="decimal-pad"
      placeholder="1"
      helperText='Padrão é 1 mL (ou só mL). Mude se o rótulo trouxer outro volume, ex.: "Mounjaro 2,5 mg / 0,5 mL" — preencha 0,5.' /* unit-label-gate: ok — copy estática de ajuda (053/PO-5) */
      {...inputProps}
    />
  )
}
