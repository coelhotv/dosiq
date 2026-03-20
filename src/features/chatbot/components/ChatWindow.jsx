import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendChatMessage } from '../services/chatbotService'
import { DISCLAIMER } from '../services/safetyGuard'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import styles from './ChatWindow.module.css'

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

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Olá! Sou seu assistente de medicamentos. Como posso ajudar?\n\n_${DISCLAIMER}_`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const result = await sendChatMessage({
        message: userMessage,
        history: messages,
        patientData: { medicines, protocols, logs, stockSummary, stats },
      })

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: result.response || result.reason || '' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, medicines, protocols, logs, stockSummary, stats])

  const handleKeyDown = e => {
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
              <button
                onClick={onClose}
                className={styles.closeButton}
                aria-label="Fechar chat"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`${styles.messageBubble} ${
                    msg.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant
                  }`}
                >
                  {msg.content}
                </div>
              ))}

              {isLoading && (
                <div className={styles.thinkingBubble}>Pensando...</div>
              )}

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
                onChange={e => setInput(e.target.value)}
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
    </AnimatePresence>
  )
}
