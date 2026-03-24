import { useContext } from 'react'
import { RedesignContext } from '@shared/contexts/RedesignContext.js'

/**
 * useRedesign — hook para consumir o feature flag do redesign "Santuário Terapêutico".
 *
 * Retorna { isRedesignEnabled, toggleRedesign }.
 * Para ativar o redesign, acessar a app com ?redesign=1 na URL.
 */
export function useRedesign() {
  return useContext(RedesignContext)
}
