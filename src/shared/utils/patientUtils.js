/**
 * Extrai o handle do email para uso como fallback de identidade.
 * @param {string} email - Email do usuario.
 * @returns {string} Parte anterior ao @ ou string vazia.
 */
export function extractEmailHandle(email) {
  if (!email || typeof email !== 'string') return ''
  const [handle] = email.split('@')
  return handle?.trim() || ''
}

/**
 * Formata um nome legivel para o paciente.
 * @param {string} patientName - Nome salvo no perfil.
 * @param {string} patientEmail - Email do usuario.
 * @returns {string} Nome pronto para exibicao em contexto clinico.
 */
export function formatPatientDisplayName(patientName, patientEmail) {
  const trimmedName = typeof patientName === 'string' ? patientName.trim() : ''
  if (trimmedName) return trimmedName

  const handle = extractEmailHandle(patientEmail)
  if (!handle) return 'Paciente'

  return handle
    .split(/[._-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
