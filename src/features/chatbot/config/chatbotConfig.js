/**
 * Configurações centralizadas do Chatbot IA — Meus Remédios.
 *
 * Fonte canônica para constantes compartilhadas entre:
 * - Web: safetyGuard.js, chatbotService.js
 * - Serverless: api/chatbot.js
 * - Telegram Bot: server/bot/services/chatbotServerService.js
 *
 * REGRA: Este arquivo NÃO deve importar nada (sem dependências).
 * Apenas constantes puras compatíveis com browser e Node.js.
 * Env vars (GROQ_API_KEY, GROQ_MODEL) ficam em cada camada.
 */

// -- Parâmetros do modelo Groq --

/** Máximo de tokens na resposta do LLM. */
export const CHATBOT_MAX_TOKENS = 300

/**
 * Temperature conservadora para respostas factuais (médico/farmácia).
 * Alta temperature → mais "criativo" → mais propenso a alucinar.
 * 0.2 favorece tokens de alta probabilidade (fatos > especulação).
 */
export const CHATBOT_TEMPERATURE = 0.2

/**
 * top_p = 1.0 desabilita nucleus sampling (considera todos os tokens).
 * Combinado com temperature baixa, maximiza factualidade.
 */
export const CHATBOT_TOP_P = 1.0

/** Máximo de turnos de conversa mantidos no histórico. */
export const CHATBOT_MAX_HISTORY = 10

// -- Rate Limiting --

/** Máximo de mensagens por janela de tempo. */
export const CHATBOT_RATE_LIMIT_MAX = 30

/** Janela de rate limit em ms (1 hora). */
export const CHATBOT_RATE_LIMIT_WINDOW = 60 * 60 * 1000

// -- Segurança / Safety Guard --

/**
 * Padrões de mensagem que devem ser bloqueados antes de chegar ao LLM.
 * O LLM não deve responder sobre: dosagem, parar tratamento, diagnóstico,
 * prescrição ou efeitos colaterais graves.
 */
export const CHATBOT_BLOCKED_PATTERNS = [
  /qual\s+(dosagem|dose)\s+(devo|posso|preciso)/i,
  /posso\s+(parar|interromper|suspender)\s+de\s+tomar/i,
  /substituir\s+.+\s+por/i,
  /diagnostico|diagnosticar/i,
  /receitar|prescrever/i,
  /efeito\s+colateral\s+grave/i,
]

/**
 * Disclaimer médico adicionado automaticamente quando a resposta do LLM
 * contém conteúdo relacionado a saúde/medicamentos.
 */
export const CHATBOT_DISCLAIMER =
  'Não substituo orientação médica. Consulte seu médico para decisões sobre o seu tratamento.'

/** Palavras-chave que disparam o disclaimer na resposta. */
export const CHATBOT_HEALTH_KEYWORDS = [
  'medicamento',
  'remedio',
  'dose',
  'tratamento',
  'saude',
  'sintoma',
]
