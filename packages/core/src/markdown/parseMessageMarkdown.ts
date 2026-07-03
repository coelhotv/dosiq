// parseMessageMarkdown.js — Tokenizer PURO de markdown leve do chatbot (spec 015 onda 2).
//
// Fonte ÚNICA da lógica de parse compartilhada web↔mobile (antes só no web #681,
// `ChatMessageList.jsx`). Cada superfície tem seu render adapter (web→JSX HTML,
// mobile→RN Text) consumindo esta estrutura — paridade de formatação por construção.
//
// Suporta: **negrito**, _itálico_, listas `-`/`*` (item nível 0) e `+` (sub-item),
// quebras de linha. (O Groq emite `*` p/ categorias e `+` p/ itens aninhados.)

/**
 * @typedef {{ type: 'text'|'bold'|'italic', value: string }} InlineSegment
 * @typedef {{ bullet: 'none'|'item'|'subitem', segments: InlineSegment[] }} MarkdownLine
 */

/**
 * Quebra uma linha em segmentos inline (**bold** / _italic_ / texto cru).
 * @param {string} text
 * @returns {InlineSegment[]}
 */
export function parseInlineSegments(text) {
  const parts = (text ?? '').split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
  return parts
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { type: 'bold', value: part.slice(2, -2) }
      }
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        return { type: 'italic', value: part.slice(1, -1) }
      }
      return { type: 'text', value: part }
    })
}

/**
 * Parseia uma mensagem em linhas estruturadas (bullet + segmentos inline).
 * Markdown malformado degrada para texto cru (nunca lança).
 * @param {string} content
 * @returns {MarkdownLine[]}
 */
export function parseMessageMarkdown(content) {
  return (content ?? '').split('\n').map((line) => {
    const bullet = line.match(/^(\s*)([-*+])\s+(.*)$/)
    if (bullet) {
      return {
        bullet: bullet[2] === '+' ? 'subitem' : 'item',
        segments: parseInlineSegments(bullet[3]),
      }
    }
    return { bullet: 'none', segments: parseInlineSegments(line) }
  })
}
