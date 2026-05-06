import { prepareDataToSave } from './protocolFormUtils'

export async function submitProtocolForm({
  formData,
  enableTitration,
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
    const dataToSave = prepareDataToSave(formData, enableTitration)
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
