/**
 * EmergencyCard — Resumo do cartão de emergência com QR miniatura.
 */
import { Phone } from 'lucide-react'

export default function EmergencyCard({ emergencyCard, qrMiniatureUrl, onNavigate }) {
  if (!emergencyCard) {
    return (
      <div className="ph-emergency-card">
        <div className="ph-emergency-card__header">
          <span className="ph-emergency-card__label">IDENTIFICAÇÃO CRÍTICA</span>
          <h3>Cartão de Emergência</h3>
        </div>
        <div className="ph-emergency-card__empty">
          <p>Você ainda não configurou seu cartão de emergência.</p>
          <button className="ph-emergency-card__cta" onClick={() => onNavigate('emergency')} type="button">Configurar Agora</button>
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
        {(emergencyCard.allergies?.length > 0 || emergencyCard.conditions?.length > 0) && (
          <div className="ph-emergency-card__data">
            {emergencyCard.allergies?.length > 0 && (
              <div className="ph-emergency-card__field">
                <span className="ph-emergency-card__field-label">ALERGIAS</span>
                <div className="ph-emergency-card__tags">
                  {emergencyCard.allergies.map((a, i) => <span key={i} className="ph-emergency-card__tag ph-emergency-card__tag--danger">{a}</span>)}
                </div>
              </div>
            )}
            {emergencyCard.conditions?.length > 0 && (
              <div className="ph-emergency-card__field">
                <span className="ph-emergency-card__field-label">CONDIÇÕES</span>
                <div className="ph-emergency-card__tags">
                  {emergencyCard.conditions.map((c, i) => <span key={i} className="ph-emergency-card__tag ph-emergency-card__tag--info">{c}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="ph-emergency-card__contact-section">
          {emergencyCard.emergency_contacts?.[0] && (
            <div className="ph-emergency-card__field">
              <span className="ph-emergency-card__field-label">CONTATO</span>
              <span className="ph-emergency-card__contact-name">{emergencyCard.emergency_contacts[0].name}</span>
              <a href={`tel:${emergencyCard.emergency_contacts[0].phone}`} className="ph-emergency-card__contact-phone">
                <Phone size={16} /> {emergencyCard.emergency_contacts[0].phone}
              </a>
            </div>
          )}
          {qrMiniatureUrl && <div className="ph-emergency-card__qr"><img src={qrMiniatureUrl} alt="QR" className="ph-emergency-card__qr-image" /></div>}
        </div>
      </div>
      <button className="ph-emergency-card__action" onClick={() => onNavigate('emergency')} type="button">Ver Cartão Completo →</button>
    </div>
  )
}
