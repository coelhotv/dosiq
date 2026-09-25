/**
 * 085 C2 (smoke do PO) — fechar o assistente pelo X/Esc/fundo recarrega a lista de tratamentos.
 * Antes só o botão final recarregava: quem fechava pelo X via a lista sem o tratamento novo.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TreatmentModals from '../TreatmentModals'

vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ isOpen, onClose, children }) =>
    isOpen ? (
      <div>
        <button onClick={onClose}>fechar-modal</button>
        {children}
      </div>
    ) : null,
}))
vi.mock('@protocols/components/TreatmentWizard', () => ({ default: () => <div>wizard</div> }))
vi.mock('@protocols/components/ProtocolForm', () => ({ default: () => null }))
vi.mock('@medications/components/MedicineForm', () => ({ default: () => null }))
vi.mock('@protocols/components/TreatmentPlanForm', () => ({ default: () => null }))
vi.mock('@shared/components/ui/ConfirmDialog', () => ({ default: () => null }))
vi.mock('@shared/services', () => ({
  cachedMedicineService: {}, cachedTreatmentPlanService: {}, cachedProtocolService: {},
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('TreatmentModals — assistente (085 C2)', () => {
  it('fechar o modal do assistente chama refetch', () => {
    const refetch = vi.fn()
    const setWizardOpen = vi.fn()
    render(
      <TreatmentModals
        state={{
          wizardOpen: true, setWizardOpen, wizardMedicine: null, setWizardMedicine: vi.fn(),
          formOpen: false, setFormOpen: vi.fn(), formProtocol: null, setFormProtocol: vi.fn(),
          medicines: [], treatmentPlans: [],
          medicineCreateOpen: false, setMedicineCreateOpen: vi.fn(),
          planFormOpen: false, setPlanFormOpen: vi.fn(), planEditTarget: null, setPlanEditTarget: vi.fn(),
          deleteTreatmentTarget: null, setDeleteTreatmentTarget: vi.fn(),
          deletePlanTarget: null, setDeletePlanTarget: vi.fn(),
          refetch, refresh: vi.fn(),
          handleDeleteTreatmentConfirm: vi.fn(), handleDeletePlanConfirm: vi.fn(),
        }}
      />
    )
    fireEvent.click(screen.getByText('fechar-modal'))
    expect(setWizardOpen).toHaveBeenCalledWith(false)
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
