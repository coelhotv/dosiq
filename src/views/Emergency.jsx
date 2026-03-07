import { useState, useEffect, useCallback } from 'react'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import EmergencyCardForm from '@features/emergency/components/EmergencyCardForm'
import EmergencyCardView from '@features/emergency/components/EmergencyCardView'
import Button from '@shared/components/ui/Button'
import './Emergency.css'

/**
 * View wrapper para o Cartão de Emergência.
 *
 * Gerencia a alternância entre visualização e edição do cartão.
 * Carrega dados do localStorage para funcionamento offline.
 *
 * @param {Object} props - Propriedades do componente
 * @param {Function} props.onNavigate - Callback para navegação entre views
 * @returns {JSX.Element} View do cartão de emergência
 */
export default function Emergency({ onNavigate }) {
  // ===== STATES (R-010: Hook Order) =====
  const [cardData, setCardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // ===== EFFECTS (R-010: Hook Order) =====
  useEffect(() => {
    let mounted = true

    async function fetchCardData() {
      setIsLoading(true)
      const result = await emergencyCardService.load()
      if (mounted) {
        if (result.success) {
          setCardData(result.data)
          // Se não há dados, entra em modo de edição automaticamente
          if (!result.data) {
            setIsEditing(true)
          }
        }
        setIsLoading(false)
      }
    }

    fetchCardData()

    return () => {
      mounted = false
    }
  }, [])

  // ===== HANDLERS (R-010: Hook Order) =====

  /**
   * Manipula o salvamento bem-sucedido do cartão.
   * @param {Object} data - Dados salvos do cartão
   */
  const handleSave = useCallback((data) => {
    setCardData(data)
    setIsEditing(false)
  }, [])

  /**
   * Manipula o cancelamento da edição.
   */
  const handleCancel = useCallback(() => {
    // Se não há dados, volta para Settings
    if (!cardData) {
      onNavigate?.('profile')
    } else {
      setIsEditing(false)
    }
  }, [cardData, onNavigate])

  /**
   * Entra em modo de edição.
   */
  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  /**
   * Volta para a tela de Settings.
   */
  const handleBack = useCallback(() => {
    onNavigate?.('profile')
  }, [onNavigate])

  // ===== RENDER =====

  if (isLoading) {
    return (
      <div className="emergency-view-container">
        <div className="emergency-loading">
          <div className="loading-spinner"></div>
          <p>Carregando cartão de emergência...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="emergency-view-container">
      {/* Cabeçalho */}
      <header className="emergency-header">
        <Button variant="ghost" size="sm" onClick={handleBack} className="btn-back">
          ← Voltar
        </Button>
        <h2 className="page-title">Cartão de Emergência</h2>
      </header>

      {/* Conteúdo */}
      <div className="emergency-content">
        {isEditing ? (
          <EmergencyCardForm initialData={cardData} onSave={handleSave} onCancel={handleCancel} />
        ) : (
          <EmergencyCardView data={cardData} onEdit={handleEdit} />
        )}
      </div>
    </div>
  )
}
