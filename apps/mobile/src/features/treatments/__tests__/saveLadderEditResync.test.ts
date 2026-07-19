// saveLadderEditResync.test.ts — 052 FR-007b / PO-6.
//
// 🔴 A classe do AP-308: `saveLadderEdit` escreve DIRETO em `titration_steps`, fora do `update()`
// do protocolo. O `syncInstancesOnWrite` (que faz wipe+regen quando um campo de agendamento muda)
// vive no repositório de `protocols` — logo, nunca dispara aqui. Antes da 052 isso era inofensivo
// por acidente: as instâncias não guardavam medicamento nem cronograma da etapa, então o join as
// deixava "certas de graça". Com o congelamento, editar uma etapa futura passa a deixar as doses
// já materializadas presas na dose/medicamento ANTIGOS — o tratamento diz uma coisa e o lembrete
// entrega outra (o modo de falha que a F5.5 mediu como risco clínico, não como atraso).
//
// O client é mockado, então o que se prova aqui é a ORQUESTRAÇÃO (quem chama quem, e quando),
// nunca o I/O — teste sobre client mockado que afirma I/O é falso-verde (AP-279/AP-300).

const mockFrom = jest.fn()
const mockResync = jest.fn()
const mockDeleteStep = jest.fn(async (..._a: any[]) => true)
const mockUpdateStep = jest.fn(async (..._a: any[]) => true)
const mockCreateSteps = jest.fn(async (..._a: any[]) => [])

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const mockCreateTitration = jest.fn(async (..._a: any[]) => ({ id: 'titration-1' }))

jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  createTitrationRepository: jest.fn(() => ({
    create: (...a: any[]) => mockCreateTitration(...a),
    deleteStep: (...a: any[]) => mockDeleteStep(...a),
    updateStep: (...a: any[]) => mockUpdateStep(...a),
    createSteps: (...a: any[]) => mockCreateSteps(...a),
  })),
  resyncProtocolWindow: (...args: unknown[]) => mockResync(...args),
  createDoseInstanceRepository: jest.fn(() => ({})),
  resolveUserTz: jest.fn(async () => 'America/Sao_Paulo'),
}))

import { saveLadderEdit, createFullLadder, type LadderEditPlan } from '../services/titrationService'

const PROTOCOL_ID = 'protocol-A'

/** Cadeia `from('protocols').select(...).eq(...).single()` do resync. Captura o select (AP-279). */
function mockProtocolFetch(result: unknown) {
  const captured = { select: '', eqValue: '' }
  mockFrom.mockReturnValue({
    select: (cols: string) => {
      captured.select = cols
      return {
        eq: (_col: string, val: string) => {
          captured.eqValue = val
          return { single: async () => result }
        },
      }
    },
  })
  return captured
}

const PROTOCOL_ROW = { data: { id: PROTOCOL_ID, user_id: 'user-1' }, error: null }

function plano(overrides: Partial<LadderEditPlan> = {}): LadderEditPlan {
  return { toDelete: [], toUpdate: [], toCreate: [], protocolId: PROTOCOL_ID, ...overrides }
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('saveLadderEdit — reprojeta a janela futura após editar a escada (052 FR-007b)', () => {
  it('edição que criou etapa → dispara o resync do protocolo DONO', async () => {
    mockProtocolFetch(PROTOCOL_ROW)
    await saveLadderEdit(plano({ toCreate: [{ position: 1 } as never] }))

    expect(mockCreateSteps).toHaveBeenCalledTimes(1)
    expect(mockResync).toHaveBeenCalledTimes(1)
    expect(mockResync.mock.calls[0][0]).toMatchObject({ protocol: { id: PROTOCOL_ID } })
  })

  it('edição que só apagou etapa também dispara (a janela futura mudou do mesmo jeito)', async () => {
    mockProtocolFetch(PROTOCOL_ROW)
    await saveLadderEdit(plano({ toDelete: ['step-9'] }))
    expect(mockResync).toHaveBeenCalledTimes(1)
  })

  it('o select do resync traz o embed da escada COM medicine_id (CON-032 + 052 G1)', async () => {
    const captured = mockProtocolFetch(PROTOCOL_ROW)
    await saveLadderEdit(plano({ toUpdate: [{ id: 's1', updates: { dose: 2 } } as never] }))

    // Sem o embed, o gerador degrada a dose para `dosage_per_intake` em silêncio; sem o
    // `medicine_id` do step, congela o medicamento do protocolo em vez do da etapa.
    expect(captured.select).toContain('titration_steps(')
    expect(captured.select).toContain('medicine_id')
    expect(captured.eqValue).toBe(PROTOCOL_ID)
  })

  it('plano VAZIO → nenhum resync (não gasta wipe+regen do futuro à toa)', async () => {
    mockProtocolFetch(PROTOCOL_ROW)
    await saveLadderEdit(plano())
    expect(mockResync).not.toHaveBeenCalled()
  })

  it('resync falhando NÃO derruba a edição já persistida (best-effort — R-245)', async () => {
    mockProtocolFetch(PROTOCOL_ROW)
    mockResync.mockRejectedValueOnce(new Error('rede caiu'))

    await expect(saveLadderEdit(plano({ toDelete: ['step-9'] }))).resolves.toBeUndefined()
    expect(mockDeleteStep).toHaveBeenCalledTimes(1) // a escrita da escada aconteceu
  })

  it('protocolo não encontrado → sai quieto, sem chamar o gerador', async () => {
    mockProtocolFetch({ data: null, error: null })
    await saveLadderEdit(plano({ toDelete: ['step-9'] }))
    expect(mockResync).not.toHaveBeenCalled()
  })
})

// 052 — TERCEIRO caminho, achado pelo RC6 no PR #761.
//
// O de maior impacto dos três, e o menos óbvio: quando a escada é CADASTRADA, o protocolo já
// existe há tempo e sua janela (~30d) já foi materializada SEM escada nenhuma — dose chapada e
// medicamento do protocolo em todos os dias, inclusive os que a etapa 0 nem cobre. Nada corrigia
// essas linhas depois: `syncInstancesOnWrite` só roda em `update()` de protocolo, e cron/rede lazy
// usam `ON CONFLICT DO NOTHING` (preenchem buraco, não consertam linha existente). É o fluxo do
// AP-301 — "adicionei a escada depois" —, que é o fluxo REAL do usuário.
describe('createFullLadder — reprojeta a janela já materializada ao cadastrar a escada (052/RC6)', () => {
  const STEPS = [
    { medicine_id: 'MED-A', dose: 0.25, intake_unit: 'mg', duration_days: 28 },
    { medicine_id: 'MED-B', dose: 0.5, intake_unit: 'mg', duration_days: null },
  ]

  it('após gravar as etapas, dispara o resync do protocolo dono', async () => {
    mockProtocolFetch(PROTOCOL_ROW)
    await createFullLadder(PROTOCOL_ID, 'MED-A', STEPS)

    expect(mockCreateSteps).toHaveBeenCalledTimes(1)
    expect(mockResync).toHaveBeenCalledTimes(1)
    expect(mockResync.mock.calls[0][0]).toMatchObject({ protocol: { id: PROTOCOL_ID } })
  })

  it('resync falhando NÃO derruba o cadastro já persistido (best-effort — R-245)', async () => {
    mockProtocolFetch(PROTOCOL_ROW)
    mockResync.mockRejectedValueOnce(new Error('rede caiu'))

    await expect(createFullLadder(PROTOCOL_ID, 'MED-A', STEPS)).resolves.toMatchObject({
      titration: { id: 'titration-1' },
    })
  })
})
