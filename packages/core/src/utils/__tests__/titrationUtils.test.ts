// Progresso da etapa vigente para EXIBIÇÃO (badge/timeline/PDF de consulta) — 029 F3.1 / T017e.
//
// Reancorada no pivô da 029: a versão anterior exercitava `calculateTitrationData(protocol)`
// lendo o jsonb N1 (`titration_schedule`/`current_stage_index`/`stage_started_at`) — a titulação
// que nunca funcionou em produção (AP-301) e cujas colunas caem no F6. A função agora lê
// `titration_steps`, a fonte única.
//
// `now` é INJETADO em todo caso (a função é clock-free por parâmetro): sumiu o mock de
// `global.Date` que a versão anterior precisava. Datas locais (AP-270).

import { describe, it, expect } from 'vitest'
import {
  calculateTitrationData,
  getEvolutionBadge,
  resolvePendingSwitch,
  resolveManualNextStep,
  resolveCurrentStep,
  resolveTitrationAdvance,
  type TitrationStepLike,
  type TitrationStepPendingLike,
} from '../titrationUtils'

// ── resolvePendingSwitch (029 F5 / T024) ──────────────────────────────────────
// "Aguardando desde" NÃO sai de `updated_at` (a etapa pendente é editável — bumpar o
// updated_at zeraria o contador em silêncio). Sai do VENCIMENTO da etapa vigente:
// started_at + duration_days, no dia local do dono. Datas locais (AP-270).
describe('resolvePendingSwitch — desde quando o switch aguarda', () => {
  const ladder = (overrides: Partial<TitrationStepPendingLike>[] = []): TitrationStepPendingLike[] => [
    {
      id: 'step-1',
      position: 0,
      status: 'current',
      started_at: '2026-06-10T03:00:00Z', // 10/06 local (GMT-3)
      duration_days: 14, // vence 24/06
      ...overrides[0],
    },
    { id: 'step-2', position: 1, status: 'pending_confirmation', duration_days: 28, ...overrides[1] },
  ]

  // Regressão do smoke do F5: o banco NÃO impede duas etapas `current` na mesma escada
  // (só UNIQUE (titration_id, position)). Com `find()` na primeira `current`, a âncora do
  // vencimento saía da etapa errada e o "aguardando desde" ficava silenciosamente falso.
  it('vigente RESIDUAL numa posição anterior não rouba a âncora do vencimento', () => {
    const corrupted: TitrationStepPendingLike[] = [
      // Resíduo: começou ontem, venceria só em 31/07 — se virar âncora, daysWaiting cai para 0.
      { id: 'residuo', position: 0, status: 'current', started_at: '2026-07-17T03:00:00Z', duration_days: 14 },
      // A vigente REAL, adjacente à pendente: venceu em 15/07.
      { id: 'vigente', position: 1, status: 'current', started_at: '2026-07-01T03:00:00Z', duration_days: 14 },
      { id: 'pendente', position: 2, status: 'pending_confirmation', duration_days: 28 },
    ]
    const info = resolvePendingSwitch(corrupted, '2026-07-18')
    expect(info?.currentStepId).toBe('vigente')
    expect(info?.dueDay).toBe('2026-07-15')
    expect(info?.daysWaiting).toBe(3)
  })

  it('vigente posterior à pendente é ignorada (nunca é âncora)', () => {
    const weird: TitrationStepPendingLike[] = [
      { id: 'vigente', position: 0, status: 'current', started_at: '2026-06-10T03:00:00Z', duration_days: 14 },
      { id: 'pendente', position: 1, status: 'pending_confirmation', duration_days: 28 },
      { id: 'futura-current', position: 2, status: 'current', started_at: '2026-07-01T03:00:00Z', duration_days: 7 },
    ]
    expect(resolvePendingSwitch(weird, '2026-06-24')?.currentStepId).toBe('vigente')
  })

  it('no dia do vencimento → 0 dias de espera ("começa hoje")', () => {
    const info = resolvePendingSwitch(ladder(), '2026-06-24')
    expect(info).toEqual({
      pendingStepId: 'step-2',
      pendingPosition: 1,
      currentStepId: 'step-1',
      dueDay: '2026-06-24',
      daysWaiting: 0,
    })
  })

  it('§7.2 — vencida há 12 dias (o caso do banner amber)', () => {
    expect(resolvePendingSwitch(ladder(), '2026-07-06')?.daysWaiting).toBe(12)
  })

  it('§3.2 — o dia 3 é alcançável (frase de contexto)', () => {
    expect(resolvePendingSwitch(ladder(), '2026-06-27')?.daysWaiting).toBe(3)
  })

  it('editar a escada NÃO desloca o "desde" (é o que updated_at faria)', () => {
    // A etapa pendente muda de dose/duração; a âncora é a VIGENTE → dueDay estável.
    const editada = ladder([{}, { dose: 1, duration_days: 56 }])
    expect(resolvePendingSwitch(editada, '2026-07-06')?.dueDay).toBe('2026-06-24')
  })

  it('[Ajustar duração] na vigente MOVE o "desde" junto (comportamento correto)', () => {
    const esticada = ladder([{ duration_days: 21 }]) // 14 → 21 dias
    const info = resolvePendingSwitch(esticada, '2026-07-06')
    expect(info?.dueDay).toBe('2026-07-01')
    expect(info?.daysWaiting).toBe(5)
  })

  it('sem etapa pendente → null (nada a exibir)', () => {
    const semPendente = ladder([{}, { status: 'upcoming' }])
    expect(resolvePendingSwitch(semPendente, '2026-07-06')).toBeNull()
  })

  it('tratamento pausado (sem etapa vigente) → null, não inventa data', () => {
    const pausada = ladder([{ status: 'completed' }])
    expect(resolvePendingSwitch(pausada, '2026-07-06')).toBeNull()
  })

  it('vigente CONTÍNUA com pendente é incoerente → null', () => {
    const incoerente = ladder([{ duration_days: null }])
    expect(resolvePendingSwitch(incoerente, '2026-07-06')).toBeNull()
  })

  it('vigente sem started_at (dormente) → null (sem âncora não há vencimento)', () => {
    const dormente = ladder([{ started_at: null }])
    expect(resolvePendingSwitch(dormente, '2026-07-06')).toBeNull()
  })

  it('pendência ANTES do vencimento → piso 0, nunca negativo', () => {
    expect(resolvePendingSwitch(ladder(), '2026-06-20')?.daysWaiting).toBe(0)
  })

  it('degenerados: escada vazia/null/undefined e todayLocal vazio → null', () => {
    expect(resolvePendingSwitch([], '2026-07-06')).toBeNull()
    expect(resolvePendingSwitch(null, '2026-07-06')).toBeNull()
    expect(resolvePendingSwitch(undefined, '2026-07-06')).toBeNull()
    expect(resolvePendingSwitch(ladder(), '')).toBeNull()
  })

  it('ordena por position (escada fora de ordem não confunde a âncora)', () => {
    const fora = [...ladder()].reverse()
    expect(resolvePendingSwitch(fora, '2026-07-06')?.currentStepId).toBe('step-1')
  })
})

