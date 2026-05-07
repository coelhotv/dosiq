import Modal from '@shared/components/ui/Modal'
import MedicineForm from '@medications/components/MedicineForm'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'

export default function MedicineModals({
  isModalOpen,
  setIsModalOpen,
  editingMedicine,
  setEditingMedicine,
  handleSave,
  deleteTarget,
  setDeleteTarget,
  handleDeleteConfirm,
  medicineDependencies,
  showProtocolPrompt,
  handleProtocolPromptConfirm,
  handleProtocolPromptCancel,
}) {
  return (
    <>
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingMedicine(null)
        }}
      >
        <MedicineForm
          medicine={editingMedicine}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingMedicine(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Excluir "${deleteTarget?.name}"?`}
        message={
          medicineDependencies[deleteTarget?.id]?.hasProtocols ||
          medicineDependencies[deleteTarget?.id]?.hasStock
            ? 'Este medicamento possui tratamentos e/ou estoque associados. Esta ação não pode ser desfeita.'
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={showProtocolPrompt}
        title="Medicamento criado!"
        message="Deseja criar um tratamento para ele agora?"
        confirmLabel="Criar Tratamento"
        cancelLabel="Depois"
        variant="default"
        onConfirm={handleProtocolPromptConfirm}
        onCancel={handleProtocolPromptCancel}
      />
    </>
  )
}
