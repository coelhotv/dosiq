export const getFieldDescribedBy = (fieldName, errors, hintId = null) =>
  [hintId, errors?.[fieldName] ? `${fieldName}-error` : null].filter(Boolean).join(' ') || undefined
