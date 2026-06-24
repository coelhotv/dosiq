// chatbotConfig.js (mobile) — constantes de UI do chat nativo (spec 015 onda 2).
//
// APENAS constantes client de apresentação (disclaimer exibido, teto de histórico,
// chips de sugestão, welcome). A segurança REAL (systemPrompt + safetyGuard) é
// composta SERVER-SIDE em api/chatbot.js (AP-237) — o cliente nunca a envia.
// Textos espelham o web (R-166). NÃO importar de apps/web (apps separados).

/** Teto de mensagens mantidas no histórico local (AsyncStorage) — FR-007. */
export const CHATBOT_MAX_HISTORY = 20

/** Disclaimer clínico (paridade com o web). */
export const CHATBOT_DISCLAIMER =
  'Não substituo orientação médica. Consulte seu médico para decisões sobre o seu tratamento.'

/** Chave de persistência do histórico (AsyncStorage). */
export const CHATBOT_HISTORY_STORAGE_KEY = 'mr_chat_history'

/** Chips de sugestão exibidos no estado vazio / acima do input. */
export const CHATBOT_QUICK_SUGGESTIONS = [
  'Qual meu próximo remédio?',
  'Como está minha adesão?',
  'Algum estoque baixo?',
]

/**
 * Mensagem de boas-vindas inicial (paridade com o web).
 * @param {number|null} timestamp
 * @returns {{role:string, content:string, timestamp:number|null}}
 */
export function createWelcomeMessage(timestamp = null) {
  return {
    role: 'assistant',
    content: `Olá! Sou a assistente IA do Dosiq. Como posso te ajudar hoje? `,
    timestamp,
  }
}
