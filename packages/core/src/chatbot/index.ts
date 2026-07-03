// @dosiq/core/chatbot — Contexto canônico do chatbot (CON-028, ADR-074).
//
// Fonte única do fetcher + builder de contexto do paciente para o LLM, compartilhada
// entre web (PWA), Telegram bot e mobile. Mata os forks `contextBuilder.js` (web) e
// `buildServerContext` (Telegram).

export { fetchChatbotContextData } from './fetchChatbotContextData'
export { buildPatientContext } from './buildPatientContext'
export { chatbotContextDataSchema, validateChatbotContextData } from './chatbotContextSchema'
// Textos de UI compartilhados web↔mobile (Onda 3, FR-013)
export { CHATBOT_DISCLAIMER, CHATBOT_QUICK_SUGGESTIONS, createWelcomeMessage } from './chatbotUiText'
