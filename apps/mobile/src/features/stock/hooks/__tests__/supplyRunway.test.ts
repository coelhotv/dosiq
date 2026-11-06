// supplyRunway.test.ts — spec 105 Fatia B (PO-105-G4, PO-105-5).
// Core REAL (`isStockRunwayAlertExpected` / `computeSupplyDate`): a prova é que lista, badge e Hoje
// leem o MESMO resultado que o servidor usa (INV-1). Nada do core é mockado.
// 🔴 Fica vermelho se: mensal/etapa de passagem voltar a "Crítico"/banner de falta; diário perder o
// alerta; leitura de etapas falhar e calar o alerta (AP-277); a data vier de outro lugar que não o core.

import { attachSupplyRunway, supplyEligibleMedicineIds, supplyLabelOf, formatSupplyDateShort } from '../_stockDataTransformer'
import { deriveStockAlerts, deriveSupplyNotices } from '../../../dashboard/hooks/_useTodayDerived'

const NOW = new Date('2026-11-05T13:00:00.000Z') // 10:00 em São Paulo
const TIT = 'tit-1'

const monthly = { id: 'p-m', medicine_id: 'm-inj', frequency: 'personalizado', interval_days: 30, active: true }
const daily = { id: 'p-d', medicine_id: 'm-daily', frequency: 'diário', interval_days: null, active: true }
const ladderProto = { id: 'p-l', medicine_id: 'm-a', frequency: 'semanal', interval_days: 7, active: true }

const switchSteps = [
  { titration_id: TIT, position: 1, medicine_id: 'm-a', status: 'current', protocol_id: 'p-l', dose: 1, started_at: '2026-10-20T12:00:00.000Z', duration_days: 28 },
  { titration_id: TIT, position: 2, medicine_id: 'm-b', status: 'pending', protocol_id: null, dose: 1 },
]

function item(id, protocols, extra = {}) {
  return {
    id,
    name: id,
    totalQuantity: 0,
    hasActiveProtocol: protocols.length > 0,
    activeProtocols: protocols,
    daysRemaining: 0,
    dosesRemaining: 0,
    isDailyStock: false,
    status: 'CRITICAL',
    statusLabel: 'Crítico',
    ...extra,
  }
}

const monthlyInstance = { id: 'di-1', protocol_id: 'p-m', medicine_id: 'm-inj', scheduled_for: '2026-11-08T11:00:00.000Z', expected_dose: 1, status: 'pending' }