// ── resolveCurrentStep (029 F5.5 / RC6) ───────────────────────────────────────
// O banco não impede duas `current` na mesma escada (só UNIQUE (titration_id, position)), então
// `find(s => s.status === 'current')` devolve a etapa ERRADA quando há resíduo — em silêncio.
// No form essa escolha decide uma ESCRITA (o status com que a etapa nova nasce), não um rótulo.
describe('resolveCurrentStep — vigente imune a `current` residual', () => {
  const comResiduo: TitrationStepPendingLike[] = [
    { id: 'residuo', position: 0, status: 'current', started_at: '2026-07-17T03:00:00Z', duration_days: 14 },
    { id: 'vigente', position: 1, status: 'current', started_at: '2026-05-12T03:00:00Z', duration_days: null },
    { id: 'nova', position: 2, status: 'pending_confirmation', duration_days: 28 },
  ]

  it('devolve a de MAIOR position entre as current (nunca a primeira)', () => {
    expect(resolveCurrentStep(comResiduo)?.id).toBe('vigente')
  })

  it('🔴 o resíduo é FINITO e a vigente real é CONTÍNUA: quem decide o write é a vigente', () => {
    // Era o bug: `find()` pegaria o resíduo (duration_days 14) → currentIsContinua false → a
    // etapa nova nasceria `upcoming`, inalcançável atrás de uma contínua.
    const vigente = resolveCurrentStep(comResiduo)
    expect(vigente?.duration_days).toBeNull()
  })

  it('beforePosition limita a busca à etapa adjacente anterior', () => {
    expect(resolveCurrentStep(comResiduo, 1)?.id).toBe('residuo')
    expect(resolveCurrentStep(comResiduo, 2)?.id).toBe('vigente')
  })

  it('sem current → undefined; degenerados → undefined', () => {
    expect(resolveCurrentStep([{ id: 'a', position: 0, status: 'completed' }])).toBeUndefined()
    expect(resolveCurrentStep([])).toBeUndefined()
    expect(resolveCurrentStep(null)).toBeUndefined()
    expect(resolveCurrentStep(undefined)).toBeUndefined()
  })

  it('ordena por position (escada fora de ordem não confunde)', () => {
    expect(resolveCurrentStep([...comResiduo].reverse())?.id).toBe('vigente')
  })
})

