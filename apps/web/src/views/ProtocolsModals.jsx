/**
 * ProtocolsModals — Modais de protocolo e plano de tratamento da view Protocols.
 */
import Modal from '@shared/components/ui/Modal'
import ProtocolForm from '@protocols/components/ProtocolForm'
import TreatmentPlanForm from '@protocols/components/TreatmentPlanForm'

export default function ProtocolsModals({
  isModalOpen,
  isPlanModalOpen,
  editingProtocol,
  editingPlan,
  medicines,
  treatmentPlans,
  initialParams,
  onSave,
  onSavePlan,
  onCloseProtocol,
  onClosePlan,
}) {
  return (
    <>
      <Modal isOpen={isModalOpen} onClose={onCloseProtocol}>
        <ProtocolForm
          medicines={medicines}
          treatmentPlans={treatmentPlans}
          protocol={editingProtocol}
          initialValues={initialParams ? { medicine_id: initialParams.medicineId } : null}
          onSave={onSave}
          onCancel={onCloseProtocol}
        />
      </Modal>

      <Modal isOpen={isPlanModalOpen} onClose={onClosePlan}>
        <TreatmentPlanForm
          plan={editingPlan}
          onSave={onSavePlan}
          onCancel={onClosePlan}
        />
      </Modal>
    </>
  )
}
