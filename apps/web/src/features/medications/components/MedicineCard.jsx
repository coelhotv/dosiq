import {
  Building2,
  Beaker,
  Tag,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { PRESENTATION_LABELS, formatMedicineConcentration } from '@dosiq/core'
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import './MedicineCard.css'

export default function MedicineCard({ medicine, onEdit, onDelete, hasDependencies }) {
  const isSupplement = medicine.type === 'suplemento'

  return (
    <div
      className={`sr-medicine-card sr-medicine-card--${isSupplement ? 'supplement' : 'medicine'}`}
    >
      <div className="sr-medicine-card__header">
        <div
          className={`sr-medicine-card__icon sr-medicine-card__icon--${isSupplement ? 'supplement' : 'medicine'}`}
        >
          {/* Ícone canônico de identificação do medicamento */}
          <MedicineIcon medicine={medicine} size={20} />
        </div>
        <div>
          <h4 className="sr-medicine-card__name">{medicine.name}</h4>
          {medicine.active_ingredient && (
            <span className="sr-medicine-card__ingredient">{medicine.active_ingredient}</span>
          )}
        </div>
      </div>

      <div className="sr-medicine-card__details">
        {/* 012 Fase A: forma farmacêutica visível no dia-a-dia (não só no form) */}
        {medicine.presentation && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Package size={14} /> Apresentação
            </span>
            <span className="sr-medicine-card__detail-value">
              {PRESENTATION_LABELS[medicine.presentation] ?? medicine.presentation}
              {medicine.presentation === 'injetavel' && medicine.shelf_life_days
                ? ` · ${medicine.shelf_life_days} dias após aberto`
                : ''}
            </span>
          </div>
        )}
        {medicine.laboratory && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Building2 size={14} /> Laboratório
            </span>
            <span className="sr-medicine-card__detail-value">{medicine.laboratory}</span>
          </div>
        )}
        {medicine.dosage_per_pill && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Beaker size={14} /> Dosagem
            </span>
            <span className="sr-medicine-card__detail-value">
              {formatMedicineConcentration(medicine)}
            </span>
          </div>
        )}
        {medicine.type && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Tag size={14} /> Tipo
            </span>
            <span className="sr-medicine-card__detail-value">
              {medicine.type === 'suplemento' ? 'Suplemento' : 'Medicamento'}
            </span>
          </div>
        )}
      </div>

      {medicine.avg_price != null && (
        <span className="sr-medicine-card__price">
          R$ {parseFloat(medicine.avg_price).toFixed(2)}
        </span>
      )}

      {hasDependencies && (
        <div className="sr-medicine-card__warning">
          <AlertTriangle size={16} />
          Possui tratamentos e/ou estoque associados
        </div>
      )}

      <div className="sr-medicine-card__actions">
        <button className="btn-ghost btn-sm" onClick={() => onEdit(medicine)}>
          <Pencil size={16} /> Editar
        </button>
        <button className="btn-ghost btn-sm btn-danger" onClick={() => onDelete(medicine)}>
          <Trash2 size={16} /> Excluir
        </button>
      </div>
    </div>
  )
}
