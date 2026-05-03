// src/views/redesign/ProfileRedesign.jsx
// Wave 10B — Profile Hub (rewrite completo)
// View centralizada: identidade + dados críticos + ferramentas de gestão

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Settings,
  MapPinHouse,
  Phone,
  BriefcaseMedical,
  ClipboardPlus,
  History,
  CloudDownload,
} from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@shared/utils/supabase'
import { parseLocalDate, getNow, getSaoPauloTime } from '@utils/dateUtils'
import { validateUserProfile, BRAZILIAN_STATES } from '@schemas/userProfileSchema'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import Button from '@shared/components/ui/Button'
import Modal from '@shared/components/ui/Modal'
import Loading from '@shared/components/ui/Loading'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import './profile/ProfileRedesign.css'

/**
 * Converte string JSON para base64 sem usar unescape() (deprecated)
 * @param {string} jsonString - JSON string a codificar
 * @returns {string} Base64 encoded string
 */
function jsonToBase64(jsonString) {
  return btoa(
    encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
}

/**
 * ProfileRedesign — Hub centralizado do Perfil
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback para navegação
 */
export default function Profile({ onNavigate }) {
  // ═══ States ═══
  // User & data
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [emergencyCard, setEmergencyCard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [qrMiniatureUrl, setQrMiniatureUrl] = useState(null)

  // Edit profile
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    birth_date: '',
    city: '',
    state: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Modais de ferramentas
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // ═══ Helper Functions ═══
  const showFeedback = useCallback((msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }, [])

  // ═══ Data Loading ═══
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true)

      // 1. Fetch auth user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // 2. Fetch user_settings (inclui novas colunas de perfil)
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      let settings = settingsData ?? {}

      // 3. Migrate display_name if null (one-time)
      // Copia de auth.user_metadata.name se existir
      if (settings && !settings.display_name && user.user_metadata?.name) {
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            display_name: user.user_metadata.name,
            updated_at: getNow().toISOString(),
          })
          .eq('user_id', user.id)

        if (!updateError) {
          settings.display_name = user.user_metadata.name
        }
      }

      // 4. Load emergency card data (offline-first via localStorage)
      const cardResult = await emergencyCardService.load()
      const cardData = cardResult.success ? cardResult.data : null

      // 5. One-time sync: localStorage → Supabase (corrige dívida técnica)
      // Se dados vieram de localStorage mas não existem em Supabase,
      // re-salva para ativar write-through que agora funciona (coluna recém-criada)
      if (cardData && cardResult.source === 'local' && settings && !settings.emergency_card) {
        // Fire and forget — não bloqueia o carregamento
        emergencyCardService.save(cardData)
      }

      setUser(user)
      setSettings(settings)
      setEmergencyCard(cardData)

      // 6. Initialize form with current data
      setProfileForm({
        display_name: settings?.display_name || user.user_metadata?.name || '',
        birth_date: settings?.birth_date || '',
        city: settings?.city || '',
        state: settings?.state || '',
      })
    } catch (err) {
      console.error('[ProfileRedesign] Error loading profile:', err)
      setError('Erro ao carregar perfil: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ═══ Derived Data ═══
  // Nome de exibição
  const displayName = useMemo(
    () => settings?.display_name || user?.user_metadata?.name || user?.email || 'Paciente',
    [settings?.display_name, user]
  )

  // Iniciais para avatar
  const initials = useMemo(
    () =>
      displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join(''),
    [displayName]
  )

  // Idade calculada
  const age = useMemo(() => {
    if (!settings?.birth_date) return null
    try {
      const birth = parseLocalDate(settings.birth_date)
      const today = getSaoPauloTime()
      let years = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        years--
      }
      return years >= 0 ? years : null
    } catch (err) {
      console.error('[ProfileRedesign] Falha ao calcular idade:', err)
      return null
    }
  }, [settings?.birth_date])

  // Tipo sanguíneo
  const bloodType = useMemo(() => emergencyCard?.blood_type, [emergencyCard])

  // Localização
  const location = useMemo(() => {
    const parts = [settings?.city, settings?.state].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }, [settings])

  // ═══ Effects ═══
  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Gerar QR code miniatura quando emergencyCard mudar
  useEffect(() => {
    if (!emergencyCard) {
      setQrMiniatureUrl(null)
      return
    }

    const generateMiniatureQR = async () => {
      try {
        // Formato compacto para QR code (mesma estrutura do EmergencyQRCode)
        const payload = {
          v: '1',
          n: displayName,
          bt: emergencyCard.blood_type || '',
          a: emergencyCard.allergies?.join(', ') || '',
          c: emergencyCard.emergency_contacts?.[0]
            ? `${emergencyCard.emergency_contacts[0].name} - ${emergencyCard.emergency_contacts[0].phone}`
            : '',
        }
        const qrString = jsonToBase64(JSON.stringify(payload))
        const miniatureUrl = await QRCode.toDataURL(qrString, {
          width: 100,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'L',
          type: 'image/png',
        })
        setQrMiniatureUrl(miniatureUrl)
      } catch (err) {
        console.error('[ProfileRedesign] Erro ao gerar QR miniatura:', err)
        setQrMiniatureUrl(null)
      }
    }

    generateMiniatureQR()
  }, [emergencyCard, displayName])

  // ═══ Handlers ═══
  const handleSaveProfile = useCallback(
    async (e) => {
      e.preventDefault()

      const validation = validateUserProfile(profileForm)
      if (!validation.success) {
        setError(validation.errors[0]?.message || 'Erro de validação')
        return
      }

      setIsSaving(true)
      setError(null)

      try {
        const { error: upsertError } = await supabase.from('user_settings').upsert(
          {
            user_id: user.id,
            ...validation.data,
            updated_at: getNow().toISOString(),
          },
          { onConflict: 'user_id' }
        )

        if (upsertError) throw upsertError

        // Update local state
        setSettings((prev) => ({ ...prev, ...validation.data }))
        setIsEditingProfile(false)
        showFeedback('Perfil atualizado com sucesso!')
      } catch (err) {
        console.error('[ProfileRedesign] Error saving profile:', err)
        setError('Erro ao salvar perfil: ' + err.message)
      } finally {
        setIsSaving(false)
      }
    },
    [profileForm, user?.id, showFeedback]
  )

  // ═══ Render Loading ═══
  if (isLoading) {
    return <Loading />
  }

  // ═══ Render Main ═══
  return (
    <div className="ph-view">
      {/* ── Header com gear (Profile é view mestra, sem back) ── */}
      <div className="ph-mobile-header">
        <h1 className="ph-mobile-header__title">Perfil</h1>
        <button
          className="ph-mobile-header__settings"
          onClick={() => onNavigate('settings')}
          aria-label="Configurações"
          type="button"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* ── Feedback messages ── */}
      {message && <div className="ph-message ph-message--success">{message}</div>}
      {error && <div className="ph-message ph-message--error">{error}</div>}

      {/* ── Header do Perfil ── */}
      <ProfileHeader
        initials={initials}
        displayName={displayName}
        age={age}
        bloodType={bloodType}
        location={location}
        onEditClick={() => setIsEditingProfile(true)}
      />

      {/* ── Cards principais (Emergency + Consulta) ── */}
      <div className="ph-cards-row">
        <EmergencyCard
          emergencyCard={emergencyCard}
          qrMiniatureUrl={qrMiniatureUrl}
          onNavigate={onNavigate}
        />
        <ConsultationCard onNavigate={onNavigate} />
      </div>

      {/* ── Ferramentas de Gestão ── */}
      <section className="ph-tools">
        <h2 className="ph-tools__title">Ferramentas de Gestão</h2>
        <div className="ph-tools__grid">
          <ToolCard
            icon={ClipboardPlus}
            label="Relatório PDF"
            description="Gerar relatório completo dos últimos 30 dias"
            onClick={() => setIsReportModalOpen(true)}
          />
          <ToolCard
            icon={History}
            label="Histórico de Doses"
            description="Calendário, adesão e heatmap"
            onClick={() => onNavigate('health-history')}
          />
          <ToolCard
            icon={CloudDownload}
            label="Exportar Dados"
            description="Formato CSV ou JSON para outros sistemas"
            onClick={() => setIsExportDialogOpen(true)}
          />
        </div>
      </section>

      {/* ── Modais ── */}
      <EditProfileModal
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        handleSaveProfile={handleSaveProfile}
        isSaving={isSaving}
      />
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes inline
// ─────────────────────────────────────────────────────────────

/**
 * ProfileHeader — Avatar, nome, metadados e botão de edição
 */
function ProfileHeader({ initials, displayName, age, bloodType, location, onEditClick }) {
  return (
    <div className="ph-header">
      <div className="ph-header__avatar">{initials}</div>
      <div className="ph-header__info">
        <h1 className="ph-header__name">{displayName}</h1>
        <div className="ph-header__meta">
          {age && <span className="ph-header__age">{age} anos</span>}
          {bloodType && bloodType !== 'desconhecido' && (
            <span className="ph-header__blood-type">{bloodType}</span>
          )}
          {location && (
            <span className="ph-header__location">
              <MapPinHouse size={16} /> {location}
            </span>
          )}
        </div>
      </div>
      <button className="ph-header__edit-btn" onClick={onEditClick} type="button">
        Editar Perfil
      </button>
    </div>
  )
}

/**
 * EmergencyCard — Resumo do cartão de emergência com QR miniatura
 */
function EmergencyCard({ emergencyCard, qrMiniatureUrl, onNavigate }) {
  if (!emergencyCard) {
    return (
      <div className="ph-emergency-card">
        <div className="ph-emergency-card__header">
          <span className="ph-emergency-card__label">IDENTIFICAÇÃO CRÍTICA</span>
          <h3>Cartão de Emergência</h3>
        </div>
        <div className="ph-emergency-card__empty">
          <p>Você ainda não configurou seu cartão de emergência.</p>
          <button
            className="ph-emergency-card__cta"
            onClick={() => onNavigate('emergency')}
            type="button"
          >
            Configurar Agora
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ph-emergency-card">
      <div className="ph-emergency-card__header">
        <span className="ph-emergency-card__label">IDENTIFICAÇÃO CRÍTICA</span>
        <h3>Cartão de Emergência</h3>
      </div>

      <div className="ph-emergency-card__body">
        {/* Alergias + Condições — só renderiza se houver conteúdo */}
        {(emergencyCard.allergies?.length > 0 || emergencyCard.conditions?.length > 0) && (
          <div className="ph-emergency-card__data">
            {emergencyCard.allergies?.length > 0 && (
              <div className="ph-emergency-card__field">
                <span className="ph-emergency-card__field-label">ALERGIAS</span>
                <div className="ph-emergency-card__tags">
                  {emergencyCard.allergies.map((allergy, i) => (
                    <span key={i} className="ph-emergency-card__tag ph-emergency-card__tag--danger">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {emergencyCard.conditions?.length > 0 && (
              <div className="ph-emergency-card__field">
                <span className="ph-emergency-card__field-label">CONDIÇÕES</span>
                <div className="ph-emergency-card__tags">
                  {emergencyCard.conditions.map((condition, i) => (
                    <span key={i} className="ph-emergency-card__tag ph-emergency-card__tag--info">
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contato + QR (lado a lado no mobile também) */}
        <div className="ph-emergency-card__contact-section">
          {emergencyCard.emergency_contacts?.[0] && (
            <div className="ph-emergency-card__field">
              <span className="ph-emergency-card__field-label">CONTATO</span>
              <span className="ph-emergency-card__contact-name">
                {emergencyCard.emergency_contacts[0].name}
              </span>
              <a
                href={`tel:${emergencyCard.emergency_contacts[0].phone}`}
                className="ph-emergency-card__contact-phone"
              >
                <Phone size={16} /> {emergencyCard.emergency_contacts[0].phone}
              </a>
            </div>
          )}

          {/* QR code miniatura */}
          {qrMiniatureUrl && (
            <div className="ph-emergency-card__qr">
              <img
                src={qrMiniatureUrl}
                alt="QR Code Cartão de Emergência"
                className="ph-emergency-card__qr-image"
              />
            </div>
          )}
        </div>
      </div>

      <button
        className="ph-emergency-card__action"
        onClick={() => onNavigate('emergency')}
        type="button"
      >
        Ver Cartão Completo →
      </button>
    </div>
  )
}

/**
 * ConsultationCard — Acesso rápido ao Modo Consulta Médica
 */
function ConsultationCard({ onNavigate }) {
  return (
    <button
      className="ph-consultation-card"
      onClick={() => onNavigate('consultation')}
      type="button"
    >
      <div className="ph-consultation-card__icon">
        <BriefcaseMedical size={32} />
      </div>
      <div className="ph-consultation-card__content">
        <h3>Modo Consulta Médica</h3>
        <p>Abre um resumo clínico otimizado para compartilhar com seu médico durante a consulta.</p>
      </div>
      <span className="ph-consultation-card__chevron">→</span>
    </button>
  )
}

/**
 * EditProfileModal — Formulário de edição do perfil
 */
function EditProfileModal({
  isOpen,
  onClose,
  profileForm,
  setProfileForm,
  handleSaveProfile,
  isSaving,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form className="ph-edit-form" onSubmit={handleSaveProfile}>
        <h2>Editar Perfil</h2>

        <label className="ph-edit-form__field">
          <span>Nome</span>
          <input
            type="text"
            value={profileForm.display_name}
            onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))}
            placeholder="Seu nome"
            required
          />
        </label>

        <label className="ph-edit-form__field">
          <span>Data de Nascimento</span>
          <input
            type="date"
            value={profileForm.birth_date}
            onChange={(e) => setProfileForm((f) => ({ ...f, birth_date: e.target.value }))}
          />
        </label>

        <div className="ph-edit-form__row">
          <label className="ph-edit-form__field">
            <span>Cidade</span>
            <input
              type="text"
              value={profileForm.city}
              onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Ex: São Paulo"
            />
          </label>

          <label className="ph-edit-form__field">
            <span>Estado</span>
            <select
              value={profileForm.state}
              onChange={(e) => setProfileForm((f) => ({ ...f, state: e.target.value }))}
            >
              <option value="">Selecionar</option>
              {BRAZILIAN_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ph-edit-form__actions">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * ToolCard — Card de ação para grid de ferramentas
 * @param {React.ComponentType} icon - Componente lucide-react
 */
function ToolCard({ icon: IconComponent, label, description, onClick }) {
  return (
    <button className="ph-tool-card" onClick={onClick} type="button">
      <span className="ph-tool-card__icon">
        {IconComponent ? <IconComponent size={24} /> : null}
      </span>
      <span className="ph-tool-card__label">{label}</span>
      {description && <span className="ph-tool-card__desc">{description}</span>}
    </button>
  )
}
