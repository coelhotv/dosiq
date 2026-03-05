import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import { BLOOD_TYPE_LABELS } from '@schemas/emergencyCardSchema'
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
    return medicines
      .filter((med) => activeProtocolMedicineIds.has(med.id))
      .map((med) => ({
        name: med.name,
        dosage: med.dosage_per_pill,
        unit: med.dosage_unit || '',
      }))
  }, [medicines, protocols, isDashboardLoading])

  /**
   * Formata a data de última atualização.
   */
  const formattedLastUpdated = useMemo(() => {
    if (!cardData?.last_updated) return 'Não disponível'

    try {
      const date = new Date(cardData.last_updated)
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

      loadCardData()
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
        <div className="empty-icon">📋</div>
        <h2>Nenhum Cartão de Emergência</h2>
        <p>Você ainda não configurou seu cartão de emergência.</p>
        <button className="btn btn-primary" onClick={onEdit}>
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
          <span className="offline-icon">📡</span>
          <span>Modo Offline - Dados podem estar desatualizados</span>
        </div>
      )}

      {/* Cabeçalho do Cartão */}
      <header className="emergency-card-header">
        <h1 className="emergency-title">🚨 CARTÃO DE EMERGÊNCIA</h1>
        <p className="emergency-subtitle">Informações médicas críticas</p>
      </header>

      {/* Tipo Sanguíneo - Destaque */}
      <section className="emergency-section blood-type-section">
        <h2 className="section-label">Tipo Sanguíneo</h2>
        <div className="blood-type-display">
          {BLOOD_TYPE_LABELS[cardData.blood_type] || 'Desconhecido'}
        </div>
      </section>

      {/* Alergias */}
      <section className="emergency-section allergies-section">
        <h2 className="section-label">⚠️ Alergias</h2>
        {cardData.allergies && cardData.allergies.length > 0 ? (
          <ul className="allergies-list">
            {cardData.allergies.map((allergy, index) => (
              <li key={index} className="allergy-item">
                {allergy}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-data">Nenhuma alergia registrada</p>
        )}
      </section>

      {/* Medicamentos em Uso */}
      <section className="emergency-section medications-section">
        <h2 className="section-label">💊 Medicamentos em Uso</h2>
        {activeMedications.length > 0 ? (
          <ul className="medications-list">
            {activeMedications.map((med, index) => (
              <li key={index} className="medication-item">
                <span className="med-name">{med.name}</span>
                {med.dosage && (
                  <span className="med-dosage">
                    {' '}
                    - {med.dosage} {med.unit}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-data">Nenhum medicamento ativo</p>
        )}
      </section>

      {/* Contatos de Emergência */}
      <section className="emergency-section contacts-section">
        <h2 className="section-label">📞 Contatos de Emergência</h2>
        {cardData.emergency_contacts && cardData.emergency_contacts.length > 0 ? (
          <div className="contacts-grid">
            {cardData.emergency_contacts.map((contact, index) => (
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

      {/* Observações */}
      {cardData.notes && (
        <section className="emergency-section notes-section">
          <h2 className="section-label">📝 Observações</h2>
          <p className="notes-content">{cardData.notes}</p>
        </section>
      )}

      {/* QR Code para Emergências */}
      <section className="emergency-section qr-section">
        <h2 className="section-label">📱 QR Code de Emergência</h2>
        <EmergencyQRCode
          cardData={cardData}
          medications={activeMedications}
          lastUpdated={cardData.last_updated}
        />
      </section>

      {/* Rodapé */}
      <footer className="emergency-card-footer">
        <p className="last-updated">
          Última atualização: {formattedLastUpdated}
        </p>
        <div className="footer-actions">
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
            🖨️ Imprimir
          </button>
          {onEdit && (
            <button className="btn btn-primary btn-sm" onClick={onEdit}>
              ✏️ Editar
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
