import { createContext } from 'react'

/**
 * Objeto de contexto compartilhado entre RedesignProvider e useRedesign.
 * Separado em arquivo .js para não violar react-refresh/only-export-components.
 */
export const RedesignContext = createContext({ isRedesignEnabled: false, toggleRedesign: () => {} })
