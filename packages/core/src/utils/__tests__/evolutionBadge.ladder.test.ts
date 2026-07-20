// Badge da Evolução derivado da escada COMPLETA (029 · furo achado no smoke do PO, 2026-07-20).
//
// O QUE ESTE TESTE TRAVA: o badge lia o recorte da escada por `protocol_id`, e esse campo marca o
// executor VIGENTE — fica NULL na maioria das etapas (medido em prod: 6 de 15 sem, 1 das 4
// vigentes sem). Com o recorte, a etapa `current` sumia do conjunto e a listagem anunciava
// "Estável" sobre um tratamento em plena evolução, enquanto o detalhe (que lê pela `titration_id`)
// dizia "Em evolução" — a MESMA escada com duas respostas em duas telas.
//
// O primeiro caso reproduz a escada REAL do smoke (Mounjaro, titulação b5dd99df): 6 etapas, a
// vigente na posição 1 SEM `protocol_id`, e a única etapa com `protocol_id` é uma `upcoming`.

import { describe, it, expect } from 'vitest'
import { getEvolutionBadge } from '../titrationUtils'

const PROTO = '2e5bd1ab-caaf-4172-b62c-20514403ed6a'

/** Escada literal do caso de smoke (prod 2026-07-20). */
const escadaMounjaro = [
  { id: 's0', position: 0, status: 'completed', duration_days: 14, protocol_id: null },
  { id: 's1', position: 1, status: 'current', duration_days: 14, protocol_id: null },
  { id: 's2', position: 2, status: 'upcoming', duration_days: null, protocol_id: null },
  { id: 's3', position: 3, status: 'upcoming', duration_days: 7, protocol_id: PROTO },
  { id: 's4', position: 4, status: 'upcoming', duration_days: 7, protocol_id: null },
  { id: 's5', position: 5, status: 'upcoming', duration_days: null, protocol_id: null },
]

describe('getEvolutionBadge — escada completa vs recorte por protocol_id', () => {
  it('escada COMPLETA com vigente finita → Em evolução', () => {
    expect(getEvolutionBadge(escadaMounjaro).key).toBe('em_evolucao')
  })

  it('🔴 o recorte por protocol_id perde a vigente e mentiria "Estável"', () => {
    // Este é o dado que a listagem recebia. O teste existe para documentar que ele é INSUFICIENTE:
    // se um dia alguém voltar a filtrar por protocol_id, o badge volta a mentir.
    const recorte = escadaMounjaro.filter((s) => s.protocol_id === PROTO)
    expect(recorte).toHaveLength(1)
    expect(getEvolutionBadge(recorte).key).toBe('estavel')
  })

  it('resíduo `current` numa posição anterior não decide o badge (vigente = maior position)', () => {
    // s0 ficou `current` (resíduo que o banco não impede) com duração finita; a vigente REAL é a
    // contínua em s1 ⇒ Estável. Com `find`, o resíduo finito responderia "Em evolução".
    const comResiduo = [
      { id: 's0', position: 0, status: 'current', duration_days: 14, protocol_id: null },
      { id: 's1', position: 1, status: 'current', duration_days: null, protocol_id: null },
    ]
    expect(getEvolutionBadge(comResiduo).key).toBe('estavel')
  })

  it('vigente CONTÍNUA (manutenção) → Estável', () => {
    const manutencao = [
      { id: 's0', position: 0, status: 'completed', duration_days: 14, protocol_id: null },
      { id: 's1', position: 1, status: 'current', duration_days: null, protocol_id: null },
    ]
    expect(getEvolutionBadge(manutencao).key).toBe('estavel')
  })

  it('sem escada / sem vigente → Estável (default do §2)', () => {
    expect(getEvolutionBadge([]).key).toBe('estavel')
    expect(getEvolutionBadge(null).key).toBe('estavel')
    expect(getEvolutionBadge([{ id: 'x', position: 0, status: 'upcoming', duration_days: 7 }]).key).toBe('estavel')
  })
})
