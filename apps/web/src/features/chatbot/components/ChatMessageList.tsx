/**
 * ChatMessageList — Renderiza a lista de mensagens do chat.
 *
 * Parse de markdown via `@dosiq/core` (parser puro único web↔mobile, spec 015 onda 2);
 * aqui só o render adapter web (tokens → JSX HTML).
 */
import { useState, useEffect, Fragment } from 'react'
import { parseMessageMarkdown } from '@dosiq/core'

/** "Digitando" com pontos pulsando (1→2→3→repete) — paridade com o mobile. */
function TypingDots({ styles }) {
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setDots((n) => (n >= 3 ? 1 : n + 1)), 400)
    return () => clearInterval(id)
  }, [])
  return <div className={styles.thinkingBubble}>{'.'.repeat(dots)}</div>
}

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
        <Fragment key={`${msg.timestamp}-${msg.role}-${i}`}>
          {shouldShowDateSeparator(messages, i) && (
            <div className={styles.dateSeparator}>{formatDaySeparator(msg.timestamp)}</div>
          )}
          {/* Wrapper alinha a bolha L/R (user→direita, bot→esquerda); a cor fica na bolha. */}
          <div
            className={`${styles.messageRow} ${
              msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant
            }`}
          >
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
        </Fragment>
      ))}

      {isLoading && <TypingDots styles={styles} />}

      <div ref={messagesEndRef} />
    </div>
  )
}
