const mockRpc = jest.fn()
const mockMaybeSingle = jest.fn()

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}))

import { fetchDeletionNotice } from '../deletionNoticeService'

const VALIDO = 'Autorize até {data} ou a conta será excluída.'

describe('fetchDeletionNotice (107 T050 / PO-SEC-3)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('com data e texto válido ⇒ ambos', async () => {
    mockRpc.mockResolvedValue({ data: '2027-01-20T12:00:00+00:00', error: null })
    mockMaybeSingle.mockResolvedValue({ data: { body: VALIDO }, error: null })
    await expect(fetchDeletionNotice()).resolves.toEqual({ eligibleAt: '2027-01-20T12:00:00+00:00', body: VALIDO })
  })

  it('sem data (conta fora da fila) ⇒ null, e o texto nem é lido', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await expect(fetchDeletionNotice()).resolves.toBeNull()
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('erro da RPC ou exceção de rede ⇒ null (fail-open: prompt de sempre)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(fetchDeletionNotice()).resolves.toBeNull()
    mockRpc.mockRejectedValue(new Error('offline'))
    await expect(fetchDeletionNotice()).resolves.toBeNull()
  })

  it('texto inválido do servidor (HTML, sem {data}, placeholder estranho) ⇒ body null = fallback embarcado', async () => {
    mockRpc.mockResolvedValue({ data: '2027-01-20T12:00:00+00:00', error: null })
    for (const body of ['<b>autorize</b> até {data} agora', 'sem marcador nenhum aqui no texto', 'até {data} para {nome} xxxxx', '']) {
      mockMaybeSingle.mockResolvedValueOnce({ data: { body }, error: null })
      await expect(fetchDeletionNotice()).resolves.toEqual({ eligibleAt: '2027-01-20T12:00:00+00:00', body: null })
    }
  })

  it('leitura que não responde em 3 s ⇒ null', async () => {
    jest.useFakeTimers()
    mockRpc.mockReturnValue(new Promise(() => {}))
    const p = fetchDeletionNotice()
    jest.advanceTimersByTime(3001)
    await expect(p).resolves.toBeNull()
  })
})