describe('attachSupplyRunway (105 G4 / FR-009)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('mensal com saldo 0 ⇒ PLANNED, sem crítico, com a data do core (D = 1ª dose não coberta)', () => {
    const [it0] = attachSupplyRunway([item('m-inj', [monthly])], { steps: [], instances: [monthlyInstance], now: NOW })
    expect(it0.runwayAlertExpected).toBe(false)
    expect(it0.status).toBe('PLANNED')
    expect(it0.supply).toEqual({ status: 'due', date: '2026-11-08', medicineId: 'm-inj', reason: 'sparse', protocolId: 'p-m' })
    expect(supplyLabelOf(it0)).toBe('Próxima compra até 08/11')
    // FR-G5: saldo continua no item
    expect(it0.totalQuantity).toBe(0)
    expect(it0.dosesRemaining).toBe(0)
  })

  it('etapa de passagem ⇒ PLANNED e texto da próxima etapa (compra do PRÓXIMO medicamento)', () => {
    const items = [item('m-a', [ladderProto], { totalQuantity: 10 })]
    const [it0] = attachSupplyRunway(items, { steps: switchSteps, instances: [], now: NOW })
    expect(it0.status).toBe('PLANNED')
    expect(it0.supply).toMatchObject({ status: 'due', medicineId: 'm-b', reason: 'step_switch', date: '2026-11-17' })
    expect(supplyLabelOf(it0)).toBe('Próxima etapa: comprar até 17/11')
  })

  it('diário ⇒ alerta como hoje (status e tier intocados, sem data)', () => {
    const [it0] = attachSupplyRunway([item('m-daily', [daily])], { steps: [], instances: [], now: NOW })
    expect(it0.runwayAlertExpected).toBe(true)
    expect(it0.status).toBe('CRITICAL')
    expect(it0.supply).toBeNull()
  })

  it('mensal + diário do mesmo remédio ⇒ alerta como hoje (AC-G3)', () => {
    const both = { ...daily, id: 'p-d2', medicine_id: 'm-inj' }
    const [it0] = attachSupplyRunway([item('m-inj', [monthly, both])], { steps: [], instances: [monthlyInstance], now: NOW })
    expect(it0.runwayAlertExpected).toBe(true)
    expect(it0.status).toBe('CRITICAL')
  })

  it('interval_days NULL/0 ⇒ não esparso ⇒ alerta (INV-2)', () => {
    const nulls = [{ ...monthly, interval_days: null }, { ...monthly, id: 'p0', interval_days: 0 }]
    const [it0] = attachSupplyRunway([item('m-inj', nulls)], { steps: [], instances: [], now: NOW })
    expect(it0.runwayAlertExpected).toBe(true)
  })

  it('leitura das etapas falhou (steps null) ⇒ fail-safe: alerta como hoje, sem data (AP-277)', () => {
    const [it0] = attachSupplyRunway([item('m-inj', [monthly])], { steps: null, instances: [monthlyInstance], now: NOW })
    expect(it0.runwayAlertExpected).toBe(true)
    expect(it0.status).toBe('CRITICAL')
    expect(it0.supply).toBeNull()
  })

  it('mensal sem dose futura (doses não lidas) ⇒ PLANNED, sem data: texto some, saldo em doses fica (FR-010)', () => {
    const [it0] = attachSupplyRunway([item('m-inj', [monthly])], { steps: [], instances: [], now: NOW })
    expect(it0.status).toBe('PLANNED')
    expect(it0.supply).toEqual({ status: 'no_date' })
    expect(supplyLabelOf(it0)).toBeNull()
  })

  it('saldo cobre a próxima dose ⇒ covered ⇒ sem data inventada', () => {
    const [it0] = attachSupplyRunway([item('m-inj', [monthly], { totalQuantity: 1 })], { steps: [], instances: [monthlyInstance], now: NOW })
    expect(it0.supply).toEqual({ status: 'covered' })
    expect(supplyLabelOf(it0)).toBeNull()
  })

  it('item sem tratamento ativo ⇒ intocado no predicado', () => {
    const [it0] = attachSupplyRunway([item('m-x', [])], { steps: [], instances: [], now: NOW })
    expect(it0.runwayAlertExpected).toBe(true)
    expect(it0.supply).toBeNull()
  })

  it('supplyEligibleMedicineIds: só os elegíveis vão à leitura de doses; etapas null ⇒ nenhum', () => {
    const items = [item('m-inj', [monthly]), item('m-daily', [daily])]
    expect(supplyEligibleMedicineIds(items, [])).toEqual(['m-inj'])
    expect(supplyEligibleMedicineIds(items, null)).toEqual([])
  })

  it.each([['2026-11-08', '08/11'], ['2026-1-8', null], [null, null], ['2026-11-08T00:00', null]])(
    'formatSupplyDateShort(%p) ⇒ %p (sem parse de string, R-020)',
    (input, expected) => {
      expect(formatSupplyDateShort(input)).toBe(expected)
    },
  )
})

// 🔴 Smoke 2026-11-06: os fixtures acima trazem `medicine_id` no protocolo; o select REAL do estoque
// não traz (embed `protocols(id,dosage_per_intake,intake_unit,time_schedule,frequency,interval_days,
// active,start_date,end_date)`). Este caso usa a forma do select, para a premissa não voltar escondida.
describe('forma real do select do estoque (sem medicine_id no protocolo)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('mensal sem medicine_id no embed ⇒ elegível, PLANNED e data de compra', () => {
    const { medicine_id: _omit, ...fromSelect } = monthly
    const it0 = item('m-inj', [fromSelect])
    expect(supplyEligibleMedicineIds([it0], [])).toEqual(['m-inj'])
    const [r] = attachSupplyRunway([it0], { steps: [], instances: [monthlyInstance], now: NOW })
    expect(r.status).toBe('PLANNED')
    expect(r.supply).toMatchObject({ status: 'due', date: '2026-11-08' })
  })
})

