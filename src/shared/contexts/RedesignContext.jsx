import { useState, useEffect } from 'react'
import { RedesignContext } from './RedesignContext.js'

const STORAGE_KEY = 'mr_redesign_preview'

/**
 * Lê o flag de redesign das fontes disponíveis (URL param ou localStorage).
 * URL param tem prioridade e persiste no localStorage.
 */
function resolveInitialFlag() {
  const params = new URLSearchParams(window.location.search)
  if (params.has('redesign')) {
    const value = params.get('redesign') === '1'
    try {
      if (value) {
        localStorage.setItem(STORAGE_KEY, '1')
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage indisponível em ambiente de teste
    }
    return value
  }
  try {
    // Default to true (redesign enabled) for new users who never set the flag
    // Existing users who set '0' explicitly will get false
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return true // New user → redesign enabled by default
    return stored === '1' // Existing user → respect their preference
  } catch {
    return true // Fail-safe: enable redesign on localStorage error
  }
}

export function RedesignProvider({ children }) {
  const [isRedesignEnabled, setIsRedesignEnabled] = useState(resolveInitialFlag)

  // Sincroniza localStorage quando o flag muda via toggleRedesign
  useEffect(() => {
    try {
      if (isRedesignEnabled) {
        localStorage.setItem(STORAGE_KEY, '1')
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage indisponível em ambiente de teste
    }
  }, [isRedesignEnabled])

  const toggleRedesign = () => setIsRedesignEnabled((prev) => !prev)
  const enableRedesign = () => setIsRedesignEnabled(true)

  return (
    <RedesignContext.Provider value={{ isRedesignEnabled, toggleRedesign, enableRedesign }}>
      {children}
    </RedesignContext.Provider>
  )
}
