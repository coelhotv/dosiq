/**
 * @dosiq/core — Codigo Puro Compartilhado
 *
 * Fase 2: Estrutura de exportacao preparada.
 * Schemas e utils serao migrados em sprints 2.2-2.3.
 *
 * Exportacoes:
 * - ./src/schemas/index.js       → Zod schemas (medicineSchema, etc)
 * - ./src/utils/index.js         → Utilitarios puros (dateUtils, adherenceLogic, etc)
 * - ./src/protocols-utils/index.js → Utils de protocolos (opcional, depende auditoria)
 */

// Aplica locale PT-BR no Zod (efeito colateral ao importar @dosiq/core)
import './zodSetup'

// Re-exporte de schemas (serao populados em 2.2)
export * from './schemas/index'

// Re-exporte de utils (serao populados em 2.3)
export * from './utils/index'

// Re-exporte de repositories (Fase 1 G2 — factory CRUD canônico)
export * from './repositories/index'

// Re-exporte de services (Fase 2 — orquestração de geração de dose_instances)
export * from './services/index'

// Re-exporte de chatbot (spec 015 — fetcher + builder canônico de contexto, CON-028)
export * from './chatbot/index'

// Re-exporte de markdown (spec 015 onda 2 — parser leve do chat, paridade web↔mobile)
export * from './markdown/index'

// Re-exporte de protocols-utils (opcional, auditado em 2.4)
// export * from './protocols-utils/index'
