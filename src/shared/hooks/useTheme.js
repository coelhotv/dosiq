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

/**
 * Hook para gerenciar tema da aplicação
 * @returns {Object} { theme, toggleTheme, systemTheme }
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // Primeiro verifica se há preferência salva no localStorage
    const savedTheme = typeof window !== 'undefined' 
      ? localStorage.getItem(THEME_STORAGE_KEY) 
      : null
    
    if (savedTheme) {
      return savedTheme
    }
    
    // Se não houver, usa preferência do sistema
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return prefersDark ? 'dark' : 'light'
    }
    
    return 'light'
  })

  const [systemTheme, setSystemTheme] = useState('light')

  // Detectar mudança na preferência do sistema
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e) => {
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
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  return {
    theme,
    toggleTheme,
    systemTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    prefersReducedMotion
  }
}

export default useTheme
