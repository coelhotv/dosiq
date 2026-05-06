import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useTreatmentWizardState } from '@protocols/hooks/useTreatmentWizardState'
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
}) {
  const { refresh, medicines } = useDashboard()

  const state = useTreatmentWizardState({
    onComplete,
    preselectedMedicine,
    treatmentPlanId,
    refresh,
  })

  return (
    <div className="wizard">
      {/* Progress dots */}
      {state.step < 4 && (
        <div className="wizard__progress">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`wizard__dot ${s <= state.step ? 'wizard__dot--active' : ''}`} />
          ))}
          <span className="wizard__step-label">{state.step}/3</span>
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
            />
          )}

          {state.step === 3 && (
            <TreatmentWizardStep3
              stockData={state.stockData}
              updateStock={state.updateStock}
              error={state.error}
              goBack={state.goBack}
              handleComplete={state.handleComplete}
              isSubmitting={state.isSubmitting}
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
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

