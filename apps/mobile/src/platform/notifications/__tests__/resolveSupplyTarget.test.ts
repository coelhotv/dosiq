// resolveSupplyTarget.test.ts — spec 105 FR-019 (PO-105-7).
// Decisão real + regra real do core (`nextStepSwitchMedicineId`); só a I/O é falsa.
// 🔴 Fica vermelho se: o destino vier de id de remédio no push; o estoque abrir com controle desligado;
// tratamento inexistente/erro de rede abrir tela quebrada em vez do Hoje.

import { resolveSupplyTarget } from '../resolveSupplyTarget'

const PROTO = '2b1c3f5e-8a4d-4e6b-9c7a-1d2e3f4a5b6c'
const MED_A = '11111111-1111-4111-8111-111111111111'
const MED_B = '22222222-2222-4222-8222-222222222222'
const TIT = '33333333-3333-4333-8333-333333333333'

const switchLadder = [
  { titration_id: TIT, position: 1, medicine_id: MED_A, status: 'current', protocol_id: PROTO },
  { titration_id: TIT, position: 2, medicine_id: MED_B, status: 'pending', protocol_id: null },
]
const sameMedLadder = [
  { titration_id: TIT, position: 1, medicine_id: MED_A, status: 'current', protocol_id: PROTO },
  { titration_id: TIT, position: 2, medicine_id: MED_A, status: 'pending', protocol_id: null },
]

function deps(over: Partial<Parameters<typeof resolveSupplyTarget>[1]> = {}) {
  return {
    getProtocolOrigin: jest.fn(async () => ({ id: PROTO, medicine_id: MED_A })),
    getSteps: jest.fn(async () => switchLadder),
    getMedicineName: jest.fn(async () => 'Remédio B'),
    isStockTrackingEnabled: jest.fn(async () => true),
    ...over,
  }
}

describe('resolveSupplyTarget (105 FR-019)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it.each(['monthly_dose', 'monthly_purchase'] as const)('%s ⇒ detalhe do tratamento, sem ler etapas', async (supply) => {
    const d = deps()
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply }, d)).toEqual({ kind: 'treatment', protocolId: PROTO })
    expect(d.getSteps).not.toHaveBeenCalled()
  })

  it('step_switch + estoque ligado ⇒ estoque do medicamento da PRÓXIMA etapa', async () => {
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'step_switch' }, deps())).toEqual({
      kind: 'stock',
      medicineId: MED_B,
      medicineName: 'Remédio B',
    })
  })

  it('step_switch + estoque desligado ⇒ detalhe do tratamento', async () => {
    const d = deps({ isStockTrackingEnabled: jest.fn(async () => false) })
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'step_switch' }, d)).toEqual({ kind: 'treatment', protocolId: PROTO })
    expect(d.getSteps).not.toHaveBeenCalled()
  })

  it('step_switch, próxima etapa com o MESMO medicamento (escada já trocou/mudou) ⇒ detalhe do tratamento', async () => {
    const d = deps({ getSteps: jest.fn(async () => sameMedLadder) })
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'step_switch' }, d)).toEqual({ kind: 'treatment', protocolId: PROTO })
  })

  it('step_switch, leitura das etapas falha ⇒ detalhe do tratamento (nunca tela quebrada)', async () => {
    const d = deps({ getSteps: jest.fn(async () => { throw new Error('offline') }) })
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'step_switch' }, d)).toEqual({ kind: 'treatment', protocolId: PROTO })
  })

  it('step_switch, nome indisponível ⇒ estoque mesmo assim, nome vazio (a tela carrega pelo id)', async () => {
    const d = deps({ getMedicineName: jest.fn(async () => { throw new Error('x') }) })
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'step_switch' }, d)).toEqual({ kind: 'stock', medicineId: MED_B, medicineName: '' })
  })

  it('tratamento inexistente / de outra conta (RLS ⇒ null) ⇒ Hoje', async () => {
    const d = deps({ getProtocolOrigin: jest.fn(async () => null) })
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'monthly_dose' }, d)).toEqual({ kind: 'today' })
  })

  it('sem rede para conferir o tratamento ⇒ Hoje', async () => {
    const d = deps({ getProtocolOrigin: jest.fn(async () => { throw new Error('Network request failed') }) })
    expect(await resolveSupplyTarget({ protocolId: PROTO, supply: 'step_switch' }, d)).toEqual({ kind: 'today' })
  })
})
