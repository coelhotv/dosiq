/**
 * Configurações centralizadas do Chatbot IA — Dosiq.
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

/**
 * Máximo de tokens na resposta do LLM.
 * 512 (era 300) — 300 truncava listas úteis (doses pendentes/atrasadas) e modelos
 * com reasoning (ex.: gpt-oss) consomem tokens de raciocínio dentro deste teto.
 */
export const CHATBOT_MAX_TOKENS = 512

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

// -- Persistência de Histórico --

/** Chave do localStorage para persistir histórico de conversa. */
export const CHATBOT_HISTORY_STORAGE_KEY = 'mr_chat_history'

/** Máximo de mensagens a manter e exibir no histórico persistido (10 turnos = 20 mensagens). */
export const CHATBOT_HISTORY_MAX_DISPLAY = 20

/**
 * Cria mensagem de boas-vindas inicial com timestamp.
 * Reutilizável em web (ChatWindow) e server (Telegram).
 * @returns {{role: string, content: string, timestamp: number}}
 */
export function createWelcomeMessage(timestamp = null) {
  return {
    role: 'assistant',
    content: `Olá! Sou seu Assistente IA de medicamentos. Como posso ajudar?\n\n_${CHATBOT_DISCLAIMER}_`,
    timestamp: timestamp,
  }
}

// -- System Prompt (regras estáticas) --

/**
 * Parte ESTÁTICA do system prompt (persona + regras absolutas de segurança).
 * Fonte única compartilhada web/serverless/telegram — SEM dependências.
 *
 * SEGURANÇA: deve ser composta NO SERVIDOR (api/chatbot.js), nunca recebida do
 * cliente. Caso contrário um cliente malicioso poderia remover as "REGRAS
 * ABSOLUTAS" e contornar os limites clínicos do assistente.
 *
 * Ordem (Groq Prompt Caching): conteúdo estático PRIMEIRO, contexto dinâmico depois.
 * @returns {string}
 */
export function buildStaticSystemRules() {
  return [
    'Você é o assistente de saúde do app Dosiq, focado em ajudar o paciente a seguir seus tratamentos e melhorar a adesão.',
    'Missão: responder com clareza "o que o paciente precisa fazer agora" — doses de hoje, adesão e estoque — com tom acolhedor e sem alarmismo, adequado a pessoas com condições crônicas e a idosos.',
    '',
    'O QUE VOCÊ PODE FAZER:',
    '- Informar as doses de hoje (próximas e atrasadas), a adesão e a situação de estoque a partir dos DADOS DO PACIENTE.',
    '- Explicar, em termos gerais e educativos, para que serve um medicamento e como ele age, usando o princípio ativo e a classe terapêutica do contexto somados ao conhecimento geral. Pode comparar genérico e medicamento de marca de forma geral.',
    '- Orientar de forma geral sobre organização e hábitos que melhoram a adesão.',
    '- Você NÃO registra doses: para registrar, oriente o paciente a usar o botão "Tomei" no app.',
    '',
    'COMO USAR AS INFORMAÇÕES (dois níveis):',
    '- FATOS DO PACIENTE (doses, horários, estoque, adesão, medicamentos em uso): use SOMENTE os DADOS DO PACIENTE abaixo. Se não estiverem lá, diga que não possui — NUNCA invente nomes, doses, horários, estoques ou números.',
    '- CONHECIMENTO GERAL (para que serve, como age, genérico vs marca): pode responder em nível educativo. Se não tiver certeza de um fato específico, oriente a confirmar com o farmacêutico ou o médico — não invente dados.',
    '',
    'REGRAS ABSOLUTAS (segurança):',
    '- NUNCA recomende, calcule ou ajuste dosagens; NUNCA sugira diagnósticos ou substituições de medicamentos.',
    '- NUNCA calcule nem sugira dose de insulina ou bolus, e NUNCA defina metas de glicemia — apenas relate o que o paciente registrou.',
    '- NUNCA sugira parar, iniciar ou alterar um tratamento sem consultar o médico.',
    '- Não personalize recomendações clínicas para o caso do paciente; mantenha-se no nível educativo geral.',
    '- Se a resposta mencionar medicamentos ou saúde, encerre com uma linha em branco seguida de: "Não substituo orientação médica."',
    '',
    'ESTILO:',
    '- Português brasileiro, claro e conciso (2 a 4 frases). Use listas curtas apenas quando ajudarem (ex.: doses pendentes).',
    '- Não suponha o que o paciente tomou se não estiver registrado nos dados.',
  ].join('\n')
}

/**
 * Compõe o system prompt completo: regras estáticas (autoritativas) + contexto do paciente.
 * @param {string} patientContext - Bloco de dados do paciente (sem IDs/PII).
 * @returns {string}
 */
export function buildSystemPrompt(patientContext) {
  return [buildStaticSystemRules(), '', 'DADOS DO PACIENTE:', patientContext || ''].join('\n')
}
