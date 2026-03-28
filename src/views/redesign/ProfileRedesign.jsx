// src/views/redesign/ProfileRedesign.jsx
import { useState, useEffect } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { supabase, signOut } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import ProfileHeaderRedesign from './profile/ProfileHeaderRedesign'
import ProfileSectionRedesign from './profile/ProfileSectionRedesign'
import ProfileLinkRedesign from './profile/ProfileLinkRedesign'
import './profile/ProfileRedesign.css'

// Definição das seções de navegação
const SECTIONS = [
  { id: 'health',   label: 'Saúde & Histórico',  icon: '📊' },
  { id: 'reports',  label: 'Relatórios & Dados',  icon: '📄' },
]

export default function ProfileRedesign({ onNavigate }) {
  // States
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('health')

  // Effects
  useEffect(() => {
    loadProfile()
  }, [])

  // Handlers
  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    } catch (err) {
      console.error(err)
      setError('Falha ao carregar os dados do perfil. Por favor, recarregue a página.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try { await signOut() } catch (err) { console.error(err) }
  }

  if (isLoading) return <Loading />

  const initials = (user?.user_metadata?.name || user?.email || 'P')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  // Section content blocks
  const sectionHealth = (
    <ProfileSectionRedesign title="Saúde & Histórico">
      <ProfileLinkRedesign icon="📊" label="Minha Saúde"          onClick={() => onNavigate('health-history')} />
      <ProfileLinkRedesign icon="🆘" label="Cartão de Emergência" onClick={() => onNavigate('emergency')} />
      <ProfileLinkRedesign icon="👨‍⚕️" label="Modo Consulta Médica" onClick={() => onNavigate('consultation')} />
    </ProfileSectionRedesign>
  )

  const sectionReports = (
    <ProfileSectionRedesign title="Relatórios & Dados">
      <ProfileLinkRedesign icon="📄" label="Relatório PDF"  onClick={() => setIsReportModalOpen(true)} />
      <ProfileLinkRedesign icon="📤" label="Exportar Dados" onClick={() => setIsExportDialogOpen(true)} />
    </ProfileSectionRedesign>
  )

  return (
    <div className="pr-view">
      {error && <div className="pr-message pr-message--error">{error}</div>}

      <div className="pr-layout">
        <aside className="pr-panel">
          <div className="pr-panel__header">
            <div className="pr-panel__avatar" aria-hidden="true">{initials}</div>
            <div className="pr-panel__info">
              <span className="pr-panel__name">{user?.user_metadata?.name || 'Paciente'}</span>
              {user?.email && <span className="pr-panel__email">{user.email}</span>}
            </div>
            <button
              className="pr-panel__settings-btn"
              onClick={() => onNavigate('settings')}
              aria-label="Configurações"
              type="button"
            >
              <Settings size={20} />
            </button>
          </div>

          <nav className="pr-panel__nav" aria-label="Seções do perfil">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pr-panel-nav__item${activeSection === s.id ? ' pr-panel-nav__item--active' : ''}`}
                onClick={() => setActiveSection(s.id)}
                aria-current={activeSection === s.id ? 'page' : undefined}
              >
                <span className="pr-panel-nav__icon" aria-hidden="true">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="pr-panel__logout">
            <button className="pr-panel__logout-btn" onClick={handleLogout} type="button">
              <LogOut size={16} aria-hidden="true" />
              Sair da Conta
            </button>
          </div>
        </aside>

        <div className="pr-content">
          <div className="pr-header pr-header--mobile-only">
            <div className="pr-header__avatar" aria-hidden="true">{initials}</div>
            <div className="pr-header__info">
              <h2 className="pr-header__name">{user?.user_metadata?.name || 'Paciente'}</h2>
              {user?.email && <span className="pr-header__email">{user.email}</span>}
            </div>
            <button
              className="pr-header__settings-btn"
              onClick={() => onNavigate('settings')}
              aria-label="Configurações"
              type="button"
            >
              <Settings size={22} />
            </button>
          </div>

          <div data-section="health"   className="pr-section-slot" data-active={activeSection === 'health'   ? 'true' : undefined}>{sectionHealth}</div>
          <div data-section="reports"  className="pr-section-slot" data-active={activeSection === 'reports'  ? 'true' : undefined}>{sectionReports}</div>

          <div className="pr-logout pr-logout--mobile-only">
            <button className="pr-logout__btn" onClick={handleLogout} type="button">
              Sair da Conta
            </button>
          </div>
        </div>
      </div>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
