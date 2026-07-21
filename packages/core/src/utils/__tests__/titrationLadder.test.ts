import { describe, it, expect, afterEach, vi } from 'vitest'
import { attachFullLadders } from '../titrationLadder'

/**
 * 029 F6 — a derivação que web e mobile compartilham para trocar o embed recortado por
 * `protocol_id` pela escada COMPLETA (por `titration_id`).
 *
 * O bug que ela existe para impedir (AP-311, achado no smoke do PO): o embed do PostgREST
 * resolve pela FK `titration_steps.protocol_id`, que só marca o executor VIGENTE — a etapa
 * `current` costuma ficar de fora, e o badge anuncia "Estável" sobre um tratamento em plena
 * evolução.
 */
describe('attachFullLadders', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('substitui o recorte por protocol_id pela escada inteira da titration_id', () => {
    const protocols = [{ id: 'prot-1', titration_steps: [{ id: 's3', titration_id: 't1' }] }]
    const steps = [
      // Só a etapa 2 carrega o vínculo — é ela que faz o protocolo achar a titulação.
      { id: 's1', titration_id: 't1', protocol_id: null, position: 0 },
      { id: 's2', titration_id: 't1', protocol_id: 'prot-1', position: 1 },
      { id: 's3', titration_id: 't1', protocol_id: null, position: 2 },
    ]

    const { protocols: out } = attachFullLadders(protocols, steps)

    expect(out[0].titration_steps).toHaveLength(3)
    expect((out[0].titration_steps as { id: string }[]).map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })

  it('não mistura escadas de titulações diferentes', () => {
    const protocols = [{ id: 'prot-1' }, { id: 'prot-2' }]
    const steps = [
      { id: 'a1', titration_id: 't1', protocol_id: 'prot-1', position: 0 },
      { id: 'a2', titration_id: 't1', protocol_id: null, position: 1 },
      { id: 'b1', titration_id: 't2', protocol_id: 'prot-2', position: 0 },
    ]

    const { protocols: out } = attachFullLadders(protocols, steps)

    expect((out[0].titration_steps as { id: string }[]).map((s) => s.id)).toEqual(['a1', 'a2'])
    expect((out[1].titration_steps as { id: string }[]).map((s) => s.id)).toEqual(['b1'])
  })

  it('PRESERVA o embed do tratamento sem escada (não sobrescreve com vazio)', () => {
    // Um tratamento sem titulação tem embed `[]` legítimo — apagá-lo com null faria a UI
    // tratar "sem escada" como "escada não carregada", que são coisas diferentes.
    const protocols = [{ id: 'prot-sem-escada', titration_steps: [] }]
    const steps = [{ id: 'x', titration_id: 't9', protocol_id: 'outro', position: 0 }]

    const { protocols: out } = attachFullLadders(protocols, steps)

    expect(out[0].titration_steps).toEqual([])
  })

  it('reporta titulação órfã (nenhuma etapa com protocol_id) — AP-311 regra 3', () => {
    const protocols = [{ id: 'prot-1' }]
    const steps = [
      { id: 'a1', titration_id: 't1', protocol_id: 'prot-1', position: 0 },
      // Nenhuma etapa de t2 declara vínculo: inatribuível. Não dá para consertar aqui, mas
      // NÃO pode sumir em silêncio — é o furo se repetindo sem ninguém ver.
      { id: 'b1', titration_id: 't2', protocol_id: null, position: 0 },
    ]

    const { orphanTitrationIds } = attachFullLadders(protocols, steps)

    expect(orphanTitrationIds).toEqual(['t2'])
  })

  it('degrada sem quebrar quando não há etapas ou não há tratamentos', () => {
    expect(attachFullLadders([{ id: 'p1' }], []).protocols).toEqual([{ id: 'p1' }])
    expect(attachFullLadders([{ id: 'p1' }], null).protocols).toEqual([{ id: 'p1' }])
    expect(attachFullLadders(null, [{ id: 's', titration_id: 't' }]).protocols).toEqual([])
    expect(attachFullLadders(undefined, undefined).orphanTitrationIds).toEqual([])
  })

  it('ignora etapa sem titration_id em vez de agrupar sob undefined', () => {
    const protocols = [{ id: 'prot-1' }]
    const steps = [
      { id: 'lixo', titration_id: undefined as unknown as string, protocol_id: 'prot-1' },
      { id: 'ok', titration_id: 't1', protocol_id: 'prot-1', position: 0 },
    ]

    const { protocols: out, orphanTitrationIds } = attachFullLadders(protocols, steps)

    expect((out[0].titration_steps as { id: string }[]).map((s) => s.id)).toEqual(['ok'])
    expect(orphanTitrationIds).toEqual([])
  })
})
