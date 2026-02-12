import './Card.css'

export default function Card({ children, className = '', onClick, hover = true }) {
  return (
    <div 
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
