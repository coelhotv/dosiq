/**
 * useTheme - Hook React para gerenciamento de tema claro/escuro
 * 
 * Gerencia a alternância entre temas com:
 * - Detecção automática de preferência do sistema
 * - Persistência em localStorage
 * - Transição suave entre temas
 * 
 * @module useTheme
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// Constants
const THEME_STORAGE_KEY = 'mr_theme'
const SYSTEM_PREFERENCE_KEY = 'mr_theme_system'

// Theme values
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
}

/**
 * Gets the effective theme based on user preference and system setting
 * @param {string} userPreference - User's saved preference ('light', 'dark', 'system')
 * @returns {string} Resolved theme ('light' or 'dark')
 */
const getResolvedTheme = (userPreference) => {
  if (userPreference === THEMES.SYSTEM) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? THEMES.DARK 
      : THEMES.LIGHT
  }
  return userPreference || THEMES.LIGHT
}

/**
 * Hook para gerenciar tema claro/escuro
 * 
 * @returns {Object} Estado e funções do tema
 * @property {string} theme - Tema atual ('light', 'dark', 'system')
 * @property {string} resolvedTheme - Tema resolvido após considerar preferência do sistema
 * @property {Function} toggleTheme - Função para alternar entre claro/escuro
 * @property {Function} setTheme - Função para definir tema específico
 * @property {boolean} systemPreference - Se está usando preferência do sistema
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Try to get from localStorage first
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved) return saved
      
      // Check if user has set system preference
      const systemSet = localStorage.getItem(SYSTEM_PREFERENCE_KEY)
      if (!systemSet) {
        // First visit - set system preference
        localStorage.setItem(SYSTEM_PREFERENCE_KEY, 'true')
        return THEMES.SYSTEM
      }
    }
    return THEMES.LIGHT
  })

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      return getResolvedTheme(saved || THEMES.SYSTEM)
    }
    return THEMES.LIGHT
  })

  // Apply theme to document
  const resolvedRef = useRef(resolvedTheme)
  
  useEffect(() => {
    if (typeof window === 'undefined') return

    const resolved = getResolvedTheme(theme)
    
    // Only update if theme actually changed
    if (resolvedRef.current !== resolved) {
      resolvedRef.current = resolved
      document.documentElement.setAttribute('data-theme', resolved)
    }
    
    // Persist resolved theme for fast boot
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    
    // Remove system flag if user explicitly chose a theme
    if (theme !== THEMES.SYSTEM) {
      localStorage.removeItem(SYSTEM_PREFERENCE_KEY)
    }
  }, [theme])

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || theme !== THEMES.SYSTEM) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e) => {
      const resolved = e.matches ? THEMES.DARK : THEMES.LIGHT
      setResolvedTheme(resolved)
      document.documentElement.setAttribute('data-theme', resolved)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  /**
   * Toggle between light and dark themes
   * If current theme is 'system', switches to 'light'
   */
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      if (prev === THEMES.LIGHT) return THEMES.DARK
      if (prev === THEMES.DARK) return THEMES.LIGHT
      return THEMES.LIGHT
    })
  }, [])

  /**
   * Set specific theme
   * @param {string} newTheme - Theme to set ('light', 'dark', 'system')
   */
  const setTheme = useCallback((newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setThemeState(newTheme)
    }
  }, [])

  /**
   * Reset to system preference
   */
  const useSystemTheme = useCallback(() => {
    setThemeState(THEMES.SYSTEM)
  }, [])

  return {
    theme,
    resolvedTheme,
    toggleTheme,
    setTheme,
    useSystemTheme,
    isLight: resolvedTheme === THEMES.LIGHT,
    isDark: resolvedTheme === THEMES.DARK,
    isSystem: theme === THEMES.SYSTEM
  }
}

// Export theme constants for use in components
export { THEMES, THEME_STORAGE_KEY }

export default useTheme
