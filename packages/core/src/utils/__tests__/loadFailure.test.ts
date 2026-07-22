// Regressão do AP-314: no outage de 2026-07-22 o usuário viu "Cache expirado (> 24h)" com wifi
// funcionando, porque o fallback de cache engolia o `42703` que era a causa real. O teste fixa a
// PRECEDÊNCIA (servidor sobre cache) e a presença do CÓDIGO na mensagem — é o código que torna o
// print do usuário diagnosticável.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { describeLoadFailure, isServerError } from '../loadFailure'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

// Erro real capturado em produção no outage (coluna dropada pelo 029 F6).
const postgrest42703 = {
  code: '42703',
  message: 'column protocols.titration_status does not exist',
}

const cacheExpired = new Error('Cache expirado (> 24h)')

describe('isServerError', () => {
  it('reconhece resposta do PostgREST pelo `code`', () => {
    expect(isServerError(postgrest42703)).toBe(true)
    expect(isServerError({ code: 'PGRST200', message: 'FK não encontrada' })).toBe(true)
  })

  it('não confunde falha de rede com erro de servidor', () => {
    expect(isServerError(new TypeError('Network request failed'))).toBe(false)
    expect(isServerError(cacheExpired)).toBe(false)
    expect(isServerError(null)).toBe(false)
    expect(isServerError(undefined)).toBe(false)
    expect(isServerError('string solta')).toBe(false)
  })

  it('ignora `code` vazio ou não-string', () => {
    expect(isServerError({ code: '' })).toBe(false)
    expect(isServerError({ code: 42703 })).toBe(false)
  })
})

describe('describeLoadFailure', () => {
  it('🔴 AP-314: erro de servidor VENCE "Cache expirado" — o cenário do outage', () => {
    const msg = describeLoadFailure(postgrest42703, cacheExpired)

    expect(msg).toContain('42703')
    expect(msg).toContain('titration_status')
    // O que NÃO pode acontecer: quebra de schema se disfarçar de app offline.
    expect(msg).not.toContain('Cache expirado')
  })

  it('offline de verdade continua reportando o erro do cache', () => {
    const network = new TypeError('Network request failed')
    expect(describeLoadFailure(network, cacheExpired)).toBe('Cache expirado (> 24h)')
  })

  it('cai no erro original quando o fallback não tem mensagem', () => {
    const network = new TypeError('Network request failed')
    expect(describeLoadFailure(network, {})).toBe('Network request failed')
  })

  it('usa o default quando nenhum dos dois tem mensagem', () => {
    expect(describeLoadFailure({}, {}, 'Erro ao carregar estoque.')).toBe(
      'Erro ao carregar estoque.',
    )
  })

  // RC6 do PR #766 levantou (incorretamente) que omitir o 3º argumento devolveria `undefined` e
  // renderizaria estado vazio. O parâmetro tem default, então não devolve — mas não havia teste
  // fixando isso. Agora há: NUNCA retornar vazio, sob nenhuma combinação de entrada.
  it('sem o 3º argumento, ainda devolve mensagem — nunca undefined/vazio', () => {
    expect(describeLoadFailure({}, {})).toBe('Erro ao carregar dados.')
    expect(describeLoadFailure(null, null)).toBe('Erro ao carregar dados.')
    expect(describeLoadFailure(undefined, undefined)).toBe('Erro ao carregar dados.')
  })

  it('erro de servidor sem mensagem ainda expõe o código', () => {
    expect(describeLoadFailure({ code: '42501' }, cacheExpired)).toContain('42501')
  })
})
