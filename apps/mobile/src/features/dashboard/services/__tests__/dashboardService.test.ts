// dashboardService.test.ts — spec 090 D-1 (PO-1, PO-2 · INV-1)
//
// O que este arquivo protege: "conta sem linha de configuração" e "falha ao ler a configuração" são
// coisas diferentes. A versão antiga (`.single()` + condição invertida) lançava no primeiro caso
// (PGRST116 abortava os bridges de alarme e, pós-091, virava tela de erro no Hoje) e devolvia `null`
// no segundo (erro real engolido, fuso caía no default em silêncio).
//
// 🔴 O mock responde como o PostgREST responde: `maybeSingle()` devolve `{data:null, error:null}` para
// 0 linhas. Se o serviço voltar a usar `.single()`, o mock não tem o método e o teste quebra — é de
// propósito: o shape do cliente é parte da prova.

let mockResult: { data: unknown; error: unknown } = { data: null, error: null }
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(mockResult),
        }),
      }),
    }),
  },
}))

import { getUserSettings } from '../dashboardService'

const USER_ID = '8c0633ef-a0f8-4b74-b1b8-92d4d47034e7'

describe('getUserSettings (090 D-1)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    mockResult = { data: null, error: null }
  })

  it('conta sem linha → null, sem lançar (PO-1)', async () => {
    mockResult = { data: null, error: null }
    await expect(getUserSettings(USER_ID)).resolves.toBeNull()
  })

  it('linha existente → devolve os dados', async () => {
    const row = { display_name: 'Ana', timezone: 'America/Manaus', complexity_override: 'simple' }
    mockResult = { data: row, error: null }
    await expect(getUserSettings(USER_ID)).resolves.toEqual(row)
  })

  it('erro real (permissão) → lança, nunca vira null (PO-2 · INV-1)', async () => {
    const err = { code: '42501', message: 'permission denied for table user_settings' }
    mockResult = { data: null, error: err }
    await expect(getUserSettings(USER_ID)).rejects.toBe(err)
  })

  it('erro de rede → lança (o chamador decide o fallback)', async () => {
    const err = new TypeError('Network request failed')
    mockResult = { data: null, error: err }
    await expect(getUserSettings(USER_ID)).rejects.toBe(err)
  })
})
