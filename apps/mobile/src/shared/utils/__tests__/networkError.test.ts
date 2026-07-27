import { isNetworkError, describeError, OFFLINE_PARTIAL_MESSAGE } from '../networkError'

describe('isNetworkError', () => {
  it('reconhece o erro exato do fetch nativo do RN (o que vazou no smoke 055)', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true)
  })

  it('é insensível a caixa', () => {
    expect(isNetworkError(new Error('NETWORK REQUEST FAILED'))).toBe(true)
  })

  it('reconhece variantes de outros runtimes', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:54321'))).toBe(true)
  })

  it('aceita string crua', () => {
    expect(isNetworkError('Network request failed')).toBe(true)
  })

  // O ponto do design: na dúvida, NÃO é rede. Classificar bug como "sem internet"
  // esconderia o defeito de quem precisa vê-lo.
  it('não classifica erro de domínio como falha de rede', () => {
    expect(isNetworkError(new Error('Sessão expirada. Faça login novamente.'))).toBe(false)
    expect(isNetworkError(new Error('violates check constraint'))).toBe(false)
  })

  it('lida com entradas sem mensagem', () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
    expect(isNetworkError(new Error(''))).toBe(false)
    expect(isNetworkError({ code: 500 })).toBe(false)
  })
})

describe('describeError', () => {
  it('troca erro de rede pela mensagem em PT', () => {
    expect(describeError(new TypeError('Network request failed'))).toBe(OFFLINE_PARTIAL_MESSAGE)
  })

  it('preserva a mensagem original quando não é rede', () => {
    expect(describeError(new Error('Sessão expirada.'))).toBe('Sessão expirada.')
  })

  it('nunca devolve vazio', () => {
    expect(describeError(null)).toBe('Erro inesperado.')
    expect(describeError({})).toBe('Erro inesperado.')
  })
})
