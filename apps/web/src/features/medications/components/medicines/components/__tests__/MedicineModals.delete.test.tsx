// MedicineModals.delete.test.tsx — spec 094 (US4 / FR-008 / P1.5)
// Excluir medicamento arquiva. Com tratamento não arquivado a web bloqueia (como o mobile);
// sem, o aviso diz o que acontece de fato: o medicamento sai da lista e o histórico de doses fica.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MedicineModals, { MEDICINE_DELETE_MESSAGE } from '../MedicineModals'

vi.mock('@medications/components/MedicineForm', () => ({ default: () => null }))

const base = {
  isModalOpen: false,
  setIsModalOpen: vi.fn(),
  editingMedicine: null,
  setEditingMedicine: vi.fn(),
  handleSave: vi.fn(),
  deleteTarget: { id: 'm1', name: 'Losartana' },
  setDeleteTarget: vi.fn(),
  handleDeleteConfirm: vi.fn(),
  showProtocolPrompt: false,
  handleProtocolPromptConfirm: vi.fn(),
  handleProtocolPromptCancel: vi.fn(),
}

describe('MedicineModals — exclusão (094)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('com tratamento não arquivado: bloqueia e não chama a exclusão', () => {
    render(<MedicineModals {...base} medicineDependencies={{ m1: { hasProtocols: true, hasStock: false } }} />)
    expect(screen.getByText(/Exclua os tratamentos dele antes/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(base.handleDeleteConfirm).not.toHaveBeenCalled()
    expect(base.setDeleteTarget).toHaveBeenCalledWith(null)
  })

  it('sem tratamento: avisa que o histórico fica e confirma a exclusão', () => {
    render(<MedicineModals {...base} medicineDependencies={{ m1: { hasProtocols: false, hasStock: true } }} />)
    expect(screen.getByText(MEDICINE_DELETE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(/não pode ser desfeita/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(base.handleDeleteConfirm).toHaveBeenCalled()
  })
})
