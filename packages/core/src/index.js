/**
 * @meus-remedios/core — Codigo Puro Compartilhado
 *
 * Fase 2: Estrutura de exportacao preparada.
 * Schemas e utils serao migrados em sprints 2.2-2.3.
 *
 * Exportacoes:
 * - ./src/schemas/index.js       → Zod schemas (medicineSchema, etc)
 * - ./src/utils/index.js         → Utilitarios puros (dateUtils, adherenceLogic, etc)
 * - ./src/protocols-utils/index.js → Utils de protocolos (opcional, depende auditoria)
 */

// Re-exporte de schemas (serao populados em 2.2)
export * from './schemas/index.js'

// Re-exporte de utils (serao populados em 2.3)
export * from './utils/index.js'

// Re-exporte de protocols-utils (opcional, auditado em 2.4)
// export * from './protocols-utils/index.js'
