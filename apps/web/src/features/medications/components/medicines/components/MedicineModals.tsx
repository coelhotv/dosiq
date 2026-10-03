import Modal from '@shared/components/ui/Modal'
import MedicineForm from '@medications/components/MedicineForm'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'

// 094 FR-008: o texto descreve o que o arquivamento entrega — nada além (INV-4).
export const MEDICINE_DELETE_MESSAGE =
  'O medicamento sai da lista e do estoque. O seu histórico de doses continua salvo.'

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

      {/* 094: excluir arquiva (histórico fica). Com tratamento não arquivado o banco recusa
          (DQ941) — a UI bloqueia antes, como o mobile (P1.5). */}
      {medicineDependencies[deleteTarget?.id]?.hasProtocols ? (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title={`Não é possível excluir "${deleteTarget?.name}"`}
          message="Este medicamento ainda tem tratamentos. Exclua os tratamentos dele antes de excluir o medicamento."
          confirmLabel="Entendi"
          cancelLabel="Fechar"
          variant="warning"
          onConfirm={() => setDeleteTarget(null)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title={`Excluir "${deleteTarget?.name}"?`}
          message={MEDICINE_DELETE_MESSAGE}
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

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
