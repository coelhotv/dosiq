import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import { useTreatmentWizardState } from '@protocols/hooks/useTreatmentWizardState'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import TreatmentWizardStep1 from './steps/TreatmentWizardStep1'
import TreatmentWizardStep2 from './steps/TreatmentWizardStep2'
import TreatmentWizardStep3 from './steps/TreatmentWizardStep3'
import TreatmentWizardStep4 from './steps/TreatmentWizardStep4'
import './TreatmentWizard.css'

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
}

export default function TreatmentWizard({
  onComplete,
  onCancel,
  preselectedMedicine,
  treatmentPlanId,
}: any) {
  const { refresh, medicines } = useDashboard()
  // Spec 044 F3 (FR-003): sem controle de estoque, a etapa "Estoque Atual" (Step3) some
  // do wizard — a contagem de passos tem que refletir isso (nunca "3 de 4" com 3 passos).
  const { enabled: stockTrackingEnabled } = useStockTracking()

  const state = useTreatmentWizardState({
    onComplete,
    preselectedMedicine,
    treatmentPlanId,
    refresh,
  })

  const progressSteps = stockTrackingEnabled ? [1, 2, 3] : [1, 2]

  return (
    <div className="wizard">
      {/* Progress dots */}
      {state.step < 4 && (
        <div className="wizard__progress">
          {progressSteps.map((s) => (
            <div key={s} className={`wizard__dot ${s <= state.step ? 'wizard__dot--active' : ''}`} />
          ))}
          <span className="wizard__step-label">{state.step}/{progressSteps.length}</span>
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait" custom={state.direction}>
        <motion.div
          key={state.step}
          custom={state.direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="wizard__content"
        >
          {state.step === 1 && (
            <TreatmentWizardStep1
              medicines={medicines}
              medicineMode={state.medicineMode}
              setMedicineMode={state.setMedicineMode}
              selectedExistingMedicine={state.selectedExistingMedicine}
              setSelectedExistingMedicine={state.setSelectedExistingMedicine}
              medicineData={state.medicineData}
              updateMedicine={state.updateMedicine}
              handleMedicineSelect={state.handleMedicineSelect}
              handleLaboratorySelect={state.handleLaboratorySelect}
              onCancel={onCancel}
              goNext={state.goNext}
              isMedicineValid={state.isMedicineValid}
            />
          )}

          {state.step === 2 && (
            <TreatmentWizardStep2
              protocolData={state.protocolData}
              updateProtocol={state.updateProtocol}
              addTime={state.addTime}
              removeTime={state.removeTime}
              updateTime={state.updateTime}
              availablePlans={state.availablePlans}
              planMode={state.planMode}
              setPlanMode={state.setPlanMode}
              selectedPlanId={state.selectedPlanId}
              setSelectedPlanId={state.setSelectedPlanId}
              newPlanName={state.newPlanName}
              setNewPlanName={state.setNewPlanName}
              newPlanEmoji={state.newPlanEmoji}
              setNewPlanEmoji={state.setNewPlanEmoji}
              goBack={state.goBack}
              goNext={state.goNext}
              handleComplete={state.handleComplete}
              isProtocolValid={state.isProtocolValid}
              medicine={state.medicineMode === 'existing' ? state.selectedExistingMedicine : state.medicineData}
              stockTrackingEnabled={stockTrackingEnabled}
            />
          )}

          {state.step === 3 && stockTrackingEnabled && (
            <TreatmentWizardStep3
              stockData={state.stockData}
              updateStock={state.updateStock}
              error={state.error}
              goBack={state.goBack}
              handleComplete={state.handleComplete}
              isSubmitting={state.isSubmitting}
              medicine={state.medicineMode === 'existing' ? state.selectedExistingMedicine : state.medicineData}
            />
          )}

          {state.step === 4 && (
            <TreatmentWizardStep4
              result={state.result}
              medicineData={state.medicineData}
              protocolData={state.protocolData}
              stockData={state.stockData}
              onComplete={onComplete}
              resetWizard={state.resetWizard}
              stockTrackingEnabled={stockTrackingEnabled}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

