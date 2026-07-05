import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  sendChatMessage,
  loadPersistedHistory,
  savePersistedHistory,
  clearPersistedHistory,
} from '@/features/chatbot/services/chatbotService'
import { createWelcomeMessage, CHATBOT_QUICK_SUGGESTIONS } from '@/features/chatbot/config/chatbotConfig'
import {
  getNow,
  getTodayLocal,
  getYesterdayLocal,
  formatLocalDate,
  parseTimestamp,
} from '@utils/dateUtils'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import ChatWindowDrawer from './ChatWindowDrawer'
import styles from './ChatWindow.module.css'

const formatMessageTime = (timestamp) => {
  const date = parseTimestamp(timestamp)
  const dateStr = formatLocalDate(date)
  const today = getTodayLocal()
  const yesterday = getYesterdayLocal()
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  if (dateStr === today) return `às ${timeStr}`
  if (dateStr === yesterday) return `Ontem às ${timeStr}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} às ${timeStr}`
}

const shouldShowDateSeparator = (msgs, idx) => {
  if (idx === 0) return false
  return formatLocalDate(parseTimestamp(msgs[idx - 1].timestamp)) !== formatLocalDate(parseTimestamp(msgs[idx].timestamp))
}

const formatDaySeparator = (timestamp) => {
  const date = parseTimestamp(timestamp)
  const dateStr = formatLocalDate(date)
  const today = getTodayLocal()
  const yesterday = getYesterdayLocal()
  if (dateStr === today) return 'Hoje'
  if (dateStr === yesterday) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })
}

/**
 * Drawer lateral de chat com o assistente IA.
 * Lazy-loaded — nao impacta main bundle.
 */
export default function ChatWindow({ isOpen, onClose }) {
  const { medicines, protocols, logs, stockSummary, stats, doseInstances } = useDashboard()

  const [messages, setMessages] = useState(() => {
    const persisted = loadPersistedHistory()
    return persisted.length > 0 ? persisted : [createWelcomeMessage(getNow().getTime())]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Refoca o input ao fim do envio: `disabled={isLoading}` faz o browser soltar o foco;
  // sem isto o usuário precisa reclicar no campo a cada pergunta.
  useEffect(() => { if (!isLoading && isOpen) inputRef.current?.focus() }, [isLoading, isOpen])

  const addMessage = useCallback((message) => {
    setMessages((prev) => {
      const next = [...prev, message]
      savePersistedHistory(next)
      return next
    })
  }, [])

  const handleSend = useCallback(async (overrideMessage?: string | React.MouseEvent) => {
    // overrideMessage: pills de sugestão disparam direto (sem passar pelo input/state async).
    const raw = typeof overrideMessage === 'string' ? overrideMessage : input
    if (!raw.trim() || isLoading) return
    const userMessage = raw.trim()
    setInput('')
    addMessage({ role: 'user', content: userMessage, timestamp: getNow().getTime() })
    setIsLoading(true)
    try {
      // CON-028: o builder lê `stats.adherence` (0-1). O Dashboard expõe a adesão em
      // `stats.rates.adherence` (e `stats.adherenceRate`), NÃO em `stats.adherence` —
      // sem normalizar, a linha de adesão sumia do payload (LLM "não tenho info").
      // Preserva demais métricas (...stats) e adiciona `adherence` no shape do contrato —
      // defensivo caso o builder passe a usar outros campos (streak, etc.).
      const normalizedStats = { ...stats, adherence: stats?.rates?.adherence ?? stats?.adherenceRate ?? stats?.adherence ?? null }
      const result = await sendChatMessage({ message: userMessage, history: messages, patientData: { medicines, protocols, logs, stockSummary, stats: normalizedStats, doseInstances } })
      // isError: exibe na tela mas NÃO persiste (savePersistedHistory filtra) — paridade mobile #686
      addMessage({ role: 'assistant', content: result.response || result.reason || '', timestamp: getNow().getTime(), isError: result.error === true })
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, addMessage, medicines, protocols, logs, stockSummary, stats, doseInstances])

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <>
      {/* Filhos diretos do AnimatePresence DEVEM ser componentes keyed separados (não um
          Fragment): o Fragment quebra a animação de exit (o AnimatePresence precisa rastrear
          cada motion/component por key p/ adiar a desmontagem). Keys distintas também evitam
          o warning de chave duplicada. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.overlay}
            onClick={onClose}
          />
        )}
        {isOpen && (
          <ChatWindowDrawer
            key="chat-drawer"
            messages={messages}
            isLoading={isLoading}
            input={input}
            setInput={setInput}
            messagesEndRef={messagesEndRef}
            inputRef={inputRef}
            quickSuggestions={CHATBOT_QUICK_SUGGESTIONS}
            shouldShowDateSeparator={shouldShowDateSeparator}
            formatDaySeparator={formatDaySeparator}
            formatMessageTime={formatMessageTime}
            onClose={onClose}
            onSend={handleSend}
            onSelectSuggestion={(suggestion) => handleSend(suggestion)}
            onKeyDown={handleKeyDown}
            onClearHistory={() => setShowClearConfirm(true)}
            styles={styles}
          />
        )}
      </AnimatePresence>
      {/* ConfirmDialog fica fora do AnimatePresence (não é filho animado por ele). */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Limpar histórico"
        message="Tem certeza que deseja limpar todo o histórico de conversa? Esta ação não pode ser desfeita."
        confirmLabel="Limpar"
        cancelLabel="Cancelar"
        onConfirm={() => { clearPersistedHistory(); setMessages([createWelcomeMessage(getNow().getTime())]); setShowClearConfirm(false) }}
        onCancel={() => setShowClearConfirm(false)}
        variant="danger"
      />
    </>
  )
}
