import { describe, it, expect, afterEach, vi } from 'vitest'
import { EVENT_CARD_REGISTRY, resolveEventCard } from '../eventCardRegistry'
import DoseEventCard from '../DoseEventCard'
import BiomarkerEventCard from '../BiomarkerEventCard'

// FP-3 (ADR-050/R-252): a UI itera sobre `event.type` via registry. Adicionar um tipo
// futuro = registrar um card; tipo desconhecido é ignorado sem quebrar a stream.
describe('eventCardRegistry', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('resolve os cards de `dose` e `biomarker` para os renderizadores corretos', () => {
    expect(resolveEventCard('dose')).toBe(DoseEventCard)
    expect(EVENT_CARD_REGISTRY.dose).toBe(DoseEventCard)
    expect(resolveEventCard('biomarker')).toBe(BiomarkerEventCard) // 012 Fase C
  })

  it('retorna null para tipo não registrado (ex: note futuro) — não quebra', () => {
    expect(resolveEventCard('note')).toBeNull()
    expect(resolveEventCard(undefined)).toBeNull()
  })

  it('o registry é imutável (freeze) — extensão é explícita, não acidental', () => {
    expect(Object.isFrozen(EVENT_CARD_REGISTRY)).toBe(true)
  })
})
