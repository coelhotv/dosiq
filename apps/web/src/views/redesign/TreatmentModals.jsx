/**
 * TreatmentModals — Orquestração de modais da view de tratamentos.
 */
import Modal from '@shared/components/ui/Modal'
import TreatmentWizard from '@protocols/components/TreatmentWizard'
import ProtocolForm from '@protocols/components/ProtocolForm'
import MedicineForm from '@medications/components/MedicineForm'
import TreatmentPlanForm from '@protocols/components/TreatmentPlanForm'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
import { medicineService, treatmentPlanService, protocolService } from '@shared/services'

export default function TreatmentModals({
  state,
}) {
  const {
    wizardOpen, setWizardOpen, wizardMedicine, setWizardMedicine,
    formOpen, setFormOpen, formProtocol, setFormProtocol,
    medicines, treatmentPlans,
    medicineCreateOpen, setMedicineCreateOpen,
    planFormOpen, setPlanFormOpen, planEditTarget, setPlanEditTarget,
    deleteTreatmentTarget, setDeleteTreatmentTarget,
    deletePlanTarget, setDeletePlanTarget,
    refetch, refresh,
    handleDeleteTreatmentConfirm, handleDeletePlanConfirm,
  } = state

  return (
    <>
      <Modal isOpen={wizardOpen} onClose={() => { setWizardOpen(false); setWizardMedicine(null); }}>
        <TreatmentWizard
          preselectedMedicine={wizardMedicine || undefined}
          onComplete={() => { setWizardOpen(false); setWizardMedicine(null); refetch(); }}
          onCancel={() => { setWizardOpen(false); setWizardMedicine(null); }}
        />
      </Modal>

      <Modal isOpen={formOpen} onClose={() => { setFormOpen(false); setFormProtocol(null); }}>
        {formProtocol && (
          <ProtocolForm
            medicines={medicines}
            treatmentPlans={treatmentPlans}
            protocol={formProtocol}
            onSave={async (data) => {
              await protocolService.update(formProtocol.id, data);
              setFormOpen(false); setFormProtocol(null); refetch();
            }}
            onCancel={() => { setFormOpen(false); setFormProtocol(null); }}
            mode="full" showTitration showTreatmentPlan
          />
        )}
      </Modal>

      <Modal isOpen={medicineCreateOpen} onClose={() => setMedicineCreateOpen(false)}>
        {medicineCreateOpen && (
          <MedicineForm
            onSave={async (data) => {
              const saved = await medicineService.create(data);
              setMedicineCreateOpen(false);
              refresh({ force: true }); refetch();
              return saved;
            }}
            onCancel={() => setMedicineCreateOpen(false)}
          />
        )}
      </Modal>

      <Modal isOpen={planFormOpen} onClose={() => { setPlanFormOpen(false); setPlanEditTarget(null); }}>
        {planFormOpen && (
          <TreatmentPlanForm
            plan={planEditTarget || undefined}
            onSave={async (data) => {
              if (planEditTarget) await treatmentPlanService.update(planEditTarget.id, data);
              else await treatmentPlanService.create(data);
              setPlanFormOpen(false); setPlanEditTarget(null); refetch();
            }}
            onCancel={() => { setPlanFormOpen(false); setPlanEditTarget(null); }}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTreatmentTarget}
        title={`Excluir tratamento "${deleteTreatmentTarget?.medicineName}"?`}
        message="Esta ação não pode ser desfeita. O histórico de doses associado será mantido."
        confirmLabel="Excluir" variant="danger"
        onConfirm={handleDeleteTreatmentConfirm}
        onCancel={() => setDeleteTreatmentTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!deletePlanTarget}
        title={`Excluir plano "${deletePlanTarget?.label}"?`}
        message="Os tratamentos associados a este plano não serão excluídos, apenas o agrupamento."
        confirmLabel="Excluir" variant="danger"
        onConfirm={handleDeletePlanConfirm}
        onCancel={() => setDeletePlanTarget(null)}
      />
    </>
  )
}
