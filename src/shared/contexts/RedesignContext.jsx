import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'mr_redesign_preview'

const RedesignContext = createContext({ isRedesignEnabled: false, toggleRedesign: () => {} })

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
    } catch (_) {
      // localStorage indisponível em ambiente de teste
    }
    return value
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch (_) {
    return false
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
    } catch (_) {
      // localStorage indisponível em ambiente de teste
    }
  }, [isRedesignEnabled])

  const toggleRedesign = () => setIsRedesignEnabled((prev) => !prev)

  return (
    <RedesignContext.Provider value={{ isRedesignEnabled, toggleRedesign }}>
      {children}
    </RedesignContext.Provider>
  )
}

export function useRedesign() {
  return useContext(RedesignContext)
}
