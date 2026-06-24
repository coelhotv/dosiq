/**
 * ChatMessageList — Renderiza a lista de mensagens do chat.
 *
 * Parse de markdown via `@dosiq/core` (parser puro único web↔mobile, spec 015 onda 2);
 * aqui só o render adapter web (tokens → JSX HTML).
 */
import { parseMessageMarkdown } from '@dosiq/core'

/** Render web dos segmentos inline (bold/italic/text) de uma linha. */
function renderSegments(segments) {
  return segments.map((seg, i) => {
    if (seg.type === 'bold') return <strong key={i}>{seg.value}</strong>
    if (seg.type === 'italic') return <em key={i}>{seg.value}</em>
    return <span key={i}>{seg.value}</span>
  })
}

/**
 * Render do conteúdo com markdown leve (**negrito**, _itálico_, listas `-`/`*`/`+`, quebras).
 * Markers: `-`/`*` = nível 0 (`•`); `+` = sub-item (`◦` indentado). Parse no core.
 */
function renderMessageContent(content) {
  return parseMessageMarkdown(content).map((line, lineIdx) => (
    <span key={lineIdx}>
      {lineIdx > 0 && <br />}
      {line.bullet !== 'none' ? (
        <span style={{ paddingLeft: line.bullet === 'subitem' ? '1.25em' : 0 }}>
          {line.bullet === 'subitem' ? '◦ ' : '• '}
          {renderSegments(line.segments)}
        </span>
      ) : (
        renderSegments(line.segments)
      )}
    </span>
  ))
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
