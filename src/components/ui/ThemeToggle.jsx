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

/**
 * Componente ThemeToggle - Alternância de tema
 * @param {Object} props
 * @param {string} props.size - Tamanho do toggle ('sm', 'md', 'lg')
 * @param {string} props.position - Posição do container ('left', 'right', 'center')
 * @param {Function} props.onChange - Callback opcional quando o tema muda
 */
function ThemeToggle({ 
  size = 'md',
  position = 'left',
  onChange 
}) {
  const { toggleTheme, isDark, prefersReducedMotion } = useTheme()

  // Tamanhos disponíveis
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', icon: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', icon: 'w-4 h-4', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', icon: 'w-5 h-5', translate: 'translate-x-7' }
  }

  const currentSize = sizes[size] || sizes.md

  // Posicionamento
  const positions = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end'
  }

  const currentPosition = positions[position] || positions.left

  const handleToggle = () => {
    toggleTheme()
    onChange?.(isDark ? 'light' : 'dark')
  }

  return (
    <div className={`flex ${currentPosition}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
        onClick={handleToggle}
        className={`
          relative inline-flex items-center rounded-full
          ${currentSize.track}
          bg-[var(--color-toggle-track)]
          focus:outline-none focus-visible:ring-2
          focus-visible:ring-[var(--color-primary)]
          focus-visible:ring-offset-2
          focus-visible:ring-offset-[var(--color-bg-primary)]
          transition-colors duration-200
          cursor-pointer
        `}
        disabled={prefersReducedMotion}
      >
        <span
          className={`
            inline-flex items-center justify-center
            rounded-full
            bg-[var(--color-white)]
            shadow-sm
            transform transition-transform duration-200
            ${isDark ? currentSize.translate : 'translate-x-0'}
            ${currentSize.thumb}
          `}
        >
          {isDark ? (
            // Lua
            <svg
              className="text-[var(--color-moon)]"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 6.962.75.75 0 01-1.067 1.214A9 9 0 1117.25 5.75a.75.75 0 11-1.06 1.06 10.5 10.5 0 01-9.24-4.806.75.75 0 01-.52-.004z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            // Sol
            <svg
              className="text-[var(--color-sun)]"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
      </button>
    </div>
  )
}

// Memoize para evitar re-render desnecessários
const MemoizedThemeToggle = memo(ThemeToggle)

export default MemoizedThemeToggle
