/**
 * Badge — indicador de status com dot colorido + label.
 *
 * Variantes: critical, warning, success, info, neutral
 * Usado para: status de estoque, estado de protocolo, alertas inline.
 *
 * Referencia visual: plans/redesign/references/complex-estoque-desktop.png
 * — badges "URGENTE", "ATENCAO", "SEGURO" nos cards de estoque.
 *
 * Estilos: src/shared/styles/components.redesign.css
 */
export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      <span className="badge-dot" aria-hidden="true" />
      <span className="badge-label">{children}</span>
    </span>
  )
}
