import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  parseTimestamp,
} from '@utils/dateUtils.js'
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

const QUICK_SUGGESTIONS = ['Tomei meu remédio hoje?', 'Como está minha adesão?', 'Quando preciso repor estoque?']

/**
 * Drawer lateral de chat com o assistente IA.
 * Lazy-loaded — nao impacta main bundle.
 */
export default function ChatWindow({ isOpen, onClose }) {
  const { medicines, protocols, logs, stockSummary, stats } = useDashboard()

  const [messages, setMessages] = useState(() => {
    const persisted = loadPersistedHistory()
    return persisted.length > 0 ? persisted : [createWelcomeMessage(getNow().getTime())]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

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
      const result = await sendChatMessage({ message: userMessage, history: messages, patientData: { medicines, protocols, logs, stockSummary, stats } })
      addMessage({ role: 'assistant', content: result.response || result.reason || '', timestamp: getNow().getTime() })
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, addMessage, medicines, protocols, logs, stockSummary, stats])

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.overlay} onClick={onClose} />
          <ChatWindowDrawer
            messages={messages}
            isLoading={isLoading}
            input={input}
            setInput={setInput}
            messagesEndRef={messagesEndRef}
            quickSuggestions={QUICK_SUGGESTIONS}
            shouldShowDateSeparator={shouldShowDateSeparator}
            formatDaySeparator={formatDaySeparator}
            formatMessageTime={formatMessageTime}
            onClose={onClose}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            onClearHistory={() => setShowClearConfirm(true)}
            styles={styles}
          />
        </>
      )}
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
    </AnimatePresence>
  )
}