// ── resolveManualNextStep (029 F5.5 / T034) ───────────────────────────────────
// Sair da etapa CONTÍNUA (manutenção) exige gatilho MANUAL: não há data, há um evento clínico.
// Conceito distinto de `resolvePendingSwitch` (pendência VENCIDA) — as duas são mutuamente
// exclusivas por construção, e a regressão abaixo garante que continuam sendo.
describe('resolveManualNextStep — pendência SEM PRAZO (vigente contínua)', () => {
  const manual = (overrides: Partial<TitrationStepPendingLike>[] = []): TitrationStepPendingLike[] => [
    { id: 'continua', position: 0, status: 'current', started_at: '2026-05-12T03:00:00Z', duration_days: null, ...overrides[0] },
    { id: 'nova', position: 1, status: 'pending_confirmation', duration_days: 28, ...overrides[1] },
  ]

  it('vigente contínua + etapa pendente → devolve a pendente e a âncora contínua', () => {
    expect(resolveManualNextStep(manual())).toEqual({
      pendingStepId: 'nova',
      pendingPosition: 1,
      currentStepId: 'continua',
    })
  })

  it('vigente FINITA → null (esse caso é do motor/resolvePendingSwitch, não daqui)', () => {
    const finita = manual([{ duration_days: 14 }])
    expect(resolveManualNextStep(finita)).toBeNull()
  })

  it('sem etapa pendente → null (o estado terminal normal da manutenção)', () => {
    expect(resolveManualNextStep(manual([{}, { status: 'upcoming' }]))).toBeNull()
  })

  it('a nova etapa TAMBÉM contínua (o caso mais comum) → devolve igual', () => {
    const continuaSobreContinua = manual([{}, { duration_days: null }])
    expect(resolveManualNextStep(continuaSobreContinua)?.pendingStepId).toBe('nova')
  })

  it('várias etapas cadastradas: só a 1ª é pendente, o resto é upcoming', () => {
    const varias: TitrationStepPendingLike[] = [
      ...manual(),
      { id: 'depois', position: 2, status: 'upcoming', duration_days: null },
    ]
    expect(resolveManualNextStep(varias)?.pendingStepId).toBe('nova')
  })

  it('vigente residual anterior não rouba a âncora (mesma classe do smoke do F5)', () => {
    const corrupted: TitrationStepPendingLike[] = [
      { id: 'residuo', position: 0, status: 'current', started_at: '2026-07-17T03:00:00Z', duration_days: 14 },
      { id: 'continua', position: 1, status: 'current', started_at: '2026-05-12T03:00:00Z', duration_days: null },
      { id: 'nova', position: 2, status: 'pending_confirmation', duration_days: 28 },
    ]
    expect(resolveManualNextStep(corrupted)?.currentStepId).toBe('continua')
  })

  it('sem etapa vigente (tratamento pausado) → null', () => {
    expect(resolveManualNextStep(manual([{ status: 'completed' }]))).toBeNull()
  })

  it('degenerados: escada vazia/null/undefined → null', () => {
    expect(resolveManualNextStep([])).toBeNull()
    expect(resolveManualNextStep(null)).toBeNull()
    expect(resolveManualNextStep(undefined)).toBeNull()
  })

  it('ordena por position (escada fora de ordem não confunde a âncora)', () => {
    expect(resolveManualNextStep([...manual()].reverse())?.currentStepId).toBe('continua')
  })

  // 🔴 REGRESSÃO — as duas invariantes que o F5.5 não pode quebrar.
  it('o Hoje NÃO ganha card: resolvePendingSwitch segue null com vigente contínua', () => {
    expect(resolvePendingSwitch(manual(), '2026-07-19')).toBeNull()
  })

  it('a etapa cadastrada é INERTE: o motor não reivindica nem notifica', () => {
    const engineSteps = manual().map((s) => ({ ...s, medicine_id: `med-${s.position}` }))
    expect(resolveTitrationAdvance(engineSteps, '2027-01-01')).toBeNull()
  })
})

