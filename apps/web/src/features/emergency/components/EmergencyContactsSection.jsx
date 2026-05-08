/**
 * EmergencyContactsSection — Seção de contatos de emergência do EmergencyCardForm.
 */
import Button from '@shared/components/ui/Button'
import Card from '@shared/components/ui/Card'

export default function EmergencyContactsSection({
  contacts,
  errors,
  canAddContact,
  onAddContact,
  onRemoveContact,
  onContactChange,
}) {
  return (
    <Card className="emergency-card-section" hover={false}>
      <h3 className="section-title">📞 Contatos de Emergência</h3>
      <p className="section-description">
        Adicione até 5 contatos que possam ser acionados em uma emergência.
      </p>

      {contacts.map((contact, index) => (
        <div key={index} className="contact-item">
          <div className="contact-header">
            <span className="contact-number">Contato {index + 1}</span>
            {contacts.length > 1 && (
              <button
                type="button"
                className="btn-remove-contact"
                onClick={() => onRemoveContact(index)}
                aria-label={`Remover contato ${index + 1}`}
              >
                ✕
              </button>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`contact-name-${index}`}>Nome</label>
            <input
              id={`contact-name-${index}`}
              type="text"
              value={contact.name}
              onChange={(e) => onContactChange(index, 'name', e.target.value)}
              placeholder="Nome completo"
              maxLength={200}
              className={errors[`emergency_contacts.${index}.name`] ? 'input-error' : ''}
            />
            {errors[`emergency_contacts.${index}.name`] && (
              <span className="error-message">{errors[`emergency_contacts.${index}.name`]}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`contact-phone-${index}`}>Telefone</label>
            <input
              id={`contact-phone-${index}`}
              type="tel"
              value={contact.phone}
              onChange={(e) => onContactChange(index, 'phone', e.target.value)}
              placeholder="(XX) XXXXX-XXXX"
              maxLength={20}
              className={errors[`emergency_contacts.${index}.phone`] ? 'input-error' : ''}
            />
            {errors[`emergency_contacts.${index}.phone`] && (
              <span className="error-message">{errors[`emergency_contacts.${index}.phone`]}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`contact-relationship-${index}`}>Parentesco</label>
            <input
              id={`contact-relationship-${index}`}
              type="text"
              value={contact.relationship}
              onChange={(e) => onContactChange(index, 'relationship', e.target.value)}
              placeholder="Ex: Cônjuge, Filho(a), Irmão(ã)"
              maxLength={100}
              className={errors[`emergency_contacts.${index}.relationship`] ? 'input-error' : ''}
            />
            {errors[`emergency_contacts.${index}.relationship`] && (
              <span className="error-message">
                {errors[`emergency_contacts.${index}.relationship`]}
              </span>
            )}
          </div>
        </div>
      ))}

      {canAddContact && (
        <Button type="button" variant="secondary" size="sm" onClick={onAddContact}>
          + Adicionar Contato
        </Button>
      )}

      {errors['emergency_contacts'] && (
        <span className="error-message">{errors['emergency_contacts']}</span>
      )}
    </Card>
  )
}