describe('Hoje: banner de falta × aviso de compra (105 G4 / G-B5)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  const items = attachSupplyRunway(
    [item('m-inj', [monthly]), item('m-daily', [daily], { daysRemaining: 2, isDailyStock: true, dosesRemaining: 2 })],
    { steps: [], instances: [monthlyInstance], now: NOW },
  )

  it('mensal com saldo 0 fica FORA do banner de falta; diário segue', () => {
    expect(deriveStockAlerts(items).map((a) => a.medicineId)).toEqual(['m-daily'])
  })

  it('item sem a anotação (cache antigo) segue alertando (só false explícito cala)', () => {
    expect(deriveStockAlerts([item('m-inj', [monthly])]).map((a) => a.medicineId)).toEqual(['m-inj'])
  })

  it('aviso neutro: mensal com data em 3 dias aparece; diário não', () => {
    const notices = deriveSupplyNotices(items, '2026-11-05')
    expect(notices).toEqual([
      expect.objectContaining({ medicineId: 'm-inj', date: '2026-11-08', reason: 'sparse', daysUntil: 3, buyMedicineId: 'm-inj' }),
    ])
  })

  it('aviso só faltando 0..7 dias', () => {
    expect(deriveSupplyNotices(items, '2026-10-31')).toHaveLength(0) // 8 dias
    expect(deriveSupplyNotices(items, '2026-11-01')).toHaveLength(1) // 7 dias
    expect(deriveSupplyNotices(items, '2026-11-09')).toHaveLength(0) // passou
  })

  it('escada: compra é do próximo remédio; nome dele só se estiver na lista', () => {
    const ladder = attachSupplyRunway([item('m-a', [ladderProto], { totalQuantity: 10 })], { steps: switchSteps, instances: [], now: NOW })
    const [n] = deriveSupplyNotices(ladder, '2026-11-12')
    expect(n).toMatchObject({ medicineId: 'm-a', buyMedicineId: 'm-b', buyMedicineName: null, reason: 'step_switch' })
  })
})

describe('nome completo do remédio a comprar (smoke 2026-11-06)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  const { supplyBuyIdsMissing, attachSupplyBuyNames } = jest.requireActual('../_stockDataTransformer')
  const { supplyNoticeCopy } = jest.requireActual('../../../dashboard/components/SupplyNoticeInline')
  const ladder = attachSupplyRunway([item('m-a', [ladderProto], { totalQuantity: 10 })], { steps: switchSteps, instances: [], now: NOW })

  it('escada: remédio da próxima etapa fora da lista ⇒ pedido de cadastro; dentro ⇒ não', () => {
    expect(supplyBuyIdsMissing(ladder)).toEqual(['m-b'])
    expect(supplyBuyIdsMissing([...ladder, item('m-b', [])])).toEqual([])
  })

  it('nome com concentração (formatMedicineFullName) e texto do card no tom da titulação', () => {
    const named = attachSupplyBuyNames(ladder, [{ id: 'm-b', name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 10, concentration_volume_ml: 0.5 }])
    expect(named[0].supplyBuyName).toMatch(/^Mounjaro 5 ?mg/)
    const [n] = deriveSupplyNotices(named, '2026-11-12')
    expect(supplyNoticeCopy(n)).toEqual({
      title: `A próxima etapa usa ${named[0].supplyBuyName}`,
      hint: 'Garanta até 17/11 — você ainda não tem estoque dela.',
    })
  })

  it('cadastro indisponível ⇒ texto genérico, sem nome inventado', () => {
    const [n] = deriveSupplyNotices(attachSupplyBuyNames(ladder, []), '2026-11-12')
    expect(supplyNoticeCopy(n).title).toBe('A próxima etapa usa outro medicamento')
  })

  it('mensal: título com nome e data', () => {
    const monthlyItems = attachSupplyBuyNames(
      attachSupplyRunway([item('m-inj', [monthly], { name: 'Mesigyna' })], { steps: [], instances: [monthlyInstance], now: NOW }),
    )
    const [n] = deriveSupplyNotices(monthlyItems, '2026-11-05')
    expect(supplyNoticeCopy(n)).toEqual({ title: 'Dose mensal de Mesigyna em 08/11', hint: 'Você ainda não tem estoque para ela.' })
  })
})
