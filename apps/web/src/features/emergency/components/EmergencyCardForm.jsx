import { useState, useMemo, useCallback } from 'react'
import { validateEmergencyCard } from '@schemas/emergencyCardSchema'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import EmergencyContactsSection from './EmergencyContactsSection'
import EmergencyAllergiesSection from './EmergencyAllergiesSection'
import EmergencyFormBottom from './EmergencyFormBottom'
import './EmergencyCard.css'

/**
 * Formulário para edição do Cartão de Emergência.
 * Suporta até 5 contatos de emergência e validação com Zod.
 */
export default function EmergencyCardForm({ initialData, onSave, onCancel }) {
  const [contacts, setContacts] = useState(initialData?.emergency_contacts || [{ name: '', phone: '', relationship: '' }])
  const [allergies, setAllergies] = useState(initialData?.allergies || [])
  const [allergyInput, setAllergyInput] = useState('')
  const [bloodType, setBloodType] = useState(initialData?.blood_type || 'desconhecido')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)

  const canAddContact = useMemo(() => contacts.length < 5, [contacts.length])
  const formattedErrors = useMemo(() => (errors && Object.keys(errors).length ? errors : null), [errors])

  const handleAddContact = useCallback(() => {
    if (canAddContact) setContacts((prev) => [...prev, { name: '', phone: '', relationship: '' }])
  }, [canAddContact])

  const handleRemoveContact = useCallback((index) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleContactChange = useCallback((index, field, value) => {
    setContacts((prev) => prev.map((contact, i) => (i === index ? { ...contact, [field]: value } : contact)))
    if (errors[`emergency_contacts.${index}.${field}`]) {
      setErrors((prev) => { const n = { ...prev }; delete n[`emergency_contacts.${index}.${field}`]; return n })
    }
  }, [errors])

  const handleAddAllergy = useCallback(() => {
    const trimmed = allergyInput.trim()
    if (trimmed && !allergies.includes(trimmed) && allergies.length < 20) {
      setAllergies((prev) => [...prev, trimmed])
      setAllergyInput('')
    }
  }, [allergyInput, allergies])

  const handleRemoveAllergy = useCallback((allergy) => {
    setAllergies((prev) => prev.filter((a) => a !== allergy))
  }, [])

  const handleAllergyKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAllergy() } }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    setSubmitMessage(null)

    const dataToValidate = {
      emergency_contacts: contacts.filter((c) => c.name.trim() || c.phone.trim()),
      allergies,
      blood_type: bloodType,
      notes: notes.trim() || null,
    }

    const validation = validateEmergencyCard(dataToValidate)
    if (!validation.success) {
      const formErrors = {}
      validation.errors.forEach((err) => { formErrors[err.field] = err.message })
      setErrors(formErrors)
      setIsSubmitting(false)
      return
    }

    const result = await emergencyCardService.save(validation.data)
    if (result.success) {
      setSubmitMessage({ type: 'success', text: result.warning || 'Cartão de emergência salvo com sucesso!' })
      if (onSave) onSave(result.data)
    } else {
      setSubmitMessage({ type: 'error', text: 'Erro ao salvar cartão. Tente novamente.' })
      if (result.errors) {
        const formErrors = {}
        result.errors.forEach((err) => { formErrors[err.field] = err.message })
        setErrors(formErrors)
      }
    }
    setIsSubmitting(false)
  }

  return (
    <form className="emergency-card-form" onSubmit={handleSubmit}>
      <EmergencyContactsSection
        contacts={contacts}
        errors={errors}
        canAddContact={canAddContact}
        onAddContact={handleAddContact}
        onRemoveContact={handleRemoveContact}
        onContactChange={handleContactChange}
      />
      <EmergencyAllergiesSection
        allergies={allergies}
        allergyInput={allergyInput}
        onAllergyInputChange={(e) => setAllergyInput(e.target.value)}
        onAddAllergy={handleAddAllergy}
        onRemoveAllergy={handleRemoveAllergy}
        onKeyDown={handleAllergyKeyDown}
      />
      <EmergencyFormBottom
        bloodType={bloodType}
        setBloodType={setBloodType}
        notes={notes}
        setNotes={setNotes}
        submitMessage={submitMessage}
        formattedErrors={formattedErrors}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}
