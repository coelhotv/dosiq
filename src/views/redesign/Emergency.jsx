/**
 * src/views/redesign/EmergencyRedesign.jsx
 * Wave 17 — Emergency View Redesign
 *
 * View consolidada para visualização e edição do Cartão de Emergência.
 * Usa componentes redesenhados (EmergencyCardView, EmergencyCardForm).
 * Sem dependências de legacy (Emergency.jsx deletado).
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import EmergencyCardView from '@features/emergency/components/EmergencyCardView'
import EmergencyCardForm from '@features/emergency/components/EmergencyCardForm'
import Loading from '@shared/components/ui/Loading'
import './emergency/EmergencyRedesign.css'

/**
 * EmergencyRedesign — View integrada de Cartão de Emergência
 *
 * Estados:
 * - view: 'display' (visualizar), 'edit' (editar)
 * - cardData: dados carregados do serviço
 * - isLoading: carregamento inicial
 * - error: mensagem de erro
 *
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback para navegação (ex: back)
 */
export default function EmergencyRedesign({ onNavigate }) {
  // ═══ States ═══
  const [view, setView] = useState('display') // 'display' | 'edit'
  const [cardData, setCardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  // ═══ Handlers ═══
  const loadCardData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await emergencyCardService.load()
      if (result.success) {
        setCardData(result.data)
        // Restaura comportamento legado: entra em edição se o cartão estiver vazio
        if (!result.data) {
          setView('edit')
        }
      }
    } catch (err) {
      setError('Erro ao carregar cartão: ' + err.message)
      console.error('[EmergencyRedesign] Load error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSave = useCallback(async (updatedData) => {
    try {
      setError(null)
      const result = await emergencyCardService.save(updatedData)
      if (result.success) {
        setCardData(updatedData)
        setView('display')
        setMessage('Cartão atualizado com sucesso!')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setError('Erro ao salvar: ' + (result.error || 'Erro desconhecido'))
      }
    } catch (err) {
      setError('Erro ao salvar: ' + err.message)
      console.error('[EmergencyRedesign] Save error:', err)
    }
  }, [])

  const handleEdit = useCallback(() => {
    setView('edit')
    setError(null)
  }, [])

  const handleCancel = useCallback(() => {
    setView('display')
    setError(null)
  }, [])

  // ═══ Effects ═══
  useEffect(() => {
    loadCardData()
  }, [loadCardData])

  // ═══ Render ═══
  if (isLoading) {
    return <Loading />
  }

  return (
    <div className="er-view">
      {/* Header com back button */}
      <div className="er-header">
        <button
          className="er-header__back"
          onClick={() => onNavigate?.('profile')}
          aria-label="Voltar para Perfil"
          type="button"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>
        <h1 className="er-header__title">Cartão de Emergência</h1>
      </div>

      {/* Feedback messages */}
      {message && <div className="er-message er-message--success">{message}</div>}
      {error && <div className="er-message er-message--error">{error}</div>}

      {/* Content */}
      <div className="er-content">
        {view === 'display' ? (
          <div className="er-display">
            <EmergencyCardView data={cardData} onEdit={handleEdit} />
          </div>
        ) : (
          <div className="er-edit">
            <EmergencyCardForm
              initialData={cardData}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        )}
      </div>
    </div>
  )
}
