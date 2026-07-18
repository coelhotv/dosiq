// titrationService.test.ts — núcleo do cadastro da escada (spec 029 F4 / T021).
// Cobre a lógica PURA (sem client), que é onde moram as duas armadilhas do slice:
//   - T019a (AP-301): a etapa 0 nasce current + started_at (senão a titulação nasce zumbi).
//   - A5 (CON-032): protocol_id vincula o run same-med; a etapa de outro medicamento fica NULL.
//   - AP-299: intake_unit da escada (sólido → 'cp', líquido → massa mg/UI) ≠ protocols.intake_unit.
// O client é mockado só para o módulo carregar — nada aqui exercita o select (AP-300/AP-279:
// teste sobre client mockado é falso-verde; por isso o alvo é a função pura, não o I/O).

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}))

import {
  buildLadderRows,
  deriveStepIntakeUnit,
  buildLadderEditPlan,
  isEmptyEditPlan,
  type LadderStepInput,
  type ExistingLadderStep,
  type DesiredEditableStep,
} from '../services/titrationService'

const NOW = '2026-07-17T12:00:00.000Z'
const PROTOCOL = 'protocol-A'
const TITRATION = 'titration-1'

afterEach(() => {
  jest.clearAllMocks()
})

describe('buildLadderRows — ativação (T019a / AP-301)', () => {
  it('a etapa 0 nasce current COM started_at; as demais upcoming sem started_at', () => {
    const steps: LadderStepInput[] = [
      { medicine_id: 'MET', dose: 1, intake_unit: 'cp', duration_days: 14 },
      { medicine_id: 'MET', dose: 2, intake_unit: 'cp', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'MET', steps, NOW)

    expect(rows[0].status).toBe('current')
    expect(rows[0].started_at).toBe(NOW)
    expect(rows[1].status).toBe('upcoming')
    expect(rows[1].started_at).toBeNull()
  })

  it('invariante anti-zumbi: started_at é não-nulo EXATAMENTE quando status === current', () => {
    const steps: LadderStepInput[] = [
      { medicine_id: 'S025', dose: 0.25, intake_unit: 'mg', duration_days: 28 },
      { medicine_id: 'S05', dose: 0.5, intake_unit: 'mg', duration_days: 28 },
      { medicine_id: 'S1', dose: 1, intake_unit: 'mg', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'S025', steps, NOW)
    for (const row of rows) {
      expect(row.started_at !== null).toBe(row.status === 'current')
    }
  })

  it('preserva posição, dose, unidade e duração de cada etapa', () => {
    const steps: LadderStepInput[] = [
      { medicine_id: 'MET', dose: 1, intake_unit: 'cp', duration_days: 14 },
      { medicine_id: 'MET', dose: 2, intake_unit: 'cp', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'MET', steps, NOW)
    expect(rows.map((r) => r.position)).toEqual([0, 1])
    expect(rows[0]).toMatchObject({ dose: 1, intake_unit: 'cp', duration_days: 14, titration_id: TITRATION })
    expect(rows[1]).toMatchObject({ dose: 2, intake_unit: 'cp', duration_days: null })
  })
})

describe('buildLadderRows — vínculo protocol_id (A5 / CON-032)', () => {
  it('same-med (metoprolol 1→2 cp): TODAS as etapas pertencem ao protocolo', () => {
    // PO-3: o caso canônico dose_change — mesma dosagem, muda a quantidade de comprimidos.
    const steps: LadderStepInput[] = [
      { medicine_id: 'MET', dose: 1, intake_unit: 'cp', duration_days: 14 },
      { medicine_id: 'MET', dose: 2, intake_unit: 'cp', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'MET', steps, NOW)
    // Sem protocol_id na etapa futura same-med, o dose_change automático nunca a enxergaria
    // (embed filtra por protocol_id) — repetiria o AP-298 em silêncio.
    expect(rows.every((r) => r.protocol_id === PROTOCOL)).toBe(true)
  })

  it('multi-med (semaglutida 0,25 → 0,5): a etapa de outro medicamento fica com protocol_id NULL', () => {
    const steps: LadderStepInput[] = [
      { medicine_id: 'S025', dose: 0.25, intake_unit: 'mg', duration_days: 28 },
      { medicine_id: 'S05', dose: 0.5, intake_unit: 'mg', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'S025', steps, NOW)
    expect(rows[0].protocol_id).toBe(PROTOCOL) // etapa vigente executa pelo protocolo
    expect(rows[1].protocol_id).toBeNull() // switch: F5 cria o protocolo executor e vincula
  })

  it('âncora: a etapa 0 SEMPRE pertence ao protocolo, mesmo se o medicamento divergir (anti-órfã)', () => {
    // Edge: usuário troca o medicamento do 1º passo. Sem o guard, a etapa 0 nasceria com
    // protocol_id NULL → getLadderForProtocol nunca acha a escada (invisível + duplica). AP-301.
    const steps: LadderStepInput[] = [
      { medicine_id: 'OUTRO', dose: 1, intake_unit: 'cp', duration_days: 14 },
      { medicine_id: 'OUTRO', dose: 2, intake_unit: 'cp', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'MET', steps, NOW)
    expect(rows[0].protocol_id).toBe(PROTOCOL) // âncora forçada
    expect(rows[0].status).toBe('current') // e ativada (T019a)
    expect(rows[1].protocol_id).toBeNull() // run fechou (medicamento ≠ protocolo) → futura órfã até F5
  })

  it('escada mista: o run same-med termina na 1ª etapa de outro medicamento', () => {
    const steps: LadderStepInput[] = [
      { medicine_id: 'S025', dose: 0.25, intake_unit: 'mg', duration_days: 28 },
      { medicine_id: 'S05', dose: 0.5, intake_unit: 'mg', duration_days: 28 },
      { medicine_id: 'S1', dose: 1, intake_unit: 'mg', duration_days: null },
    ]
    const rows = buildLadderRows(TITRATION, PROTOCOL, 'S025', steps, NOW)
    expect(rows.map((r) => r.protocol_id)).toEqual([PROTOCOL, null, null])
  })
})

describe('buildLadderEditPlan — edição toca só o futuro (T019 / guard A4:247)', () => {
  // Escada base: etapa 0 vigente (current, protocol med), etapas 1..2 futuras same-med.
  const ex = (over: Partial<ExistingLadderStep>): ExistingLadderStep => ({
    id: 'x',
    position: 0,
    status: 'upcoming',
    medicine_id: 'MET',
    dose: 1,
    intake_unit: 'cp',
    duration_days: 14,
    protocol_id: PROTOCOL,
    ...over,
  })
  const base: ExistingLadderStep[] = [
    ex({ id: 's0', position: 0, status: 'current', dose: 1 }),
    ex({ id: 's1', position: 1, dose: 2 }),
    ex({ id: 's2', position: 2, dose: 3, duration_days: null }),
  ]
  // desejado = as futuras (s1, s2) como o builder as devolve (id preservado).
  const asDesired = (steps: ExistingLadderStep[]): DesiredEditableStep[] =>
    steps
      .filter((s) => s.status === 'upcoming' || s.status === 'pending_confirmation')
      .map((s) => ({ id: s.id, medicine_id: s.medicine_id, dose: s.dose, intake_unit: s.intake_unit, duration_days: s.duration_days }))

  it('nenhuma mudança → plano vazio (isEmptyEditPlan)', () => {
    const plan = buildLadderEditPlan(TITRATION, PROTOCOL, 'MET', base, asDesired(base))
    expect(isEmptyEditPlan(plan)).toBe(true)
  })

  it('editar dose de uma etapa futura → só toUpdate; a vigente nunca entra no plano', () => {
    const desired = asDesired(base).map((d) => (d.id === 's1' ? { ...d, dose: 5 } : d))
    const plan = buildLadderEditPlan(TITRATION, PROTOCOL, 'MET', base, desired)
    expect(plan.toDelete).toEqual([])
    expect(plan.toCreate).toEqual([])
    expect(plan.toUpdate).toEqual([{ id: 's1', updates: { dose: 5 } }])
    // s0 (current) jamais referenciada.
    expect(plan.toUpdate.some((u) => u.id === 's0')).toBe(false)
  })

  it('remover etapa futura do meio → toDelete + reindex das seguintes', () => {
    // remove s1; s2 desce da posição 2 para 1.
    const desired = asDesired(base).filter((d) => d.id !== 's1')
    const plan = buildLadderEditPlan(TITRATION, PROTOCOL, 'MET', base, desired)
    expect(plan.toDelete).toEqual(['s1'])
    expect(plan.toUpdate).toEqual([{ id: 's2', updates: { position: 1 } }])
    expect(plan.toCreate).toEqual([])
  })

  it('adicionar etapa nova → toCreate upcoming + started_at null na próxima posição', () => {
    const desired: DesiredEditableStep[] = [
      ...asDesired(base),
      { medicine_id: 'MET', dose: 4, intake_unit: 'cp', duration_days: null },
    ]
    // a última existente era contínua; troco-a p/ finita e adiciono a contínua nova (cenário real).
    desired[1] = { ...desired[1], duration_days: 21 }
    const plan = buildLadderEditPlan(TITRATION, PROTOCOL, 'MET', base, desired)
    expect(plan.toCreate).toHaveLength(1)
    expect(plan.toCreate[0]).toMatchObject({
      titration_id: TITRATION,
      position: 3,
      status: 'upcoming',
      started_at: null,
      protocol_id: PROTOCOL, // same-med → pertence ao protocolo
      dose: 4,
    })
  })

  it('trocar medicamento de etapa futura fecha o run: protocol_id vira NULL dela em diante', () => {
    const desired = asDesired(base).map((d) => (d.id === 's1' ? { ...d, medicine_id: 'S05' } : d))
    const plan = buildLadderEditPlan(TITRATION, PROTOCOL, 'MET', base, desired)
    const u1 = plan.toUpdate.find((u) => u.id === 's1')
    const u2 = plan.toUpdate.find((u) => u.id === 's2')
    expect(u1?.updates.medicine_id).toBe('S05')
    expect(u1?.updates.protocol_id).toBeNull()
    // s2 continua same-med 'MET', mas o run já fechou em s1 → também perde o protocol_id.
    expect(u2?.updates.protocol_id).toBeNull()
  })

  it('etapa completed no prefixo nunca é deletada nem atualizada', () => {
    const withCompleted: ExistingLadderStep[] = [
      ex({ id: 'c0', position: 0, status: 'completed', dose: 1 }),
      ex({ id: 's0', position: 1, status: 'current', dose: 2 }),
      ex({ id: 's1', position: 2, dose: 3, duration_days: null }),
    ]
    // remove TODAS as futuras.
    const plan = buildLadderEditPlan(TITRATION, PROTOCOL, 'MET', withCompleted, [])
    expect(plan.toDelete).toEqual(['s1'])
    expect(plan.toUpdate).toEqual([])
    expect(plan.toCreate).toEqual([])
  })
})

describe('deriveStepIntakeUnit — fronteira de unidade (AP-299)', () => {
  it('sólido (comprimido) → cp', () => {
    expect(deriveStepIntakeUnit({ dosage_unit: 'mg' })).toBe('cp')
    expect(deriveStepIntakeUnit({ dosage_unit: 'mcg' })).toBe('cp')
    expect(deriveStepIntakeUnit({ dosage_unit: null })).toBe('cp')
    expect(deriveStepIntakeUnit({})).toBe('cp')
  })

  it('líquido → a massa da concentração (mg/ml → mg, ui/ml → UI)', () => {
    expect(deriveStepIntakeUnit({ dosage_unit: 'mg/ml' })).toBe('mg')
    expect(deriveStepIntakeUnit({ dosage_unit: 'ui/ml' })).toBe('UI')
  })

  it('todo valor derivado pertence ao CHECK de titration_steps.intake_unit', () => {
    const allowed = new Set(['gotas', 'ml', 'UI', 'mg', 'cp'])
    for (const du of ['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'un', null]) {
      expect(allowed.has(deriveStepIntakeUnit({ dosage_unit: du }))).toBe(true)
    }
  })
})
