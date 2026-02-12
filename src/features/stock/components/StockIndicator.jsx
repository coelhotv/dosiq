import './StockIndicator.css'

export default function StockIndicator({ quantity, lowThreshold = 10, isLow }) {
  const getStatusColor = () => {
    if (quantity === 0) return 'var(--accent-error)'
    if (isLow !== undefined) {
      return isLow ? 'var(--accent-warning)' : 'var(--accent-success)'
    }
    if (quantity <= lowThreshold) return 'var(--accent-warning)'
    return 'var(--accent-success)'
  }

  const getStatusText = () => {
    if (quantity === 0) return 'Sem estoque'
    if (isLow !== undefined) {
      return isLow ? 'Acaba em breve' : 'Estoque OK'
    }
    if (quantity <= lowThreshold) return 'Estoque baixo'
    return 'Estoque OK'
  }

  const getPercentage = () => {
    const maxDisplay = lowThreshold * 3 // Considera 3x o threshold como 100%
    return Math.min((quantity / maxDisplay) * 100, 100)
  }

  return (
    <div className="stock-indicator">
      <div className="stock-header">
        <span className="stock-quantity">{quantity} comprimidos</span>
        <span 
          className="stock-status" 
          style={{ color: getStatusColor() }}
        >
          {getStatusText()}
        </span>
      </div>
      
      <div className="stock-bar">
        <div 
          className="stock-fill" 
          style={{ 
            width: `${getPercentage()}%`,
            background: getStatusColor()
          }}
        />
      </div>
    </div>
  )
}
