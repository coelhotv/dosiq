import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { TriangleAlert, PillBottle, Phone, FilePen, FilePlusCorner, QrCode, Printer, Pencil, Siren, WifiOff } from 'lucide-react'

/**
 * Renderiza a seção de alergias do cartão de emergência.
 */
function AllergiesSection({ allergies }) {
  return (
    <section className="emergency-section allergies-section">
      <h2 className="section-label"><TriangleAlert size={22} /> Alergias</h2>
      {allergies && allergies.length > 0 ? (
        <ul className="allergies-list">
          {allergies.map((allergy, index) => (
            <li key={index} className="allergy-item">{allergy}</li>
          ))}
        </ul>
      ) : (
        <p className="no-data">Nenhuma alergia registrada</p>
      )}
    </section>
  )
}

/**
 * Renderiza a seção de medicamentos ativos do cartão de emergência.
 */
function MedicationsSection({ activeMedications }) {
  return (
    <section className="emergency-section medications-section">
      <h2 className="section-label"><PillBottle size={22} /> Medicamentos em Uso</h2>
      {activeMedications.length > 0 ? (
        <ul className="medications-list">
          {activeMedications.map((med, index) => {
            const pillLabel = med.dosagePerIntake === 1 ? 'comp.' : 'comp.'
            const doseStr =
              med.dosagePerIntake != null
                ? `${med.dosagePerIntake} ${pillLabel}`
                : null
            const pillDosageStr =
              med.dosagePerPill
                ? `${med.dosagePerPill}${med.unit ? ` ${med.unit}` : ''}/comp.`
                : null
            const frequencyStr =
              med.dosesPerDay != null && med.frequency === 'diário'
                ? `${med.dosesPerDay}x ao dia`
                : med.frequency
                  ? FREQUENCY_LABELS[med.frequency] || med.frequency
                  : null

            return (
              <li key={index} className="medication-item">
                <span className="med-name">
                  {med.name}
                  {pillDosageStr && <span className="med-dosage"> — {med.dosagePerPill}{med.unit ? ` ${med.unit}` : ''}</span>}
                </span>
                <div className="med-detail">
                  {doseStr && <span className="med-dose">{doseStr}</span>}
                  {frequencyStr && <span className="med-frequency">{frequencyStr}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="no-data">Nenhum medicamento ativo</p>
      )}
    </section>
  )
}

/**
 * Renderiza a seção de contatos de emergência.
 */
function ContactsSection({ contacts }) {
  return (
    <section className="emergency-section contacts-section">
      <h2 className="section-label"><Phone size={22} /> Contatos de Emergência</h2>
      {contacts && contacts.length > 0 ? (
        <div className="contacts-grid">
          {contacts.map((contact, index) => (
            <div key={index} className="contact-card">
              <div className="contact-name">{contact.name}</div>
              <div className="contact-phone">
                <a href={`tel:${contact.phone}`}>{contact.phone}</a>
              </div>
              <div className="contact-relationship">{contact.relationship}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-data">Nenhum contato registrado</p>
      )}
    </section>
  )
}

import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import { BLOOD_TYPE_LABELS } from '@schemas/emergencyCardSchema'
import { FREQUENCY_LABELS } from '@schemas/protocolSchema'
import { parseISO } from '@utils/dateUtils'
import EmergencyQRCode from './EmergencyQRCode'
import './EmergencyCard.css'

/**
 * Visualização do Cartão de Emergência.
 *
 * Exibe informações críticas em formato de fácil leitura para situações de emergência.
 * Inclui medicamentos ativos do usuário, contatos, alergias e tipo sanguíneo.
 * Indicador de offline quando sem conexão. Layout otimizado para impressão.
 *
 * @param {Object} props - Propriedades do componente
 * @param {Object} [props.data] - Dados do cartão (se não fornecido, carrega do serviço)
 * @param {Function} [props.onEdit] - Callback para edição do cartão
 * @returns {JSX.Element} Visualização do cartão de emergência
 */
export default function EmergencyCardView({ data, onEdit }) {
  // ===== STATES (R-010: Hook Order) =====
  const [cardData, setCardData] = useState(data || null)
  const [isLoading, setIsLoading] = useState(!data)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // ===== CONTEXT (R-010: Hook Order) =====
  const { medicines, protocols, isLoading: isDashboardLoading } = useDashboard()

  // ===== MEMOS (R-010: Hook Order) =====

  /**
   * Filtra medicamentos ativos com base nos protocolos ativos.
   */
  const activeMedications = useMemo(() => {
    if (isDashboardLoading || !medicines || !protocols) return []

    // IDs dos protocolos ativos
    const activeProtocolMedicineIds = new Set(
      protocols.filter((p) => p.active).map((p) => p.medicine_id)
    )

    // Filtra medicamentos que têm protocolos ativos
    const protocolByMedicineId = new Map(
      protocols.filter((p) => p.active).map((p) => [p.medicine_id, p])
    )

    return medicines
      .filter((med) => activeProtocolMedicineIds.has(med.id))
      .map((med) => {
        const protocol = protocolByMedicineId.get(med.id)
        return {
          name: med.name,
          dosagePerPill: med.dosage_per_pill,
          unit: med.dosage_unit || '',
          dosagePerIntake: protocol?.dosage_per_intake ?? null,
          dosesPerDay: protocol?.time_schedule?.length ?? null,
          frequency: protocol?.frequency ?? null,
        }
      })
  }, [medicines, protocols, isDashboardLoading])

  /**
   * Formata a data de última atualização.
   */
  const formattedLastUpdated = useMemo(() => {
    if (!cardData?.last_updated) return 'Não disponível'

    try {
      const date = parseISO(cardData.last_updated)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Data inválida'
    }
  }, [cardData])

  // ===== EFFECTS (R-010: Hook Order) =====

  /**
   * Carrega dados do cartão se não fornecidos via props.
   */
  useEffect(() => {
    if (!data) {
      const loadCardData = async () => {
        setIsLoading(true)
        const result = await emergencyCardService.load()
        if (result.success) {
          setCardData(result.data)
        }
        setIsLoading(false)
      }

      startTransition(() => {
        loadCardData()
      })
    }
  }, [data])

  /**
   * Monitora status de conexão.
   */
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ===== HANDLERS (R-010: Hook Order) =====

  /**
   * Imprime o cartão de emergência.
   */
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // ===== RENDER =====

  if (isLoading) {
    return (
      <div className="emergency-card-view emergency-card-loading">
        <div className="loading-spinner"></div>
        <p>Carregando cartão de emergência...</p>
      </div>
    )
  }

  if (!cardData) {
    return (
      <div className="emergency-card-view emergency-card-empty">
        <div className="empty-icon"><FilePlusCorner size={48} /></div>
        <h2>Nenhum Cartão de Emergência</h2>
        <p>Você ainda não configurou seu cartão de emergência.</p>
        <button className="btn-emergency" onClick={onEdit}>
          Configurar Agora
        </button>
      </div>
    )
  }

  return (
    <div className="emergency-card-view">
      {/* Indicador Offline */}
      {isOffline && (
        <div className="offline-indicator">
          <WifiOff size={16} className="offline-icon" />
          <span>Modo Offline - Dados podem estar desatualizados</span>
        </div>
      )}

      {/* Cabeçalho do Cartão */}
      <header className="emergency-card-header">
        <h1 className="emergency-title"><Siren size={32} /> CARTÃO DE EMERGÊNCIA</h1>
        <p className="emergency-subtitle">Informações médicas críticas</p>
      </header>

      {/* Tipo Sanguíneo - Destaque */}
      <section className="emergency-section blood-type-section">
        <h2 className="section-label">Tipo Sanguíneo</h2>
        <div className="blood-type-display">
          {BLOOD_TYPE_LABELS[cardData.blood_type] || 'Desconhecido'}
        </div>
      </section>

      <AllergiesSection allergies={cardData.allergies} />
      <MedicationsSection activeMedications={activeMedications} />
      <ContactsSection contacts={cardData.emergency_contacts} />

      {/* Observações */}
      {cardData.notes && (
        <section className="emergency-section notes-section">
          <h2 className="section-label"><FilePen size={22} /> Observações</h2>
          <p className="notes-content">{cardData.notes}</p>
        </section>
      )}

      {/* QR Code para Emergências */}
      <section className="emergency-section qr-section">
        <h2 className="section-label"><QrCode size={22} /> QR Code de Emergência</h2>
        <EmergencyQRCode
          cardData={cardData}
          medications={activeMedications}
          lastUpdated={cardData.last_updated}
        />
      </section>

      {/* Rodapé */}
      <footer className="emergency-card-footer">
        <p className="last-updated">Última atualização: {formattedLastUpdated}</p>
        <div className="footer-actions">
          <button className="btn-emergency-outline" onClick={handlePrint}>
            <Printer size={16} /> Imprimir
          </button>
          {onEdit && (
            <button className="btn-emergency" onClick={onEdit}>
              <Pencil size={16} /> Editar
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