describe('getEvolutionBadge — badge derivado da escada N2 (não da coluna N1)', () => {
  it('etapa vigente FINITA → Em evolução', () => {
    const steps: TitrationStepLike[] = [
      { position: 0, status: 'current', started_at: '2026-07-01T00:00:00Z', duration_days: 28 },
      { position: 1, status: 'upcoming', duration_days: null },
    ]
    expect(getEvolutionBadge(steps)).toEqual({ key: 'em_evolucao', label: 'Em evolução' })
  })

  it('etapa vigente CONTÍNUA (duration null) → Estável', () => {
    const steps: TitrationStepLike[] = [
      { position: 0, status: 'completed', duration_days: 28 },
      { position: 1, status: 'current', started_at: '2026-08-01T00:00:00Z', duration_days: null },
    ]
    expect(getEvolutionBadge(steps)).toEqual({ key: 'estavel', label: 'Estável' })
  })

  it('sem etapa vigente (pausada/concluída) → Estável', () => {
    const steps: TitrationStepLike[] = [{ position: 0, status: 'completed', duration_days: 28 }]
    expect(getEvolutionBadge(steps)).toEqual({ key: 'estavel', label: 'Estável' })
  })

  it('sem escada (vazio/null/undefined) → Estável (default de tratamento sem escada)', () => {
    expect(getEvolutionBadge([]).key).toBe('estavel')
    expect(getEvolutionBadge(null).key).toBe('estavel')
    expect(getEvolutionBadge(undefined).key).toBe('estavel')
  })
})

const STAGE_START = '2026-03-01T00:00:00'
const start = new Date(STAGE_START)
const DAY = 24 * 60 * 60 * 1000
const atDay = (n: number) => new Date(start.getTime() + n * DAY)

