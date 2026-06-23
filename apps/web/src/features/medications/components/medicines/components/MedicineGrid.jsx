import EmptyState from '@shared/components/ui/EmptyState'
import MedicineCard from '@medications/components/MedicineCard'

export default function MedicineGrid({ 
  medicines, 
  filteredMedicines, 
  onAdd, 
  onEdit, 
  onDelete, 
  medicineDependencies 
}) {
  if (medicines?.length === 0) {
    return (
      <EmptyState
        illustration="protocols"
        title="Nenhum medicamento cadastrado"
        description="Cadastre seus medicamentos para começar a controlar sua saúde"
        ctaLabel="Cadastrar Medicamento"
        onCtaClick={onAdd}
      />
    )
  }

  return (
    <div className="sr-medicines__grid">
      {filteredMedicines.map((medicine) => (
        <MedicineCard
          key={medicine.id}
          medicine={medicine}
          onEdit={onEdit}
          onDelete={onDelete}
          hasDependencies={
            medicineDependencies[medicine.id]?.hasProtocols ||
            medicineDependencies[medicine.id]?.hasStock
          }
        />
      ))}
    </div>
  )
}
