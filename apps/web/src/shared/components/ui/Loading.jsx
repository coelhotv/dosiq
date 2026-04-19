import './Loading.css'

/**
 * Loading — indicador de carregamento (spinner ou skeleton).
 *
 * @param {'md'|'sm'|'lg'} size - Tamanho do spinner
 * @param {string} text - Texto exibido abaixo do spinner
 * @param {'spinner'|'skeleton'} variant - 'skeleton' para lazy-loaded content
 * @param {number} lines - Número de linhas skeleton (default 3, só para variant='skeleton')
 */
export default function Loading({
  size = 'md',
  text = 'Carregando...',
  variant = 'spinner',
  lines = 3,
}) {
  if (variant === 'skeleton') {
    return (
      <div className="loading-skeleton" aria-busy="true" aria-label="Carregando conteúdo">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="loading-container">
      <div className={`loading-spinner loading-${size}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  )
}
