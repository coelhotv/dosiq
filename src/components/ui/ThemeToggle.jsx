/**
 * ThemeToggle - Componente para alternância entre temas claro/escuro
 * 
 * Botão toggle que permite ao usuário alternar entre tema claro e escuro
 * com animação suave e feedback visual.
 * 
 * @component
 * @example
 * <ThemeToggle />
 */

import { useTheme } from '../hooks/useTheme'
import './ThemeToggle.css'

/**
 * Icon components for light/dark modes
 */
const SunIcon = ({ className }) => (
  <svg 
    className={`theme-icon sun ${className || ''}`} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = ({ className }) => (
  <svg 
    className={`theme-icon moon ${className || ''}`} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export function ThemeToggle({ 
  size = 'medium', 
  showLabel = false,
  className = '',
  'aria-label': ariaLabel = 'Alternar tema'
}) {
  const { toggleTheme, resolvedTheme } = useTheme()

  const sizes = {
    small: { width: 36, height: 20, icon: 14 },
    medium: { width: 48, height: 26, icon: 18 },
    large: { width: 60, height: 32, icon: 22 }
  }

  const currentSize = sizes[size] || sizes.medium

  const handleClick = () => {
    toggleTheme()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleTheme()
    }
  }

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      role="switch"
      aria-checked={resolvedTheme === 'dark'}
      style={{
        '--toggle-width': `${currentSize.width}px`,
        '--toggle-height': `${currentSize.height}px`,
        '--icon-size': `${currentSize.icon}px`
      }}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb">
          {resolvedTheme === 'dark' ? (
            <MoonIcon className="thumb-icon" />
          ) : (
            <SunIcon className="thumb-icon" />
          )}
        </span>
      </span>
      {showLabel && (
        <span className="toggle-label">
          {resolvedTheme === 'dark' ? 'Escuro' : 'Claro'}
        </span>
      )}
    </button>
  )
}

export default ThemeToggle
