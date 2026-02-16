// MedicineCard.jsx
import React from 'react'
import Card from '@shared/components/ui/Card'
import Button from '@shared/components/ui/Button'
import './MedicineCard.css' // Make sure this path is correct

function MedicineCard({ medicine, onEdit, onDelete, hasDependencies }) {
  return (
    <Card className="medicine-card">
      <div className="medicine-header">
        <h4 className="medicine-name">{medicine.name}</h4>
        {hasDependencies && (
          <span
            className="dependency-indicator"
            title="Este medicamento possui protocolos e/ou estoque associados."
          >
            ⚠️
          </span>
        )}
        {medicine.active_ingredient && (
          <span className="medicine-ingredient">{medicine.active_ingredient}</span>
        )}
      </div>

      <div className="medicine-details">
        {medicine.laboratory && (
          <div className="detail-item">
            <span className="detail-label">🏭 Laboratório:</span>
            <span className="detail-value">{medicine.laboratory}</span>
          </div>
        )}

        {medicine.dosage_per_pill && (
          <div className="detail-item">
            <span className="detail-label">💊 Dosagem:</span>
            <span className="detail-value">
              {medicine.dosage_per_pill} {medicine.dosage_unit || 'mg'}
            </span>
          </div>
        )}

        {medicine.type === 'suplemento' && (
          <div className="detail-item">
            <span className="detail-label">ℹ️ Tipo:</span>
            <span className="detail-value">Suplemento</span>
          </div>
        )}

        {medicine.avg_price !== undefined && medicine.avg_price !== null && (
          <div className="detail-item">
            <span className="detail-label">💰 Custo Médio:</span>
            <span className="detail-value">R$ {parseFloat(medicine.avg_price).toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="medicine-actions">
        <Button variant="outline" size="sm" onClick={() => onEdit(medicine)}>
          ✏️ Editar
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(medicine)}>
          🗑️ Excluir
        </Button>
      </div>
    </Card>
  )
}

export default MedicineCard
