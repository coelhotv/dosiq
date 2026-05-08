/**
 * ChatMessageList — Renderiza a lista de mensagens do chat.
 */

/**
 * Renderiza conteúdo com suporte básico a markdown inline.
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
