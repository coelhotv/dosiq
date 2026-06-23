/**
 * ChatMessageList — Renderiza a lista de mensagens do chat.
 */

/**
 * Renderiza spans inline de uma linha: **bold** e _italic_.
 */
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}

/**
 * Renderiza conteúdo com suporte básico a markdown inline:
 * **negrito**, _itálico_, listas com `-`/`*` e quebras de linha.
 */
function renderMessageContent(content) {
  return content.split('\n').map((line, lineIdx) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {bullet ? <span>{'• '}{renderInline(bullet[1])}</span> : renderInline(line)}
      </span>
    )
  })
}

export default function ChatMessageList({ messages, isLoading, messagesEndRef, shouldShowDateSeparator, formatDaySeparator, formatMessageTime, styles }) {
  return (
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
  )
}
