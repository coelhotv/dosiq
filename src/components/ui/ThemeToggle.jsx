/**
 * ThemeToggle.jsx - Componente de alternância de tema claro/escuro
 * 
 * Funcionalidades:
 * - Toggle switch visual para alternar entre tema claro e escuro
 * - Usa ícones SVG de sol e lua
 * - Integração com hook useTheme
 * - Acessível com ARIA labels
 */

import { memo } from 'react'
import { useTheme } from '../../hooks/useTheme'
import './ThemeToggle.css'

/**
 * Componente ThemeToggle - Alternância de tema
 * @param {Object} props
 * @param {string} props.size - Tamanho do toggle ('sm', 'md', 'lg')
 * @param {string} props.className - Classes CSS adicionais
 */
function ThemeToggle({ 
  size = 'md',
  className = ''
}) {
  const { toggleTheme, isDark, prefersReducedMotion } = useTheme()

  const handleToggle = (e) => {
    e.stopPropagation()
    toggleTheme()
  }

  const sizeClass = `theme-toggle--${size}`

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      onClick={handleToggle}
      className={`theme-toggle ${sizeClass} ${className}`}
      disabled={prefersReducedMotion}
    >
      <span className="theme-toggle__track">
        {/* Label para tema claro (esquerda) */}
        <span className="theme-toggle__label theme-toggle__label--light" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="4" />
          </svg>
        </span>

        {/* Thumb central */}
        <span className={`theme-toggle__thumb ${isDark ? 'theme-toggle__thumb--dark' : 'theme-toggle__thumb--light'}`}>
          {isDark ? (
            <svg className="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M17.25 6.25a.75.75 0 01.75.75 8.25 8.25 0 01-8.25 8.25.75.75 0 01-1.5 0 9.75 9.75 0 019.5-12.75.75.75 0 01.75.75z" fill="currentColor" />
            </svg>
          ) : (
            <svg className="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="4" fill="currentColor" />
            </svg>
          )}
        </span>

        {/* Label para tema escuro (direita) */}
        <span className="theme-toggle__label theme-toggle__label--dark" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.25 6.25a.75.75 0 01.75.75 8.25 8.25 0 01-8.25 8.25.75.75 0 01-1.5 0 9.75 9.75 0 019.5-12.75.75.75 0 01.75.75z" />
          </svg>
        </span>
      </span>
    </button>
  )
}

// Memoize para evitar re-render desnecessários
const MemoizedThemeToggle = memo(ThemeToggle)

export default MemoizedThemeToggle
