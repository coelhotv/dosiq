import './Card.css'

export default function Card({
  children,
  className = '',
  onClick,
  hover = true,
  variant = 'default',
}) {
  return (
    <div
      className={`card card-${variant} ${hover ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
