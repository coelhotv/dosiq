// ChatBubble.jsx — bolha de mensagem do chat (spec 015 onda 2).
//
// Assimétrica: user à direita (accent/brand), bot à esquerda (surface neutro).
// Render de markdown leve via parser PURO do @dosiq/core (paridade web↔mobile):
// **negrito**, _itálico_, listas `-`/`*` (•) e `+` (◦ indentado).

import { View, Text, StyleSheet } from 'react-native'
import { parseMessageMarkdown } from '@dosiq/core'
import { colors, spacing } from '@shared/styles/tokens'

/** Render dos segmentos inline (bold/italic/text) → RN Text aninhado. */
function renderSegments(segments, baseStyle) {
  return segments.map((seg, i) => {
    if (seg.type === 'bold') return <Text key={i} style={styles.bold}>{seg.value}</Text>
    if (seg.type === 'italic') return <Text key={i} style={styles.italic}>{seg.value}</Text>
    return <Text key={i} style={baseStyle}>{seg.value}</Text>
  })
}

export default function ChatBubble({ role, content }) {
  const isUser = role === 'user'
  const baseTextStyle = isUser ? styles.userText : styles.botText
  const lines = parseMessageMarkdown(content)

  return (
    <View
      style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}
      accessibilityLabel={isUser ? 'Sua mensagem' : 'Resposta do assistente'}
    >
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        {lines.map((line, i) => (
          <Text key={i} style={[baseTextStyle, line.bullet === 'subitem' && styles.subIndent]}>
            {line.bullet === 'item' ? '• ' : line.bullet === 'subitem' ? '◦ ' : ''}
            {renderSegments(line.segments, baseTextStyle)}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: spacing[1],
    paddingHorizontal: spacing[4],
  },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderBottomLeftRadius: 4,
  },
  userText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.inverse,
  },
  botText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.primary,
  },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  subIndent: { paddingLeft: spacing[4] },
})
