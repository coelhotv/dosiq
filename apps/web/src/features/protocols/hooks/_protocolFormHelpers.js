export function buildProtocolFormInitialData(protocol, initialValues, preselectedMedicine, isSimpleMode, getTitrationInitialDosage) {
  const data = initialValues || {}
  const isTitrating = protocol?.titration_schedule?.length > 0 || protocol?.titration_status === 'titulando'
  if (!protocol && isTitrating && !data.dosage_per_intake) {
    data.dosage_per_intake = getTitrationInitialDosage(data)
  }
  return data
}

export function getTitrationEnabledStatus(protocol) {
  return protocol?.titration_schedule?.length > 0 || protocol?.titration_status === 'titulando'
}
