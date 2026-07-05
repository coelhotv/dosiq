/**
 * ProfileModals — Modais da view de perfil.
 */
import Modal from '@shared/components/ui/Modal'
import Button from '@shared/components/ui/Button'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import { BRAZILIAN_STATES } from '@schemas/userProfileSchema'

export default function ProfileModals({
  isEditingProfile, setIsEditingProfile, profileForm, setProfileForm,
  handleSaveProfile, isSaving, isReportModalOpen, setIsReportModalOpen,
  isExportDialogOpen, setIsExportDialogOpen
}) {
  return (
    <>
      <Modal isOpen={isEditingProfile} onClose={() => setIsEditingProfile(false)}>
        <form className="ph-edit-form" onSubmit={handleSaveProfile}>
          <h2>Editar Perfil</h2>
          <label className="ph-edit-form__field">
            <span>Nome</span>
            <input type="text" value={profileForm.display_name} onChange={(e) => setProfileForm(f => ({ ...f, display_name: e.target.value }))} required />
          </label>
          <label className="ph-edit-form__field">
            <span>Data de Nascimento</span>
            <input type="date" value={profileForm.birth_date} onChange={(e) => setProfileForm(f => ({ ...f, birth_date: e.target.value }))} />
          </label>
          <div className="ph-edit-form__row">
            <label className="ph-edit-form__field">
              <span>Cidade</span>
              <input type="text" value={profileForm.city} onChange={(e) => setProfileForm(f => ({ ...f, city: e.target.value }))} />
            </label>
            <label className="ph-edit-form__field">
              <span>Estado</span>
              <select value={profileForm.state} onChange={(e) => setProfileForm(f => ({ ...f, state: e.target.value }))}>
                <option value="">Selecionar</option>
                {BRAZILIAN_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>
          </div>
          <div className="ph-edit-form__actions">
            <Button variant="ghost" onClick={() => setIsEditingProfile(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />
    </>
  )
}
