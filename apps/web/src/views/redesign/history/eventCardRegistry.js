// src/views/redesign/history/eventCardRegistry.js
// PR-F4.2/S4.3 — Registry de renderizadores da timeline, indexado por `event.type` (FP-3/ADR-050).
// Adicionar um tipo futuro (`biomarker`, `note`) = registrar um card aqui, SEM tocar a view
// nem o painel. O builder/adapter no core já é agnóstico (R-252).

import DoseEventCard from './DoseEventCard'
import BiomarkerEventCard from './BiomarkerEventCard'

/** Mapa `event.type` → componente renderizador. */
export const EVENT_CARD_REGISTRY = Object.freeze({
  dose: DoseEventCard,
  biomarker: BiomarkerEventCard,
})

/**
 * Resolve o renderizador de um tipo de evento. Retorna `null` p/ tipos não registrados
 * (a view ignora silenciosamente — nunca quebra a stream por um tipo novo desconhecido).
 * @param {string} type
 * @returns {React.ComponentType|null}
 */
export function resolveEventCard(type) {
  return EVENT_CARD_REGISTRY[type] || null
}
