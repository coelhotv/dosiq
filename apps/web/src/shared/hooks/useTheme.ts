/**
 * useTheme.js - Hook para gerenciamento de tema claro/escuro
 *
 * Funcionalidades:
 * - Detecta preferência do sistema (prefers-color-scheme)
 * - Permite alternância manual entre tema claro/escuro
 * - Persiste preferência em localStorage
 * - Suporta prefers-reduced-motion para transições
 */

import { useState, useEffect, useCallback } from 'react'

const THEME_STORAGE_KEY = 'mr_theme'

export type Theme = 'light' | 'dark'

export interface UseThemeResult {
  theme: Theme
  toggleTheme: () => void
  systemTheme: Theme
  isDark: boolean
  isLight: boolean
  prefersReducedMotion: boolean
}

/**
 * Hook para gerenciar tema da aplicação
 */
export function useTheme(): UseThemeResult {
  const [theme, setTheme] = useState<Theme>(() => {
    // Primeiro verifica se há preferência salva no localStorage
    const savedTheme =
      typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null

    if (savedTheme) {
      return savedTheme as Theme
    }

    // Se não houver, usa preferência do sistema
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return prefersDark ? 'dark' : 'light'
    }

    return 'light'
  })

  const [systemTheme, setSystemTheme] = useState<Theme>('light')

  // Detectar mudança na preferência do sistema
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    // Define theme inicial do sistema
    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  // Aplicar tema no documentElement
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    // Remove classe de transição durante mudança
    root.classList.add('theme-transitioning')

    // Aplica o tema
    root.setAttribute('data-theme', theme)

    // Salva no localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme)

    // Remove classe de transição após a transição
    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 200)

    return () => clearTimeout(timer)
  }, [theme])

  // Verifica se deve respeitar reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return {
    theme,
    toggleTheme,
    systemTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    prefersReducedMotion,
  }
}

export default useTheme
