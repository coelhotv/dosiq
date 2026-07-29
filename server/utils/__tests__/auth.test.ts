import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * `verifyAdminAccess` — modelo de autorização por uid (ADR-091 D10 · RC-SEC-2 S-6, CRITICAL).
 *
 * Por que existe como teste e não só como prova manual: o fail-closed por env ausente NÃO é
 * demonstrável num harness local — `dotenv@17` sobe a árvore de diretórios e reinjeta o `.env` do
 * repositório, então "rodar sem a env" exigiria mexer no `.env` do desenvolvedor. Aqui a ausência é
 * construída de forma determinística e fica como guarda de regressão: se alguém transformar o
 * fail-closed num `if (adminUserId && ...)`, este arquivo fica vermelho.
 */

const ADMIN_UID = 'b0c9746c-c4d9-4954-a198-59856009be26'

const getUserMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}))

vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

let verifyAdminAccess: typeof import('../auth.js').verifyAdminAccess

beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('ADMIN_USER_ID', ADMIN_UID)
  ;({ verifyAdminAccess } = await import('../auth.js'))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.unstubAllEnvs()
})

describe('verifyAdminAccess — fail-closed', () => {
  it('ADMIN_USER_ID ausente NEGA, mesmo com token válido do admin', async () => {
    vi.stubEnv('ADMIN_USER_ID', '')
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_UID } }, error: null })

    const result = await verifyAdminAccess(`Bearer token-valido`)

    // "Não existe admin" nega todos — nunca libera todos.
    expect(result.authorized).toBe(false)
    // E não chega a consultar o servidor de auth: nega antes de qualquer trabalho.
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('config do Supabase ausente NEGA', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_URL', '')
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_UID } }, error: null })

    expect((await verifyAdminAccess('Bearer token-valido')).authorized).toBe(false)
  })

  it.each([
    ['header ausente', undefined],
    ['header vazio', ''],
    ['sem o prefixo Bearer', 'token-solto'],
    ['Bearer sem token', 'Bearer '],
    ['Bearer com só espaços', 'Bearer    '],
  ])('%s NEGA sem consultar o servidor de auth', async (_label, header) => {
    const result = await verifyAdminAccess(header as string | undefined)
    expect(result.authorized).toBe(false)
    expect(getUserMock).not.toHaveBeenCalled()
  })
})

describe('verifyAdminAccess — decisão pelo uid', () => {
  it('uid igual a ADMIN_USER_ID AUTORIZA e devolve o userId', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_UID } }, error: null })

    const result = await verifyAdminAccess('Bearer token-do-admin')

    expect(result.authorized).toBe(true)
    expect(result.userId).toBe(ADMIN_UID)
  })

  it('outra conta autenticada NEGA — o vetor S-6 fechado', async () => {
    // Sob o modelo anterior, esta conta bastava escrever o telegram_chat_id do admin na própria
    // linha de `user_settings` para virar admin. Agora o uid é a credencial e não é escrevível.
    getUserMock.mockResolvedValue({
      data: { user: { id: 'e6499ad8-5d86-4bcf-9596-72d01ed6cc09' } },
      error: null,
    })

    expect((await verifyAdminAccess('Bearer token-de-outro')).authorized).toBe(false)
  })

  it('token inválido/expirado NEGA', async () => {
    getUserMock.mockResolvedValue({ data: null, error: { message: 'jwt expired' } })

    expect((await verifyAdminAccess('Bearer token-expirado')).authorized).toBe(false)
  })

  // AP-216: o código anterior fazia `const { data: { user } } = await getUser()` e estourava
  // TypeError quando `data` vinha null.
  it.each([
    ['data null', { data: null, error: null }],
    ['data undefined', { data: undefined, error: null }],
    ['data sem user', { data: {}, error: null }],
    ['user null', { data: { user: null }, error: null }],
    ['user sem id', { data: { user: {} }, error: null }],
  ])('AP-216: %s NEGA sem lançar TypeError', async (_label, response) => {
    getUserMock.mockResolvedValue(response)

    await expect(verifyAdminAccess('Bearer token')).resolves.toMatchObject({ authorized: false })
  })

  it('exceção no getUser NEGA em vez de propagar', async () => {
    getUserMock.mockRejectedValue(new Error('rede caiu'))

    expect((await verifyAdminAccess('Bearer token')).authorized).toBe(false)
  })

  it('valida SEMPRE contra o servidor de auth (nunca decode local do JWT)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_UID } }, error: null })

    await verifyAdminAccess('Bearer token-do-admin')

    // Se algum dia alguém "otimizar" trocando por decode local, esta asserção cai.
    expect(getUserMock).toHaveBeenCalledTimes(1)
  })
})

describe('verifyAdminAccess — mensagem uniforme (S-12)', () => {
  it('todas as negações devolvem a MESMA mensagem, sem revelar a causa', async () => {
    const mensagens = new Set<string | undefined>()

    mensagens.add((await verifyAdminAccess(undefined)).error)
    mensagens.add((await verifyAdminAccess('token-sem-bearer')).error)

    getUserMock.mockResolvedValue({ data: null, error: { message: 'jwt expired' } })
    mensagens.add((await verifyAdminAccess('Bearer expirado')).error)

    getUserMock.mockResolvedValue({ data: { user: { id: 'outro-uid' } }, error: null })
    mensagens.add((await verifyAdminAccess('Bearer de-outro')).error)

    vi.stubEnv('ADMIN_USER_ID', '')
    mensagens.add((await verifyAdminAccess('Bearer qualquer')).error)

    // Mensagem diferente por causa é oráculo para quem sonda: "token inválido" vs "não é admin"
    // conta ao atacante que o token dele é bom.
    expect(mensagens.size).toBe(1)
    expect([...mensagens][0]).toBe('Acesso negado')
  })
})
