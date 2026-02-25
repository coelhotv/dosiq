import { useState, useMemo, useCallback } from 'react'
import Button from '@shared/components/ui/Button'
import Card from '@shared/components/ui/Card'
import {
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  validateEmergencyCard,
} from '@schemas/emergencyCardSchema'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import './EmergencyCard.css'

/**
 * Formulário para edição do Cartão de Emergência.
 *
 * Permite cadastrar contatos de emergência, alergias, tipo sanguíneo e observações.
 * Validação com Zod no submit. Suporta até 5 contatos de emergência.
 *
 * @param {Object} props - Propriedades do componente
 * @param {Object} [props.initialData] - Dados iniciais do cartão
 * @param {Function} props.onSave - Callback executado após salvar com sucesso
 * @param {Function} props.onCancel - Callback executado ao cancelar
 * @returns {JSX.Element} Formulário de edição do cartão de emergência
 */
export default function EmergencyCardForm({ initialData, onSave, onCancel }) {
  // ===== STATES (R-010: Hook Order) =====
  const [contacts, setContacts] = useState(
    initialData?.emergency_contacts || [{ name: '', phone: '', relationship: '' }]
  )
  const [allergies, setAllergies] = useState(initialData?.allergies || [])
  const [allergyInput, setAllergyInput] = useState('')
  const [bloodType, setBloodType] = useState(initialData?.blood_type || 'desconhecido')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)

  // ===== MEMOS (R-010: Hook Order) =====
  const canAddContact = useMemo(() => contacts.length < 5, [contacts.length])

  const formattedErrors = useMemo(() => {
    if (!errors || Object.keys(errors).length === 0) return null
    return errors
  }, [errors])

  // ===== HANDLERS (R-010: Hook Order) =====

  /**
   * Adiciona um novo contato vazio à lista.
   */
  const handleAddContact = useCallback(() => {
    if (canAddContact) {
      setContacts((prev) => [...prev, { name: '', phone: '', relationship: '' }])
    }
  }, [canAddContact])

  /**
   * Remove um contato da lista pelo índice.
   * @param {number} index - Índice do contato a ser removido
   */
  const handleRemoveContact = useCallback((index) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  /**
   * Atualiza um campo específico de um contato.
   * @param {number} index - Índice do contato
   * @param {string} field - Campo a ser atualizado (name, phone, relationship)
   * @param {string} value - Novo valor
   */
  const handleContactChange = useCallback((index, field, value) => {
    setContacts((prev) =>
      prev.map((contact, i) => (i === index ? { ...contact, [field]: value } : contact))
    )
    // Limpa erro do campo específico
    if (errors[`emergency_contacts.${index}.${field}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[`emergency_contacts.${index}.${field}`]
        return newErrors
      })
    }
  }, [errors])

  /**
   * Adiciona uma alergia à lista.
   */
  const handleAddAllergy = useCallback(() => {
    const trimmedAllergy = allergyInput.trim()
    if (trimmedAllergy && !allergies.includes(trimmedAllergy) && allergies.length < 20) {
      setAllergies((prev) => [...prev, trimmedAllergy])
      setAllergyInput('')
    }
  }, [allergyInput, allergies])

  /**
   * Remove uma alergia da lista.
   * @param {string} allergy - Alergia a ser removida
   */
  const handleRemoveAllergy = useCallback((allergy) => {
    setAllergies((prev) => prev.filter((a) => a !== allergy))
  }, [])

  /**
   * Manipula o envio do formulário.
   * @param {Event} e - Evento de submit
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    setSubmitMessage(null)

    // Preparar dados para validação
    const dataToValidate = {
      emergency_contacts: contacts.filter((c) => c.name.trim() || c.phone.trim()),
      allergies,
      blood_type: bloodType,
      notes: notes.trim() || null,
    }

    // Validar com Zod
    const validation = validateEmergencyCard(dataToValidate)

    if (!validation.success) {
      // Mapear erros para formato de formulário
      const formErrors = {}
      validation.errors.forEach((err) => {
        formErrors[err.field] = err.message
      })
      setErrors(formErrors)
      setIsSubmitting(false)
      return
    }

    // Salvar via serviço
    const result = await emergencyCardService.save(validation.data)

    if (result.success) {
      setSubmitMessage({
        type: 'success',
        text: result.warning || 'Cartão de emergência salvo com sucesso!',
      })
      if (onSave) {
        onSave(result.data)
      }
    } else {
      setSubmitMessage({
        type: 'error',
        text: 'Erro ao salvar cartão. Tente novamente.',
      })
      if (result.errors) {
        const formErrors = {}
        result.errors.forEach((err) => {
          formErrors[err.field] = err.message
        })
        setErrors(formErrors)
      }
    }

    setIsSubmitting(false)
  }

  /**
   * Manipula a tecla Enter no campo de alergia.
   * @param {KeyboardEvent} e - Evento de teclado
   */
  const handleAllergyKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddAllergy()
    }
  }

  return (
    <form className="emergency-card-form" onSubmit={handleSubmit}>
      {/* Contatos de Emergência */}
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
                  onClick={() => handleRemoveContact(index)}
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
                onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                placeholder="Nome completo"
                maxLength={200}
                className={errors[`emergency_contacts.${index}.name`] ? 'input-error' : ''}
              />
              {errors[`emergency_contacts.${index}.name`] && (
                <span className="error-message">
                  {errors[`emergency_contacts.${index}.name`]}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`contact-phone-${index}`}>Telefone</label>
              <input
                id={`contact-phone-${index}`}
                type="tel"
                value={contact.phone}
                onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                placeholder="(XX) XXXXX-XXXX"
                maxLength={20}
                className={errors[`emergency_contacts.${index}.phone`] ? 'input-error' : ''}
              />
              {errors[`emergency_contacts.${index}.phone`] && (
                <span className="error-message">
                  {errors[`emergency_contacts.${index}.phone`]}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`contact-relationship-${index}`}>Parentesco</label>
              <input
                id={`contact-relationship-${index}`}
                type="text"
                value={contact.relationship}
                onChange={(e) => handleContactChange(index, 'relationship', e.target.value)}
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
          <Button type="button" variant="secondary" size="sm" onClick={handleAddContact}>
            + Adicionar Contato
          </Button>
        )}

        {errors['emergency_contacts'] && (
          <span className="error-message">{errors['emergency_contacts']}</span>
        )}
      </Card>

      {/* Alergias */}
      <Card className="emergency-card-section" hover={false}>
        <h3 className="section-title">⚠️ Alergias</h3>
        <p className="section-description">
          Liste suas alergias conhecidas (até 20). Isso é crucial para tratamento de emergência.
        </p>

        <div className="allergy-input-container">
          <input
            type="text"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={handleAllergyKeyDown}
            placeholder="Digite uma alergia"
            maxLength={200}
            className="allergy-input"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddAllergy}
            disabled={!allergyInput.trim() || allergies.length >= 20}
          >
            Adicionar
          </Button>
        </div>

        {allergies.length > 0 && (
          <div className="allergy-tags">
            {allergies.map((allergy, index) => (
              <span key={index} className="allergy-tag">
                {allergy}
                <button
                  type="button"
                  className="allergy-tag-remove"
                  onClick={() => handleRemoveAllergy(allergy)}
                  aria-label={`Remover alergia ${allergy}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {allergies.length === 0 && (
          <p className="empty-state">Nenhuma alergia cadastrada</p>
        )}
      </Card>

      {/* Tipo Sanguíneo */}
      <Card className="emergency-card-section" hover={false}>
        <h3 className="section-title">🩸 Tipo Sanguíneo</h3>
        <p className="section-description">
          Selecione seu tipo sanguíneo. Isso pode ser vital em uma emergência.
        </p>

        <div className="form-group">
          <label htmlFor="blood-type">Tipo Sanguíneo</label>
          <select
            id="blood-type"
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            className="blood-type-select"
          >
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {BLOOD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Observações */}
      <Card className="emergency-card-section" hover={false}>
        <h3 className="section-title">📝 Observações</h3>
        <p className="section-description">
          Informações adicionais importantes (condições médicas, medicamentos em uso contínuo, etc.).
        </p>

        <div className="form-group">
          <label htmlFor="notes">Observações</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Portador de marcapasso, usa anticoagulante..."
            maxLength={1000}
            rows={4}
            className="notes-textarea"
          />
          <span className="char-count">{notes.length}/1000</span>
        </div>
      </Card>

      {/* Mensagem de Status */}
      {submitMessage && (
        <div className={`submit-message submit-message-${submitMessage.type}`}>
          {submitMessage.text}
        </div>
      )}

      {/* Erros Gerais */}
      {formattedErrors && Object.keys(formattedErrors).length > 0 && !submitMessage && (
        <div className="submit-message submit-message-error">
          Verifique os campos destacados no formulário.
        </div>
      )}

      {/* Botões de Ação */}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar Cartão'}
        </Button>
      </div>
    </form>
  )
}
