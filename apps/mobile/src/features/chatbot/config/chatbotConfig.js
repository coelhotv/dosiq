// chatbotConfig.js (mobile) — constantes de UI do chat nativo (spec 015).
//
// Textos de UI (disclaimer, chips, welcome) vêm do core (FR-013 — fonte única web↔mobile);
// aqui ficam só os parâmetros locais do mobile (teto/chave de storage — semântica própria).
// A segurança REAL (systemPrompt + safetyGuard) é composta SERVER-SIDE em api/chatbot.js (AP-237).

// Textos canônicos compartilhados (reexport do core — não duplicar literais aqui).
export {
  CHATBOT_DISCLAIMER,
  CHATBOT_QUICK_SUGGESTIONS,
  createWelcomeMessage,
} from '@dosiq/core'

/** Teto de mensagens mantidas no histórico local (AsyncStorage) — FR-007. Local: semântica de storage. */
export const CHATBOT_MAX_HISTORY = 20

/** Chave de persistência do histórico (AsyncStorage). Local. */
export const CHATBOT_HISTORY_STORAGE_KEY = 'mr_chat_history'
