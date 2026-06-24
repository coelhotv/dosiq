// @dosiq/core/chatbot — Contexto canônico do chatbot (CON-028, ADR-074).
//
// Fonte única do fetcher + builder de contexto do paciente para o LLM, compartilhada
// entre web (PWA), Telegram bot e mobile. Mata os forks `contextBuilder.js` (web) e
// `buildServerContext` (Telegram).

export { fetchChatbotContextData } from './fetchChatbotContextData.js'
export { buildPatientContext } from './buildPatientContext.js'
export { chatbotContextDataSchema, validateChatbotContextData } from './chatbotContextSchema.js'
