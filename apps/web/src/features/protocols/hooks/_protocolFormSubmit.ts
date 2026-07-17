import { prepareDataToSave } from './protocolFormUtils'
import { coerceDecimal } from '@dosiq/core'
import { medicineService } from '@shared/services'

export async function submitProtocolForm({
  formData,
  onSave,
  onSuccess,
  isSimpleMode,
  autoAdvance,
  setIsSubmitting,
  setErrors,
  setSaveSuccess
}) {
  setIsSubmitting(true)
  try {
    // Densidade (units_per_ml) é física do medicamento, capturada no tratamento
    // quando a dose é em gotas/UI (022 Fase C). Persiste no medicamento (RPC lê de lá).
    if (
      formData.medicine_id &&
      formData.intake_unit &&
      formData.intake_unit !== 'ml' &&
      formData.units_per_ml
    ) {
      try {
        await medicineService.update(formData.medicine_id, {
          units_per_ml: coerceDecimal(formData.units_per_ml),
        })
      } catch (densityErr) {
        // Não bloqueia o tratamento; RPC usa fallback 20 se densidade não gravar.
        console.error('Falha ao gravar densidade no medicamento:', densityErr)
      }
    }

    const dataToSave = prepareDataToSave(formData)
    const savedProtocol = await onSave(dataToSave)

    if (isSimpleMode) setSaveSuccess(true)

    if (autoAdvance && onSuccess) {
      setTimeout(() => onSuccess(savedProtocol), 800)
    }
    return savedProtocol
  } catch (error) {
    console.error('Erro ao salvar protocolo:', error)
    const errorMessage = error?.message || 'Erro desconhecido ao salvar tratamento'
    setErrors({ submit: errorMessage })
    throw error
  } finally {
    setIsSubmitting(false)
  }
}
