/**
 * ChatWindowDrawer — Conteúdo visual do drawer de chat IA.
 */
import { motion } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import ChatMessageList from './ChatMessageList'

export default function ChatWindowDrawer({
  messages,
  isLoading,
  input,
  setInput,
  messagesEndRef,
  quickSuggestions,
  shouldShowDateSeparator,
  formatDaySeparator,
  formatMessageTime,
  onClose,
  onSend,
  onKeyDown,
  onClearHistory,
  styles,
}) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={styles.drawer}
    >
      <div className={styles.header}>
        <span className={styles.headerTitle}>Assistente IA</span>
        <div className={styles.headerActions}>
          <button onClick={onClearHistory} className={styles.clearButton} title="Limpar histórico" aria-label="Limpar histórico de conversa">
            <Trash2 size={16} aria-hidden="true" />
          </button>
          <button onClick={onClose} className={styles.closeButton} aria-label="Fechar chat">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
        shouldShowDateSeparator={shouldShowDateSeparator}
        formatDaySeparator={formatDaySeparator}
        formatMessageTime={formatMessageTime}
        styles={styles}
      />

      {messages.length <= 2 && (
        <div className={styles.suggestions}>
          {quickSuggestions.map((suggestion, i) => (
            <button key={i} onClick={() => setInput(suggestion)} className={styles.suggestionButton}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Digite sua pergunta..."
          disabled={isLoading}
          className={styles.textInput}
        />
        <button onClick={onSend} disabled={isLoading || !input.trim()} className={styles.sendButton}>
          Enviar
        </button>
      </div>
    </motion.div>
  )
}
