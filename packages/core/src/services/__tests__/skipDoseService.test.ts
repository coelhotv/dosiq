// skipDoseService.test.ts — spec 067 Slice B (T041/T044/T045)
//
// O que este teste protege: o skip nunca mais volta a ser um UPDATE cru sem instante declarado,
// e a recusa do banco NUNCA vira sucesso mudo no client (R-305).

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  skipDose,
  isOutOfWindowError,
  extractOutOfWindowScheduledAt,
  OUT_OF_WINDOW_MESSAGE_PREFIX,
} from '../skipDoseService'

function makeClient(result: any) {
  return {
    rpc: vi.fn(async () => result),
  } as any
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('skipDose', () => {
  it('chama a RPC canônica com o instante declarado', async () => {
    const client = makeClient({ data: { skipped: 1, skipped_at: '2026-08-18T12:00:00.000Z' }, error: null })
    const out = await skipDose(client, {
      userId: 'u1',
      instanceIds: ['di-1'],
      skippedAt: '2026-08-18T12:00:00.000Z',
    })

    expect(client.rpc).toHaveBeenCalledWith('skip_dose_atomic', {
      p_user_id: 'u1',
      p_dose_instance_ids: ['di-1'],
      p_skipped_at: '2026-08-18T12:00:00.000Z',
    })
    expect(out).toEqual({ skipped: 1, skippedAt: '2026-08-18T12:00:00.000Z' })
  })

  it('manda o lote inteiro numa chamada só (atomicidade do skip agrupado — Decisão 14)', async () => {
    const client = makeClient({ data: { skipped: 3 }, error: null })
    await skipDose(client, { userId: 'u1', instanceIds: ['a', 'b', 'c'] })

    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.rpc.mock.calls[0][1].p_dose_instance_ids).toEqual(['a', 'b', 'c'])
  })

  it('deduplica ids e descarta vazios (contagem da RPC é por id DISTINCT)', async () => {
    const client = makeClient({ data: { skipped: 2 }, error: null })
    await skipDose(client, { userId: 'u1', instanceIds: ['a', 'a', '', null as any, 'b'] })

    expect(client.rpc.mock.calls[0][1].p_dose_instance_ids).toEqual(['a', 'b'])
  })

  it('aceita Date e normaliza para ISO', async () => {
    const client = makeClient({ data: { skipped: 1 }, error: null })
    await skipDose(client, { userId: 'u1', instanceIds: ['a'], skippedAt: new Date('2026-08-18T09:47:00Z') })

    expect(client.rpc.mock.calls[0][1].p_skipped_at).toBe('2026-08-18T09:47:00.000Z')
  })

  it('sem instante declarado manda null — o default é `now()` do SERVIDOR, não do device', async () => {
    const client = makeClient({ data: { skipped: 1 }, error: null })
    await skipDose(client, { userId: 'u1', instanceIds: ['a'] })

    expect(client.rpc.mock.calls[0][1].p_skipped_at).toBeNull()
  })

  it('lista vazia não chega ao banco', async () => {
    const client = makeClient({ data: null, error: null })
    await expect(skipDose(client, { userId: 'u1', instanceIds: [] })).rejects.toThrow(/Nenhuma dose/)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('sem userId não chega ao banco (posse é da RPC, mas o client não manda lixo)', async () => {
    const client = makeClient({ data: null, error: null })
    await expect(skipDose(client, { userId: '', instanceIds: ['a'] })).rejects.toThrow(/Usuário/)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('erro da RPC vira exceção — recusa NUNCA é sucesso mudo (R-305)', async () => {
    const client = makeClient({
      data: null,
      error: { message: `${OUT_OF_WINDOW_MESSAGE_PREFIX} (horário previsto: 2026-08-18T16:30:00Z)` },
    })
    await expect(skipDose(client, { userId: 'u1', instanceIds: ['a'] })).rejects.toThrow(/Fora da janela/)
  })
})

describe('extractOutOfWindowScheduledAt', () => {
  it('extrai o horário previsto que a RPC carimba na mensagem (FR-013)', () => {
    const err = new Error(`${OUT_OF_WINDOW_MESSAGE_PREFIX} (horário previsto: 2026-08-19T23:45:00Z)`)
    expect(extractOutOfWindowScheduledAt(err)).toBe('2026-08-19T23:45:00Z')
  })

  it('devolve null quando a recusa não foi por janela (posse/estado)', () => {
    expect(extractOutOfWindowScheduledAt(new Error('Acesso não autorizado'))).toBeNull()
    expect(extractOutOfWindowScheduledAt(new Error('Dose indisponível para pular'))).toBeNull()
  })

  it('não quebra com entrada não-Error', () => {
    expect(extractOutOfWindowScheduledAt(null)).toBeNull()
    expect(extractOutOfWindowScheduledAt(undefined)).toBeNull()
  })
})

describe('isOutOfWindowError', () => {
  it('distingue recusa por janela de recusa por posse/estado', () => {
    expect(isOutOfWindowError(new Error(`${OUT_OF_WINDOW_MESSAGE_PREFIX} (horário previsto: X)`))).toBe(true)
    expect(isOutOfWindowError(new Error('Acesso não autorizado'))).toBe(false)
    expect(isOutOfWindowError(new Error('Dose indisponível para pular'))).toBe(false)
  })

  it('não quebra com entrada não-Error', () => {
    expect(isOutOfWindowError(null)).toBe(false)
    expect(isOutOfWindowError(undefined)).toBe(false)
    expect(isOutOfWindowError('Fora da janela da dose')).toBe(true)
  })
})
