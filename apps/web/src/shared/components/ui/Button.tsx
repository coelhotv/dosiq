import './Button.css'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}: {
  children?: any
  variant?: string
  size?: string
  onClick?: any
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
