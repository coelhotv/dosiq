/**
 * ProfileRedesign — Hub centralizado do Perfil
 */
import { useState } from 'react'
import { Settings, MapPinHouse, BriefcaseMedical } from 'lucide-react'
import Loading from '@shared/components/ui/Loading'
import { useProfileState } from '@features/profile/hooks/useProfileState'
import EmergencyCard from './profile/EmergencyCard'
import ProfileTools from './profile/ProfileTools'
import ProfileModals from './profile/ProfileModals'
import './profile/ProfileRedesign.css'

export default function Profile({ onNavigate }) {
  const {
    isLoading, error, message, initials, displayName, age, bloodType, location,
    emergencyCard, qrMiniatureUrl, profileForm, setProfileForm, handleSaveProfile,
    isSaving, isEditingProfile, setIsEditingProfile
  } = useProfileState()

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  if (isLoading) return <Loading />

  return (
    <div className="ph-view">
      <div className="ph-mobile-header">
        <h1 className="ph-mobile-header__title">Perfil</h1>
        <button className="ph-mobile-header__settings" onClick={() => onNavigate('account-settings')} aria-label="Configurações da conta" type="button">
          <Settings size={24} />
        </button>
      </div>

      {message && <div className="ph-message ph-message--success">{message}</div>}
      {error && <div className="ph-message ph-message--error">{error}</div>}

      <div className="ph-header">
        <div className="ph-header__avatar">{initials}</div>
        <div className="ph-header__info">
          <h1 className="ph-header__name">{displayName}</h1>
          <div className="ph-header__meta">
            {age && <span className="ph-header__age">{age} anos</span>}
            {bloodType && bloodType !== 'desconhecido' && <span className="ph-header__blood-type">{bloodType}</span>}
            {location && <span className="ph-header__location"><MapPinHouse size={16} /> {location}</span>}
          </div>
        </div>
        <button className="ph-header__edit-btn" onClick={() => setIsEditingProfile(true)} type="button">Editar Perfil</button>
      </div>

      <div className="ph-cards-row">
        <EmergencyCard emergencyCard={emergencyCard} qrMiniatureUrl={qrMiniatureUrl} onNavigate={onNavigate} />
        <button className="ph-consultation-card" onClick={() => onNavigate('consultation')} type="button">
          <div className="ph-consultation-card__icon"><BriefcaseMedical size={32} /></div>
          <div className="ph-consultation-card__content">
            <h3>Modo Consulta Médica</h3>
            <p>Resumo clínico otimizado para compartilhar com seu médico.</p>
          </div>
          <span className="ph-consultation-card__chevron">→</span>
        </button>
      </div>

      <ProfileTools onNavigate={onNavigate} setIsReportModalOpen={setIsReportModalOpen} setIsExportDialogOpen={setIsExportDialogOpen} />

      <ProfileModals
        isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile} profileForm={profileForm} setProfileForm={setProfileForm}
        handleSaveProfile={handleSaveProfile} isSaving={isSaving} isReportModalOpen={isReportModalOpen} setIsReportModalOpen={setIsReportModalOpen}
        isExportDialogOpen={isExportDialogOpen} setIsExportDialogOpen={setIsExportDialogOpen}
      />
    </div>
  )
}
