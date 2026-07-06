// buildBulkOutcome — Constituição IX (Transparência Radical): mensagem do registro
// em batch nunca silencia falhas/falhas parciais; sempre informa motivo.
import { describe, it, expect } from '@jest/globals'
import { buildBulkOutcome } from '../BulkDoseRegisterModal'

describe('buildBulkOutcome (transparência radical — Constituição IX)', () => {
  it('sucesso pleno (1) → success', () => {
    const r = buildBulkOutcome({ success: true, results: [{ success: true }] })
    expect(r).toMatchObject({ variant: 'success', successCount: 1 })
    expect(r.msg).toBe('Dose registrada com sucesso.')
  })

  it('sucesso pleno (N) → success pluralizado', () => {
    const r = buildBulkOutcome({ success: true, results: [{ success: true }, { success: true }] })
    expect(r.variant).toBe('success')
    expect(r.msg).toBe('2 doses registradas com sucesso.')
  })

  it('parcial → warning com contagem + motivo (NÃO silencia falha)', () => {
    const r = buildBulkOutcome({
      success: true,
      results: [{ success: true }, { success: false, error: 'Estoque insuficiente.' }],
    })
    expect(r.variant).toBe('warning')
    expect(r.successCount).toBe(1)
    expect(r.msg).toBe('1 de 2 doses registradas. 1 falhou. Motivo: Estoque insuficiente.')
    expect(r.duration).toBe(7000)
  })

  it('parcial com motivos distintos → lista todos', () => {
    const r = buildBulkOutcome({
      success: true,
      results: [
        { success: true },
        { success: false, error: 'Estoque insuficiente.' },
        { success: false, error: 'Erro ao processar estoque.' },
      ],
    })
    expect(r.variant).toBe('warning')
    expect(r.msg).toContain('1 de 3 doses registradas. 2 falharam.')
    expect(r.msg).toContain('Estoque insuficiente.')
    expect(r.msg).toContain('Erro ao processar estoque.')
  })

  it('todas falharam → error com motivo único', () => {
    const r = buildBulkOutcome({
      success: false,
      results: [{ success: false, error: 'Estoque insuficiente.' }],
    })
    expect(r).toMatchObject({ variant: 'error', successCount: 0 })
    expect(r.msg).toBe('Nenhuma dose registrada: Estoque insuficiente.')
  })

  it('falha total sem logs processados (rede/insert) → usa result.error', () => {
    const r = buildBulkOutcome({ success: false, error: 'Sem conexão com a internet.', results: [] })
    expect(r).toMatchObject({ variant: 'error', successCount: 0 })
    expect(r.msg).toBe('Sem conexão com a internet.')
  })

  it('todas falharam sem motivo → fallback genérico honesto', () => {
    const r = buildBulkOutcome({ success: false, results: [{ success: false }] })
    expect(r.variant).toBe('error')
    expect(r.msg).toBe('Nenhuma dose foi registrada.')
  })
})
