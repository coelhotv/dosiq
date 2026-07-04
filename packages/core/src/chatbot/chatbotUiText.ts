// chatbotUiText.js — textos de UI do chat, fonte ÚNICA web↔mobile (spec 015 Onda 3, FR-013).
//
// APENAS apresentação (welcome, disclaimer, chips). PURO, sem dependências de plataforma.
// Texto canônico = mobile (Onda 2). Web e mobile consomem daqui (elimina a duplicação que
// existia entre apps/web/.../chatbotConfig.js e apps/mobile/.../chatbotConfig.js).
//
// SEGURANÇA (AP-237/FR-008): systemPrompt, safetyGuard e CHATBOT_BLOCKED_PATTERNS NÃO vivem
// aqui — permanecem server-side (compostos em api/chatbot.js). Aqui é só texto de UI.
//
// NÃO centralizar CHATBOT_MAX_HISTORY nem CHATBOT_HISTORY_STORAGE_KEY: as semânticas divergem
// por superfície (web=10 turnos enviados ao LLM, dep de api/Telegram; mobile=20 teto de storage)
// — centralizar acoplaria comportamentos diferentes. Ficam locais em cada config.

/** Disclaimer clínico exibido (banner de UI em web e mobile; também usado server-side no Telegram). */
export const CHATBOT_DISCLAIMER =
  'Não substituo orientação médica. Consulte seu médico para decisões sobre o seu tratamento.'

/** Chips de sugestão no estado inicial / acima do input. */
export const CHATBOT_QUICK_SUGGESTIONS = [
  'Qual meu próximo remédio?',
  'Como está minha adesão?',
  'Algum estoque baixo?',
]

/**
 * Mensagem de boas-vindas inicial. NÃO embute o disclaimer — ele é exibido por um banner
 * próprio em ambas as superfícies (FR-016). Mantém o disclaimer fora do corpo evita
 * duplicação banner+welcome.
 * @param {number|null} timestamp
 * @returns {{role:'assistant', content:string, timestamp:number|null}}
 */
export function createWelcomeMessage(timestamp = null) {
  return {
    role: 'assistant',
    content: 'Olá! Sou a assistente IA do Dosiq. Como posso te ajudar hoje?',
    timestamp,
  }
}
