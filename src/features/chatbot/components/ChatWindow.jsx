import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendChatMessage } from '../services/chatbotService'
import { DISCLAIMER } from '../services/safetyGuard'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'

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
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1100,
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '100%',
              maxWidth: '400px',
              height: '100%',
              background: 'var(--color-background, #0f0f0f)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1101,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
                Assistente
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
                aria-label="Fechar chat"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background:
                      msg.role === 'user'
                        ? 'var(--color-primary, #3b82f6)'
                        : 'var(--color-surface, #1e1e1e)',
                    color: 'var(--color-text, #fff)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              ))}

              {isLoading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--color-surface)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Pensando...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions (quando poucas mensagens) */}
            {messages.length <= 2 && (
              <div
                style={{
                  padding: '0 16px 8px',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                style={{
                  padding: '10px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  opacity: isLoading || !input.trim() ? 0.5 : 1,
                }}
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
