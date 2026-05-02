import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import {
  sendChatMessage,
  loadPersistedHistory,
  savePersistedHistory,
  clearPersistedHistory,
} from '@/features/chatbot/services/chatbotService'
import { createWelcomeMessage } from '@/features/chatbot/config/chatbotConfig'
import {
  getNow,
  getTodayLocal,
  getYesterdayLocal,
  formatLocalDate,
} from '@utils/dateUtils.js'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
import styles from './ChatWindow.module.css'

// Funções auxiliares puras (fora do componente para melhor performance e organização)

/**
 * Renderiza conteúdo com suporte básico a markdown inline:
 * _texto_ → <em>texto</em> (itálico para disclaimers e ênfase)
 * Quebras de linha \n → <br>
 */
function renderMessageContent(content) {
  return content.split('\n').map((line, lineIdx) => {
    const parts = line.split(/(_[^_]+_)/g)
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {parts.map((part, i) => {
          if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
            return <em key={i}>{part.slice(1, -1)}</em>
          }
          return <span key={i}>{part}</span>
        })}
      </span>
    )
  })
}

/**
 * Formata timestamp para exibição relativa (e.g., "às 14:30", "Ontem às 09:15").
 */
const formatMessageTime = (timestamp) => {
  const date = new Date(timestamp)
  const dateStr = formatLocalDate(date)
  const today = getTodayLocal()
  const yesterday = getYesterdayLocal()

  const isToday = dateStr === today
  const isYesterday = dateStr === yesterday

  const timeStr = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  if (isToday) return `às ${timeStr}`
  if (isYesterday) return `Ontem às ${timeStr}`
  return `${date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })} às ${timeStr}`
}

/**
 * Verifica se deve exibir separador de data antes da mensagem atual.
 */
const shouldShowDateSeparator = (msgs, idx) => {
  if (idx === 0) return false
  const prev = formatLocalDate(new Date(msgs[idx - 1].timestamp))
  const curr = formatLocalDate(new Date(msgs[idx].timestamp))
  return prev !== curr
}

/**
 * Formata label do separador de data (e.g., "Hoje", "Ontem", "15/03").
 */
const formatDaySeparator = (timestamp) => {
  const date = new Date(timestamp)
  const dateStr = formatLocalDate(date)
  const today = getTodayLocal()
  const yesterday = getYesterdayLocal()

  if (dateStr === today) return 'Hoje'
  if (dateStr === yesterday) return 'Ontem'

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Drawer lateral de chat com o assistente IA.
 * Lazy-loaded — nao impacta main bundle.
 * Acessa dados do DashboardContext diretamente para montar contexto do paciente.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 */
export default function ChatWindow({ isOpen, onClose }) {
  const { medicines, protocols, logs, stockSummary, stats } = useDashboard()

  const [messages, setMessages] = useState(() => {
    const persisted = loadPersistedHistory()
    if (persisted.length > 0) return persisted
    return [createWelcomeMessage(getNow().getTime())]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Adiciona mensagem ao estado e persiste histórico
  const addMessage = useCallback((message) => {
    setMessages((prev) => {
      const next = [...prev, message]
      savePersistedHistory(next)
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userMessage, timestamp: getNow().getTime() })
    setIsLoading(true)

    try {
      const result = await sendChatMessage({
        message: userMessage,
        history: messages,
        patientData: { medicines, protocols, logs, stockSummary, stats },
      })

      addMessage({
        role: 'assistant',
        content: result.response || result.reason || '',
        timestamp: getNow().getTime(),
      })
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, addMessage, medicines, protocols, logs, stockSummary, stats])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickSuggestions = [
    'Tomei meu remédio hoje?',
    'Como está minha adesão?',
    'Quando preciso repor estoque?',
  ]

  const handleClearHistory = () => {
    setShowClearConfirm(true)
  }

  const handleConfirmClear = () => {
    clearPersistedHistory()
    setMessages([createWelcomeMessage(getNow().getTime())])
    setShowClearConfirm(false)
  }

  const handleCancelClear = () => {
    setShowClearConfirm(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.overlay}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={styles.drawer}
          >
            {/* Header */}
            <div className={styles.header}>
              <span className={styles.headerTitle}>Assistente IA</span>
              <div className={styles.headerActions}>
                <button
                  onClick={handleClearHistory}
                  className={styles.clearButton}
                  title="Limpar histórico"
                  aria-label="Limpar histórico de conversa"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
                <button onClick={onClose} className={styles.closeButton} aria-label="Fechar chat">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {messages.map((msg, i) => (
                <div key={i}>
                  {shouldShowDateSeparator(messages, i) && (
                    <div className={styles.dateSeparator}>{formatDaySeparator(msg.timestamp)}</div>
                  )}
                  <div
                    className={`${styles.messageBubble} ${
                      msg.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant
                    }`}
                  >
                    {renderMessageContent(msg.content)}
                    {msg.timestamp && (
                      <span className={styles.messageTime}>{formatMessageTime(msg.timestamp)}</span>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && <div className={styles.thinkingBubble}>Pensando...</div>}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions (quando poucas mensagens) */}
            {messages.length <= 2 && (
              <div className={styles.suggestions}>
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className={styles.suggestionButton}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className={styles.inputRow}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                disabled={isLoading}
                className={styles.textInput}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={styles.sendButton}
              >
                Enviar
              </button>
            </div>
          </motion.div>
        </>
      )}

      {/* Modal de confirmação — limpar histórico */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Limpar histórico"
        message="Tem certeza que deseja limpar todo o histórico de conversa? Esta ação não pode ser desfeita."
        confirmLabel="Limpar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
        variant="danger"
      />
    </AnimatePresence>
  )
}
