// Spec 067 C.1 / FR-041 (PO-18) — o device não REPÕE token que o servidor limpou.
//
// Failure mode alvo (medido em prod): APNs recusa o token (400 BadDeviceToken) → o servidor limpa
// `la_push_token` → o device re-sincroniza a cada 15 min / foreground e reescreve o MESMO token →
// o servidor tenta de novo. 81 push_failed numa única ocorrência; a coluna nunca ficou limpa.

const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockGetToken = jest.fn()
const mockEmit = jest.fn().mockResolvedValue({ ok: true })

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    from: () => ({ update: (...a) => mockUpdate(...a) }),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}))
jest.mock('../liveActivityService', () => ({ getActivityPushToken: (...a) => mockGetToken(...a) }))
jest.mock('@dosiq/core', () => ({ createCriticalAuditService: () => ({ emit: (...a) => mockEmit(...a) }) }))

import { syncActivityToken, forgetSyncedToken } from '../syncActivityToken'

const TOKEN = '80abcdef0123'
let inst = 0
/** id novo por teste: o dedupe é module-level e persiste entre casos (como em produção). */
const nextInstance = () => `inst-${++inst}`

beforeEach(() => {
  mockEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: (...a) => mockEq(...a) })
  mockGetToken.mockResolvedValue(TOKEN)
})
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('syncActivityToken — dedupe governa o UPDATE (FR-041)', () => {
  it('1ª sync escreve a coluna e emite token_captured', async () => {
    const id = nextInstance()
    await syncActivityToken(id)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({ la_push_token: TOKEN })
    expect(mockEq).toHaveBeenCalledWith('id', id)
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit.mock.calls[0][0]).toMatchObject({ event: 'token_captured', doseInstanceId: id })
  })

  it('2ª sync com token IDÊNTICO não reescreve nada — fim do ping-pong', async () => {
    const id = nextInstance()
    await syncActivityToken(id)
    mockUpdate.mockClear()
    mockEmit.mockClear()

    await syncActivityToken(id) // re-sync de 15 min / foreground
    await syncActivityToken(id)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('token DIFERENTE (rotação real do iOS) continua escrevendo — o caminho feliz não regride', async () => {
    const id = nextInstance()
    await syncActivityToken(id)
    mockUpdate.mockClear()

    mockGetToken.mockResolvedValue('80outro999')
    await syncActivityToken(id)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({ la_push_token: '80outro999' })
  })

  it('falha na ESCRITA não marca como sincronizado — a próxima sync tenta de novo', async () => {
    // Failure mode do dedupe ingênuo: marcar antes da confirmação transformaria uma falha de rede
    // em token permanentemente ausente no servidor, e a LA pararia de receber push em silêncio.
    const id = nextInstance()
    mockEq.mockResolvedValueOnce({ error: { message: 'network' } })
    await syncActivityToken(id)
    expect(mockEmit).not.toHaveBeenCalled() // não houve captura confirmada

    mockUpdate.mockClear()
    await syncActivityToken(id)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledTimes(1)
  })

  it('forgetSyncedToken libera a instância: Activity NOVA sincroniza mesmo com token igual', async () => {
    const id = nextInstance()
    await syncActivityToken(id)
    mockUpdate.mockClear()

    forgetSyncedToken(id) // LA encerrada localmente
    await syncActivityToken(id)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('sem instanceId → no-op', async () => {
    await syncActivityToken('')
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('token ainda vazio (iOS não emitiu) → não escreve; retry curto e desiste sem lançar', async () => {
    const id = nextInstance()
    mockGetToken.mockResolvedValue(null)
    await expect(syncActivityToken(id, { attempts: 2 })).resolves.toBeUndefined()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
