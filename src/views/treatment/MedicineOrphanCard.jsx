import './Treatment.css'

export default function MedicineOrphanCard({ medicine, onCreateProtocol }) {
  return (
    <div className="medicine-orphan-card">
      <div className="medicine-orphan-card__info">
        <span className="medicine-orphan-card__name">{medicine.name}</span>
        <span className="medicine-orphan-card__detail">
          {medicine.dosage_per_pill}{medicine.dosage_unit} · {medicine.type || 'comprimido'}
        </span>
      </div>
      {onCreateProtocol && (
        <button
          className="medicine-orphan-card__cta"
          onClick={() => onCreateProtocol(medicine)}
        >
          Criar protocolo →
        </button>
      )}
    </div>
  )
}
