// confirmTitrationSwitch.test.ts — semântica do caller da RPC (spec 029 F5 / T024-T025).
//
// O que importa AQUI não é o I/O (o client é mockado — teste sobre client mockado é falso-verde,
// AP-300/AP-279): é a TRADUÇÃO do contrato da RPC para o que a UI faz. E a tradução tem uma
// armadilha específica que este arquivo existe para travar:
//
//   🔴 `already_confirmed: true` É SUCESSO, não erro (AP-221). É o caminho NORMAL do double-tap
//      e do retry — a idempotência é por ESTADO (o claim `WHERE status='pending_confirmation'`
//      dentro da RPC), não por token. Se alguém "consertar" isso para um erro, a UI passa a
//      mostrar falha num caso em que a etapa FOI iniciada — pior tipo de mentira num app clínico
//      (Constituição IX).

const mockRpc = jest.fn()
const mockFrom = jest.fn()
const mockResync = jest.fn()

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// 029 F5.5: só o resync é substituído — o resto do core segue real (o service importa
// createTitrationRepository/getNow dele).
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  resyncProtocolWindow: (...args: unknown[]) => mockResync(...args),
  createDoseInstanceRepository: jest.fn(() => ({})),
  resolveUserTz: jest.fn(async () => 'America/Sao_Paulo'),
}))

import { confirmTitrationSwitch } from '../services/titrationService'

/**
 * Cadeia `from('protocols').select(...).eq(...).single()` do _resyncAfterSwitch.
 *
 * Captura os argumentos de `select`/`eq` (AP-279: mock que ignora o filtro faz o teste validar o
 * próprio mock). O que precisa ser provado aqui é o EMBED: sem `titration_steps(...)` no select,
 * o gerador degrada a dose para `dosage_per_intake` em SILÊNCIO (CON-032) — bug invisível a tsc,
 * lint e a qualquer asserção sobre o resultado.
 * @private
 */
function mockProtocolFetch(result: unknown) {
  const captured = { select: '', eqColumn: '', eqValue: '' }
  mockFrom.mockReturnValue({
    select: (cols: string) => {
      captured.select = cols
      return {
        eq: (col: string, val: string) => {
          captured.eqColumn = col
          captured.eqValue = val
          return { single: async () => result }
        },
      }
    },
  })
  return captured
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('confirmTitrationSwitch — tradução do contrato CON-032', () => {
  it('sucesso: devolve a transição e os protocolos que a RPC mexeu', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        already_confirmed: false,
        transition: 'medicine_switch',
        step_id: 'step-1',
        protocol_activated: 'proto-novo',
        protocol_paused: 'proto-antigo',
      },
      error: null,
    })

    const result = await confirmTitrationSwitch('step-1')

    expect(mockRpc).toHaveBeenCalledWith('confirm_titration_switch', { p_step_id: 'step-1' })
    expect(result).toEqual({
      ok: true,
      alreadyConfirmed: false,
      transition: 'medicine_switch',
      protocolActivated: 'proto-novo',
      protocolPaused: 'proto-antigo',
    })
  })

  // ── 029 F5.5: paridade com o write-path ─────────────────────────────────────
  // A RPC é a única escrita em `protocols` que não passa pelo repositório, logo a única que
  // escapava do `syncInstancesOnWrite`. Sem o resync o protocolo novo nasce sem NENHUMA
  // instância (calendário vazio até o cron) e o dose_change deixa as futuras com a dose ANTIGA.
  it('materializa a janela do protocolo que passou a executar', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, already_confirmed: false, transition: 'medicine_switch', protocol_activated: 'proto-novo' },
      error: null,
    })
    const protocolRow = { id: 'proto-novo', user_id: 'user-1', titration_steps: [] }
    const captured = mockProtocolFetch({ data: protocolRow, error: null })

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('protocols')
    // 🔴 O embed é o ponto: sem ele o gerador materializaria `dosage_per_intake` em vez da dose
    // da etapa vigente, sem erro nenhum (CON-032). E o filtro tem que ser pelo protocolo ATIVADO.
    expect(captured.select).toContain('titration_steps(')
    expect(captured.eqColumn).toBe('id')
    expect(captured.eqValue).toBe('proto-novo')
    expect(mockResync).toHaveBeenCalledWith(expect.objectContaining({ protocol: protocolRow }))
  })

  it('🔴 falha do resync NÃO derruba a confirmação (R-245) — a transição já aconteceu', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, already_confirmed: false, transition: 'medicine_switch', protocol_activated: 'proto-novo' },
      error: null,
    })
    mockProtocolFetch({ data: { id: 'proto-novo', user_id: 'user-1' }, error: null })
    mockResync.mockRejectedValue(new Error('rede caiu'))

    const result = await confirmTitrationSwitch('step-1')

    // Devolver erro aqui faria o usuário tentar de novo e receber "não pendente": a etapa FOI
    // iniciada. O cron e a rede lazy seguem como malha — o pior caso é o atraso antigo.
    expect(result.ok).toBe(true)
  })

  it('sem protocolo ativado (dose_change sem executor) → não tenta materializar nada', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, already_confirmed: false, transition: 'dose_change', protocol_activated: null },
      error: null,
    })

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(true)
    expect(mockResync).not.toHaveBeenCalled()
  })

  it('🔴 already_confirmed (double-tap/retry) é SUCESSO — nunca erro (AP-221)', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, already_confirmed: true, step_id: 'step-1' },
      error: null,
    })

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(true)
    if (result.ok === true) expect(result.alreadyConfirmed).toBe(true)
  })

  it.each([
    ['nao_pendente', 'não está mais aguardando'],
    ['step_obsoleto', 'já foi concluída'],
    ['nao_autenticado', 'sessão expirou'],
  ])('recusa %s → mensagem factual sobre o que NÃO aconteceu', async (reason, trecho) => {
    mockRpc.mockResolvedValue({ data: { success: false, reason }, error: null })

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reason).toBe(reason)
      expect(result.message.toLowerCase()).toContain(trecho.toLowerCase())
    }
  })

  it('motivo desconhecido cai em nao_pendente (nunca mensagem vazia)', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, reason: 'motivo_do_futuro' }, error: null })

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reason).toBe('nao_pendente')
      expect(result.message.length).toBeGreaterThan(0)
    }
  })

  it('erro de rede: diz que a etapa NÃO foi iniciada e que nada mudou (Const. IX)', async () => {
    mockRpc.mockRejectedValue(new Error('Network request failed'))

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reason).toBe('erro_rede')
      expect(result.message).toContain('não foi iniciada')
      expect(result.message).toContain('nada mudou')
    }
  })

  it('erro do PostgREST também vira recusa honesta, nunca sucesso', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    const result = await confirmTitrationSwitch('step-1')

    expect(result.ok).toBe(false)
  })

  it('stepId vazio nem chega a chamar a RPC', async () => {
    const result = await confirmTitrationSwitch('')

    expect(mockRpc).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
  })
})
