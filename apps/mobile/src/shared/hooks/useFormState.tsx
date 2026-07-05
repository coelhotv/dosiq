import { useCallback, useMemo, useState } from 'react'
import type { ZodIssue, ZodTypeAny } from 'zod'

// Hook genérico de estado de formulário com validação Zod.
// Retorna API estável compatível com FormInput/Select/DatePicker (P1.2+).
//
// Uso:
//   const form = useFormState(medicineCreateSchema, { initialValues: {...} })
//   <FormInput name="name" value={form.values.name} error={form.errors.name}
//              onChange={form.handleChange} onBlur={form.handleBlur} />

type FormValues = Record<string, unknown>
type FormErrors = Record<string, string>
type FormTouched = Record<string, boolean>

const EMPTY: FormValues = Object.freeze({})
const EMPTY_ERRORS: FormErrors = Object.freeze({})
const EMPTY_TOUCHED: FormTouched = Object.freeze({})

// Sentinel para distinguir "sem override" de "override undefined" no handleBlur.
const NO_OVERRIDE = Symbol('no-override')

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  // Date precisa de comparação por valor (getTime) — Object.keys(Date) retorna []
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a == null || b == null) return a === b
  if (typeof a !== 'object' || typeof b !== 'object') return a === b
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as FormValues)[k], (b as FormValues)[k]))
}

// Mapeia ZodError.issues -> { [path]: mensagem }
const mapIssues = (issues: ZodIssue[]): FormErrors => {
  const out: FormErrors = {}
  for (const issue of issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

// Valida campo isolado parseando objeto completo. Necessário para preservar
// refinements de objeto (.refine/.superRefine) que dependem de outros campos —
// schema.pick descarta refinements do nível do objeto.
const validateField = (
  schema: ZodTypeAny,
  field: string,
  value: unknown,
  allValues: FormValues,
): string | null => {
  const result = schema.safeParse({ ...allValues, [field]: value })
  if (result.success) return null
  const issue = result.error.issues.find((i) => i.path[0] === field)
  return issue ? issue.message : null
}

interface UseFormStateOptions {
  initialValues?: FormValues
}

export function useFormState(schema: ZodTypeAny, { initialValues = EMPTY }: UseFormStateOptions = {}) {
  const [initial, setInitial] = useState<FormValues>(initialValues)
  const [values, setValuesState] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>(EMPTY_ERRORS)
  const [touched, setTouched] = useState<FormTouched>(EMPTY_TOUCHED)

  const isDirty = useMemo(
    () => !deepEqual(values, initial),
    [values, initial],
  )

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors])

  const handleChange = useCallback((field: string, value: unknown) => {
    setValuesState((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  // valueOverride (opcional): valor coercido pra validar no lugar do raw em
  // values[field]. Necessário p/ campos decimais PT-BR que guardam string até o
  // submit (ex: "0,437") mas precisam validar como number no blur (AP-167).
  const handleBlur = useCallback(
    (field: string, valueOverride: unknown = NO_OVERRIDE) => {
      setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
      const value = valueOverride === NO_OVERRIDE ? values[field] : valueOverride
      const msg = validateField(schema, field, value, { ...values, [field]: value })
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

  // `overrides`: merge sobre values antes do parse. Evita race entre
  // handleChange (assíncrono) e validate quando submit precisa coerce
  // um campo (ex: string "0,5" → number 0.5) na mesma frame.
  const validate = useCallback(
    (overrides?: FormValues) => {
      const candidate = overrides ? { ...values, ...overrides } : values
      const result = schema.safeParse(candidate)
      if (result.success) {
        setErrors(EMPTY_ERRORS)
        return true
      }
      setErrors(mapIssues(result.error.issues))
      // Marca todos campos com erro como touched (UX: mostra mensagens)
      setTouched((prev) => {
        const next = { ...prev }
        for (const issue of result.error.issues) {
          const path = issue.path[0]
          if (path !== undefined) next[String(path)] = true
        }
        return next
      })
      return false
    },
    [schema, values],
  )

  const reset = useCallback(
    (nextInitial?: FormValues) => {
      const init = nextInitial ?? initial
      setInitial(init)
      setValuesState(init)
      setErrors(EMPTY_ERRORS)
      setTouched(EMPTY_TOUCHED)
    },
    [initial],
  )

  const setValues = useCallback((partial: FormValues) => {
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

  // Placeholder v1; refs serão acopladas via FormInput in P1.2+.
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
