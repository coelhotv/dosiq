import { useState } from 'react'
import Card from '@shared/components/ui/Card'
import StockIndicator from './StockIndicator'
import { parseLocalDate, getNow } from '@utils/dateUtils'
import './StockCard.css'

// Prefixos de notas geradas automaticamente pelo sistema (deleção/edição de dose)
const SYSTEM_NOTE_PREFIXES = ['Dose excluída', 'Ajuste de dose']

// Ajustes automáticos gerados pelo sistema
const isSystemAdjustment = (entry) =>
  SYSTEM_NOTE_PREFIXES.some((prefix) => entry.notes?.startsWith(prefix))

export default function StockCard({
  medicine,
  stockEntries,
  totalQuantity,
  daysRemaining,
  isLow,
  dailyIntake,
  onClick,
}) {
  const [showHistory, setShowHistory] = useState(false)

  const isOutOfStock = totalQuantity === 0

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return parseLocalDate(dateString).toLocaleDateString('pt-BR')
  }

  const isExpiringSoon = (expirationDate) => {
    if (!expirationDate) return false
    const today = getNow()
    const expDate = parseLocalDate(expirationDate)
    const daysUntilExpiration = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0
  }

  const isExpired = (expirationDate) => {
    if (!expirationDate) return false
    const today = getNow()
    return parseLocalDate(expirationDate) < today
  }

  // Classificar entradas em uma única passagem
  const { activeEntries, consumedEntries, systemEntries } = stockEntries.reduce(
    (acc, entry) => {
      if (isSystemAdjustment(entry)) {
        acc.systemEntries.push(entry)
      } else if (entry.quantity > 0) {
        acc.activeEntries.push(entry)
      } else {
        acc.consumedEntries.push(entry)
      }
      return acc
    },
    { activeEntries: [], consumedEntries: [], systemEntries: [] }
  )

  const hiddenCount = consumedEntries.length + systemEntries.length

  const renderEntryItem = (entry, className = '') => (
    <div key={entry.id} className={`entry-item ${className}`}>
      <div className="entry-info">
        <span className="entry-quantity">{entry.quantity} un.</span>
        <span className="entry-price">
          {entry.unit_price > 0 ? `(R$ ${parseFloat(entry.unit_price).toFixed(2)}/un)` : ''}
        </span>
        <span className="entry-date">Compra: {formatDate(entry.purchase_date)}</span>
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
              isExpired(entry.expiration_date)
                ? 'expired'
                : isExpiringSoon(entry.expiration_date)
                  ? 'expiring-soon'
                  : ''
            }`}
          >
            {isExpired(entry.expiration_date)
              ? '⚠️ Vencido'
              : isExpiringSoon(entry.expiration_date)
                ? '⏰ Vence em breve'
                : `Validade: ${formatDate(entry.expiration_date)}`}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <Card
      className={`stock-card-detail ${isLow ? 'low-stock-card' : ''} ${isOutOfStock ? 'out-of-stock-card' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="stock-card-header">
        <div className="medicine-info-top">
          <h4 className="medicine-name">{medicine.name}</h4>
          {medicine.dosage_per_pill && (
            <span className="medicine-dosage">
              {medicine.dosage_per_pill}
              {medicine.dosage_unit || 'mg'}
            </span>
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
          <h5>Lotes Ativos</h5>
          <div className="entries-list">
            {activeEntries.length > 0 ? (
              activeEntries.map((entry) => renderEntryItem(entry))
            ) : (
              <p className="no-active-entries">Nenhum lote com quantidade disponível</p>
            )}
          </div>

          {hiddenCount > 0 && (
            <>
              <button
                className="history-toggle"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowHistory((prev) => !prev)
                }}
              >
                {showHistory ? '▾' : '▸'} Ver histórico completo ({hiddenCount}{' '}
                {hiddenCount === 1 ? 'entrada anterior' : 'entradas anteriores'})
              </button>

              {showHistory && (
                <div className="history-section">
                  {consumedEntries.length > 0 && (
                    <>
                      <span className="history-section-title">Lotes consumidos</span>
                      <div className="entries-list">
                        {consumedEntries.map((entry) => renderEntryItem(entry, 'consumed'))}
                      </div>
                    </>
                  )}
                  {systemEntries.length > 0 && (
                    <>
                      <span className="history-section-title">Ajustes automáticos</span>
                      <div className="entries-list">
                        {systemEntries.map((entry) => (
                          <div key={entry.id} className="entry-item system-adjustment">
                            <div className="entry-info">
                              <span className="entry-quantity">+{entry.quantity} un.</span>
                              <span className="entry-date system-note">{entry.notes}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
