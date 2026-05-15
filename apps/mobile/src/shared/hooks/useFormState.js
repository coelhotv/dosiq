import { useCallback, useMemo, useState } from 'react'

// Hook genérico de estado de formulário com validação Zod.
// Retorna API estável compatível com FormInput/Select/DatePicker (P1.2+).
//
// Uso:
//   const form = useFormState(medicineCreateSchema, { initialValues: {...} })
//   <FormInput name="name" value={form.values.name} error={form.errors.name}
//              onChange={form.handleChange} onBlur={form.handleBlur} />

const EMPTY = Object.freeze({})

const deepEqual = (a, b) => {
  if (a === b) return true
  // Date precisa de comparação por valor (getTime) — Object.keys(Date) retorna []
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a == null || b == null) return a === b
  if (typeof a !== 'object' || typeof b !== 'object') return a === b
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual(a[k], b[k]))
}

// Mapeia ZodError.issues -> { [path]: mensagem }
const mapIssues = (issues) => {
  const out = {}
  for (const issue of issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

// Valida campo isolado parseando objeto completo. Necessário para preservar
// refinements de objeto (.refine/.superRefine) que dependem de outros campos —
// schema.pick descarta refinements do nível do objeto.
const validateField = (schema, field, value, allValues) => {
  const result = schema.safeParse({ ...allValues, [field]: value })
  if (result.success) return null
  const issue = result.error.issues.find((i) => i.path[0] === field)
  return issue ? issue.message : null
}

export function useFormState(schema, { initialValues = EMPTY } = {}) {
  const [initial, setInitial] = useState(initialValues)
  const [values, setValuesState] = useState(initialValues)
  const [errors, setErrors] = useState(EMPTY)
  const [touched, setTouched] = useState(EMPTY)

  const handleChange = useCallback((field, value) => {
    setValuesState((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleBlur = useCallback(
    (field) => {
      setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
      const msg = validateField(schema, field, values[field], values)
      setErrors((prev) => {
        if (msg) return { ...prev, [field]: msg }
        if (!prev[field]) return prev
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [schema, values],
  )

  const validate = useCallback(() => {
    const result = schema.safeParse(values)
    if (result.success) {
      setErrors(EMPTY)
      return true
    }
    setErrors(mapIssues(result.error.issues))
    // Marca todos campos com erro como touched (UX: mostra mensagens)
    setTouched((prev) => {
      const next = { ...prev }
      for (const issue of result.error.issues) {
        const path = issue.path[0]
        if (path) next[path] = true
      }
      return next
    })
    return false
  }, [schema, values])

  const reset = useCallback(
    (nextInitial) => {
      const init = nextInitial ?? initial
      setInitial(init)
      setValuesState(init)
      setErrors(EMPTY)
      setTouched(EMPTY)
    },
    [initial],
  )

  const setValues = useCallback((partial) => {
    setValuesState((prev) => ({ ...prev, ...partial }))
    // Limpa erros dos campos sobrescritos (auto-fill ANVISA)
    setErrors((prev) => {
      const keys = Object.keys(partial)
      if (!keys.some((k) => prev[k])) return prev
      const next = { ...prev }
      for (const k of keys) delete next[k]
      return next
    })
  }, [])

  const isDirty = useMemo(
    () => !deepEqual(values, initial),
    [values, initial],
  )

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors])

  // Placeholder v1; refs serão acopladas via FormInput em P1.2+.
  const scrollToFirstError = useCallback(() => {}, [])

  return {
    values,
    errors,
    touched,
    isDirty,
    isValid,
    handleChange,
    handleBlur,
    validate,
    reset,
    setValues,
    scrollToFirstError,
  }
}

export default useFormState
