import './Card.css'

export default function Card({
  children,
  className = '',
  onClick,
  hover = true,
  variant = 'default',
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`card card-${variant} ${hover ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Tag>
  )
}
