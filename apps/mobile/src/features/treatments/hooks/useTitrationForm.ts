// useTitrationForm.ts — estado do cadastro da escada (Evolução do tratamento, spec 029 F4 / T019).
//
// Modelo "Gravar etapa" (Decisões §4.2, sem auto-save): o builder grava uma etapa por vez em
// `steps` (card-resumo), e [Salvar] persiste a escada inteira via titrationService.createFullLadder
// (que aplica a ATIVAÇÃO T019a — etapa 0 current + started_at — e o vínculo protocol_id do A5).
//
// A tela nasce SEMPRE com um protocolo existente (o cadastro da escada só abre quando o tratamento
// já foi salvo — a etapa 0 precisa do protocol.id p/ o vínculo). A etapa 1 é pré-preenchida com o
// medicamento e a dose ATUAIS do protocolo (a etapa vigente = o que já está prescrito).

import { useCallback, useMemo, useState } from 'react'
import { deriveStepIntakeUnit } from '../services/titrationService'

const DAYS_PER_WEEK = 7

 
type Medicine = any

/** Etapa já gravada (card-resumo). Guarda o objeto do medicamento pra exibir nome/hint. */
export interface LadderStep {
  id?: string // presente = etapa upcoming já persistida (modo edição); ausente = etapa nova
  medicine: Medicine
  dose: number
  intakeUnit: string
  durationDays: number | null // null = etapa contínua
}

interface BuilderState {
  medicine: Medicine | null
  doseRaw: string // string até gravar (decimais pt-BR "0,25")
  durationWeeksRaw: string
  continua: boolean
}

function emptyBuilder(): BuilderState {
  return { medicine: null, doseRaw: '', durationWeeksRaw: '', continua: false }
}

/** Normaliza "0,25"/"0.25"/intermediário → number | NaN. */
function parseDecimal(raw: string): number {
  if (typeof raw !== 'string' || raw.trim() === '') return NaN
  return Number(raw.replace(',', '.'))
}

interface UseTitrationFormArgs {
  seedMedicine: Medicine | null // medicamento do protocolo (etapa vigente) — só no cadastro
  seedDose?: number | string | null // dose atual do protocolo — só no cadastro
  initialSteps?: LadderStep[] // etapas já persistidas (modo edição — sufixo upcoming editável)
}

export function useTitrationForm({ seedMedicine, seedDose, initialSteps }: UseTitrationFormArgs) {
  // States (R-010)
  const [steps, setSteps] = useState<LadderStep[]>(() => initialSteps ?? [])
  const [builder, setBuilder] = useState<BuilderState>(() => ({
    ...emptyBuilder(),
    medicine: seedMedicine ?? null,
    doseRaw: seedDose != null && seedDose !== '' ? String(seedDose).replace('.', ',') : '',
  }))
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingReopenSheet, setPendingReopenSheet] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memos
  const doseSuffix = useMemo(() => {
    const unit = builder.medicine ? deriveStepIntakeUnit(builder.medicine) : ''
    return unit === 'cp' ? 'comprimido(s)' : unit
  }, [builder.medicine])

  const canDuplicate = steps.length > 0 && editingIndex === null

  // Handlers
  const selectMedicine = useCallback((med: Medicine) => {
    setBuilder((prev) => ({ ...prev, medicine: med }))
    setError(null)
  }, [])

  const setDoseRaw = useCallback((raw: string) => {
    setBuilder((prev) => ({ ...prev, doseRaw: raw }))
  }, [])

  const setDurationWeeksRaw = useCallback((raw: string) => {
    setBuilder((prev) => ({ ...prev, durationWeeksRaw: raw }))
  }, [])

  const toggleContinua = useCallback((next: boolean) => {
    setBuilder((prev) => ({ ...prev, continua: next }))
  }, [])

  // "Duplicar etapa anterior": pré-preenche medicamento + dose da última gravada.
  const duplicatePrevious = useCallback(() => {
    const prev = steps[steps.length - 1]
    if (!prev) return
    setBuilder({
      medicine: prev.medicine,
      doseRaw: String(prev.dose).replace('.', ','),
      durationWeeksRaw: '',
      continua: false,
    })
    setError(null)
  }, [steps])

  /** Valida o builder → objeto LadderStep, ou string de erro. */
  const buildStep = useCallback((): LadderStep | string => {
    if (!builder.medicine) return 'Escolha o medicamento da etapa.'
    const dose = parseDecimal(builder.doseRaw)
    if (!Number.isFinite(dose) || dose <= 0) return 'Informe uma dose maior que zero.'
    if (builder.continua) {
      return {
        medicine: builder.medicine,
        dose,
        intakeUnit: deriveStepIntakeUnit(builder.medicine),
        durationDays: null,
      }
    }
    const weeks = parseDecimal(builder.durationWeeksRaw)
    if (!Number.isFinite(weeks) || weeks <= 0) {
      return 'Informe a duração em semanas (ou marque "Etapa contínua").'
    }
    return {
      medicine: builder.medicine,
      dose,
      intakeUnit: deriveStepIntakeUnit(builder.medicine),
      durationDays: Math.round(weeks * DAYS_PER_WEEK),
    }
  }, [builder])

  // "Gravar etapa": valida e move o builder para o card-resumo (ou substitui em edição).
  const commitStep = useCallback((): boolean => {
    const result = buildStep()
    if (typeof result === 'string') {
      setError(result)
      return false
    }
    setSteps((prev) => {
      if (editingIndex !== null) {
        const next = [...prev]
        // Preserva o id da etapa persistida (edição) — sem isso a reconciliação a trataria como
        // delete+create em vez de update, perdendo o vínculo com a linha do banco.
        next[editingIndex] = { ...result, id: prev[editingIndex]?.id }
        return next
      }
      return [...prev, result]
    })
    setEditingIndex(null)
    setBuilder(emptyBuilder())
    setError(null)
    return true
  }, [buildStep, editingIndex])

  const editStep = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return
    setBuilder({
      medicine: step.medicine,
      doseRaw: String(step.dose).replace('.', ','),
      durationWeeksRaw: step.durationDays != null ? String(step.durationDays / DAYS_PER_WEEK) : '',
      continua: step.durationDays === null,
    })
    setEditingIndex(index)
    setError(null)
  }, [steps])

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
      setBuilder(emptyBuilder())
    }
  }, [editingIndex])

  const cancelEdit = useCallback(() => {
    setEditingIndex(null)
    setBuilder(emptyBuilder())
    setError(null)
  }, [])

  return {
    steps,
    builder,
    editingIndex,
    doseSuffix,
    canDuplicate,
    sheetOpen,
    setSheetOpen,
    pendingReopenSheet,
    setPendingReopenSheet,
    error,
    setError,
    selectMedicine,
    setDoseRaw,
    setDurationWeeksRaw,
    toggleContinua,
    duplicatePrevious,
    commitStep,
    editStep,
    removeStep,
    cancelEdit,
  }
}
