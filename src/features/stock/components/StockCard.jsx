import Card from '@shared/components/ui/Card'
import StockIndicator from './StockIndicator'
import './StockCard.css'

export default function StockCard({ medicine, stockEntries, totalQuantity, daysRemaining, isLow, dailyIntake, onClick }) {
  const isOutOfStock = totalQuantity === 0;

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  }

  const isExpiringSoon = (expirationDate) => {
    if (!expirationDate) return false
    const today = new Date()
    const expDate = new Date(expirationDate)
    const daysUntilExpiration = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0
  }

  const isExpired = (expirationDate) => {
    if (!expirationDate) return false
    const today = new Date()
    const expDate = new Date(expirationDate)
    return expDate < today
  }

  return (
    <Card 
      className={`stock-card-detail ${isLow ? 'low-stock-card' : ''} ${isOutOfStock ? 'out-of-stock-card' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="stock-card-header">
        <div className="medicine-info-top">
          <h4 className="medicine-name">{medicine.name}</h4>
          {medicine.dosage_per_pill && (
            <span className="medicine-dosage">{medicine.dosage_per_pill}{medicine.dosage_unit || 'mg'}</span>
          )}
        </div>
        <div className="stock-days-badge">
          {dailyIntake > 0 ? (
            <span className={`days-count ${isLow ? 'danger' : ''}`}>
              {Math.floor(daysRemaining)} dias
            </span>
          ) : (
            <span className="days-count neutral">Inativo</span>
          )}
        </div>
      </div>

      <StockIndicator quantity={totalQuantity} isLow={isLow} />

      {stockEntries.length > 0 && (
        <div className="stock-entries">
          <h5>Histórico de Compras</h5>
          <div className="entries-list">
            {stockEntries.map(entry => (
              <div key={entry.id} className="entry-item">
                <div className="entry-info">
                  <span className="entry-quantity">{entry.quantity} un.</span>
                  <span className="entry-price">
                    {entry.unit_price > 0 ? `(R$ ${parseFloat(entry.unit_price).toFixed(2)}/un)` : ''}
                  </span>
                  <span className="entry-date">
                    Compra: {formatDate(entry.purchase_date)}
                  </span>
                </div>
                {entry.unit_price > 0 && (
                  <div className="entry-total">
                    Custo lote: R$ {(entry.unit_price * entry.quantity).toFixed(2)}
                  </div>
                )}
                {entry.expiration_date && (
                  <div className="entry-expiration">
                    <span 
                      className={`expiration-badge ${
                        isExpired(entry.expiration_date) ? 'expired' : 
                        isExpiringSoon(entry.expiration_date) ? 'expiring-soon' : ''
                      }`}
                    >
                      {isExpired(entry.expiration_date) ? '⚠️ Vencido' : 
                       isExpiringSoon(entry.expiration_date) ? '⏰ Vence em breve' : 
                       `Validade: ${formatDate(entry.expiration_date)}`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
