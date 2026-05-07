import { Pill, Plus } from 'lucide-react'

export default function MedicineListHeader({ onAdd }) {
  return (
    <div className="sr-medicines__header">
      <div>
        <div className="sr-medicines__title-group">
          <div className="sr-medicines__title-icon">
            <Pill size={22} />
          </div>
          <h2 className="sr-medicines__title">Medicamentos</h2>
        </div>
        <p className="sr-medicines__subtitle">Gerencie seus medicamentos cadastrados</p>
      </div>
      <button className="btn-primary" onClick={onAdd}>
        <Plus size={18} /> Adicionar
      </button>
    </div>
  )
}