/** Escada 3 etapas, 28 dias cada; vigente = posição 1 (a do meio). */
const emEvolucao: TitrationStepLike[] = [
  { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
  { position: 1, dose: 0.5, duration_days: 28, status: 'current', started_at: STAGE_START },
  { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
]

describe('calculateTitrationData — progresso da etapa vigente', () => {
  it('etapa 2 de 3, dia 5 de 28', () => {
    expect(calculateTitrationData(emEvolucao, atDay(5))).toEqual({
      currentStep: 2, // 1-based p/ exibição ("Etapa 2/3")
      totalSteps: 3,
      day: 5, // Math.ceil dos dias corridos, com piso 1
      realDay: 5,
      totalDays: 28,
      progressPercent: (5 / 28) * 100,
      isTransitionDue: false,
      daysRemaining: 23,
    })
  })

  it('piso do dia 1: no próprio instante de início já é "dia 1", nunca 0', () => {
    const r = calculateTitrationData(emEvolucao, atDay(0))
    expect(r?.day).toBe(1)
    expect(r?.realDay).toBe(1)
  })

  it('no último dia da etapa a transição ainda NÃO venceu', () => {
    const r = calculateTitrationData(emEvolucao, atDay(28))
    expect(r?.realDay).toBe(28)
    expect(r?.isTransitionDue).toBe(false) // vence em > 28, não em == 28
    expect(r?.daysRemaining).toBe(0)
  })

  it('transição vencida: passou dos 28 dias → isTransitionDue, com day/percent CAPADOS', () => {
    const r = calculateTitrationData(emEvolucao, atDay(29))
    expect(r?.isTransitionDue).toBe(true)
    expect(r?.realDay).toBe(29) // dia real segue contando (é o atraso)
    expect(r?.day).toBe(28) // `day` é o cap VISUAL: a barra não passa do fim
    expect(r?.progressPercent).toBe(100) // idem — nunca > 100%
    expect(r?.daysRemaining).toBe(-1) // negativo = quantos dias de atraso
  })

  it('ordena por position (entrada desordenada não desloca o índice exibido)', () => {
    const desordenada = [emEvolucao[2], emEvolucao[0], emEvolucao[1]]
    expect(calculateTitrationData(desordenada, atDay(5))?.currentStep).toBe(2)
  })

  it('escada de 1 etapa: etapa 1 de 1', () => {
    const unica: TitrationStepLike[] = [
      { position: 0, dose: 1, duration_days: 7, status: 'current', started_at: STAGE_START },
    ]
    const r = calculateTitrationData(unica, atDay(1))
    expect(r?.currentStep).toBe(1)
    expect(r?.totalSteps).toBe(1)
  })
})

describe('calculateTitrationData — sem progresso a exibir (null)', () => {
  it('lista vazia/null/undefined → null', () => {
    expect(calculateTitrationData([], atDay(5))).toBeNull()
    expect(calculateTitrationData(null, atDay(5))).toBeNull()
    expect(calculateTitrationData(undefined, atDay(5))).toBeNull()
  })

  it('nenhuma etapa current (escada pausada/concluída) → null', () => {
    const semVigente: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: STAGE_START },
      { position: 1, dose: 0.5, duration_days: 28, status: 'upcoming', started_at: null },
    ]
    expect(calculateTitrationData(semVigente, atDay(5))).toBeNull()
  })

  it('vigente CONTÍNUA (duration_days null) = manutenção/alvo → null (não há progresso)', () => {
    const manutencao: TitrationStepLike[] = [
      { position: 0, dose: 1.0, duration_days: null, status: 'current', started_at: STAGE_START },
    ]
    expect(calculateTitrationData(manutencao, atDay(5))).toBeNull()
  })

  it('vigente SEM started_at (o zumbi do AP-301) → null', () => {
    // Sem relógio não há progresso a calcular. O CHECK do T017a impede o estado de existir no
    // banco; a exibição segue defensiva (defesa em profundidade).
    const zumbi: TitrationStepLike[] = [
      { position: 0, dose: 0.5, duration_days: 28, status: 'current', started_at: null },
    ]
    expect(calculateTitrationData(zumbi, atDay(5))).toBeNull()
  })

  it('duração 0/negativa → tratada como contínua → null (nunca divide por zero)', () => {
    const mk = (d: any): TitrationStepLike[] => [
      { position: 0, dose: 0.5, duration_days: d, status: 'current', started_at: STAGE_START },
    ]
    expect(calculateTitrationData(mk(0), atDay(5))).toBeNull()
    expect(calculateTitrationData(mk(-7), atDay(5))).toBeNull()
  })
})
