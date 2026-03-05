/**
 * useComplexityMode — Hook para modo de complexidade adaptativo (W2-02)
 *
 * Detecta automaticamente o nível de complexidade baseado na quantidade de
 * medicamentos ativos do usuário e adapta a UI (ring gauge size, view mode).
 *
 * Thresholds (UX Vision v0.5):
 * - simple: ≤3 medicamentos
 * - moderate: 4-6 medicamentos
 * - complex: 7+ medicamentos
 */

import { useState, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'

const STORAGE_KEY = 'mr_complexity_override'

// Evitar localStorage em ambiente de testes
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'

function readStorage(key) {
  if (isTest || typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  if (isTest || typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // silencioso
  }
}

function removeStorage(key) {
  if (isTest || typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // silencioso
  }
}

export function useComplexityMode() {
  const { medicines, protocols } = useDashboard()

  const [overrideMode, setOverrideMode] = useState(() => readStorage(STORAGE_KEY))

  // Medicamentos com ao menos 1 protocolo ativo
  const activeMedicines = useMemo(
    () => medicines.filter((m) => protocols.some((p) => p.medicine_id === m.id && p.active !== false)),
    [medicines, protocols]
  )

  const autoMode = useMemo(() => {
    const count = activeMedicines.length
    if (count <= 3) return 'simple'
    if (count <= 6) return 'moderate'
    return 'complex'
  }, [activeMedicines])

  const mode = overrideMode || autoMode

  const setOverride = useCallback((newMode) => {
    if (newMode === null) {
      removeStorage(STORAGE_KEY)
      setOverrideMode(null)
    } else {
      writeStorage(STORAGE_KEY, newMode)
      setOverrideMode(newMode)
    }
  }, [])

  return {
    mode,
    medicineCount: activeMedicines.length,
    overrideMode,
    setOverride,
    // Derivados para uso direto no Dashboard
    ringGaugeSize: mode === 'simple' ? 'large' : mode === 'moderate' ? 'medium' : 'compact',
    defaultViewMode: mode === 'complex' ? 'plan' : 'time',
  }
}
