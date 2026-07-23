// useStockInitialBalance.test.ts — semântica AP-285 (campo vazio = pulado, zero digitado =
// saldo real), vírgula PT-BR (AP-171), activate()/cancel() (spec 044, F4b / T020).
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook, waitFor, act } from '@testing-library/react-native'
import { useStockInitialBalance as useStockInitialBalanceImport } from '../useStockInitialBalance'
import { stockService as stockServiceImport } from '../../services/stockService'
import { activateStockWithInitialBalance as activateStockWithInitialBalanceImport } from '@profile/services/stockPreferenceService'
import { useStockTracking as useStockTrackingImport } from '@shared/hooks/useStockTracking'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStockInitialBalance = useStockInitialBalanceImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stockService = stockServiceImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activateStockWithInitialBalance = activateStockWithInitialBalanceImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStockTracking = useStockTrackingImport as any

jest.mock('../../services/stockService', () => ({
  stockService: { getMedicinesWithStockOrActiveProtocol: jest.fn() },
}))

jest.mock('@profile/services/stockPreferenceService', () => ({
  activateStockWithInitialBalance: jest.fn(),
}))

jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: jest.fn(),
}))

// O core NÃO é dublado: os formatadores de unidade/dose são a regra que este teste precisa
// medir (dublá-los mediria o mock — AP-279), e as fixtures abaixo têm dosagem real.

const { balanceHint } = require('../useStockInitialBalance')

const MEDICINES = [
  {
    id: 'med-1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg',
    concentration_volume_ml: null, presentation: 'comprimido',
    protocols: [{ active: true, dosage_per_intake: 2, intake_unit: null }],
  },
  // Sem protocolo ativo: o hint cai no fallback de princípio ativo.
  {
    id: 'med-2', name: 'Metformina', dosage_per_pill: 850, dosage_unit: 'mg',
    concentration_volume_ml: null, presentation: 'comprimido',
    protocols: [{ active: false, dosage_per_intake: 1, intake_unit: null }],
  },
  // Injetável (GLP-1): saldo em ML, dose cadastrada em MG → conta APLICAÇÕES.
  {
    id: 'med-3', name: 'Mounjaro', dosage_per_pill: 5, dosage_unit: 'mg/ml',
    concentration_volume_ml: 0.5, presentation: 'injetavel',
    protocols: [{ active: true, dosage_per_intake: 2.5, intake_unit: 'mg' }],
  },
]

describe('useStockInitialBalance', () => {
  const refresh = jest.fn()
  const onDone = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    stockService.getMedicinesWithStockOrActiveProtocol.mockResolvedValue(MEDICINES)
    activateStockWithInitialBalance.mockResolvedValue(undefined)
    refresh.mockResolvedValue(undefined)
    useStockTracking.mockReturnValue({ refresh })
  })

  it('campo vazio (skip) fica fora de entries', async () => {
    const { result } = renderHook(() => useStockInitialBalance('upsell', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setValue('med-1', '10')
      // med-2 nunca recebe setValue: fica vazio (skip por ausência, AP-285).
    })

    await act(async () => {
      await result.current.activate()
    })

    expect(activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-1', quantity: 10 }],
      'upsell',
    )
  })

  it('zero DIGITADO entra em entries como quantity 0', async () => {
    const { result } = renderHook(() => useStockInitialBalance('upsell', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setValue('med-2', '0')
    })

    await act(async () => {
      await result.current.activate()
    })

    expect(activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-2', quantity: 0 }],
      'upsell',
    )
  })

  it('vírgula decimal PT-BR (1,5 -> 1.5)', async () => {
    const { result } = renderHook(() => useStockInitialBalance('upsell', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setValue('med-1', '1,5')
    })

    await act(async () => {
      await result.current.activate()
    })

    expect(activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-1', quantity: 1.5 }],
      'upsell',
    )
  })

  // Regressão (review do PR #740): o sanitizador antigo (`/(,.*),/g`) só removia UMA vírgula.
  // Com 4+ ("1,2,3,4") sobrava a segunda → `Number('1.2.34')` = NaN → o item era descartado de
  // entries SEM erro, e o medicamento entrava no FIFO sem o saldo digitado.
  it('múltiplas vírgulas (colagem) → no máximo uma; valor continua numérico', async () => {
    const { result } = renderHook(() => useStockInitialBalance('upsell', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setValue('med-1', '1,2,3,4')
    })

    expect(result.current.getItem('med-1').value).toBe('1,234')

    await act(async () => {
      await result.current.activate()
    })

    expect(activateStockWithInitialBalance).toHaveBeenCalledWith(
      [{ medicineId: 'med-1', quantity: 1.234 }],
      'upsell',
    )
  })

  it('skip() explícito também mantém o item fora de entries mesmo com valor prévio', async () => {
    const { result } = renderHook(() => useStockInitialBalance('upsell', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setValue('med-1', '10')
      result.current.skip('med-1')
    })

    await act(async () => {
      await result.current.activate()
    })

    expect(activateStockWithInitialBalance).toHaveBeenCalledWith([], 'upsell')
  })

  it('activate() chama activateStockWithInitialBalance + refresh() (AP-281) + onDone', async () => {
    const { result } = renderHook(() => useStockInitialBalance('settings', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.activate()
    })

    expect(activateStockWithInitialBalance).toHaveBeenCalledWith([], 'settings')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancel() não escreve nada (AP-285) — só chama onDone', async () => {
    const { result } = renderHook(() => useStockInitialBalance('settings', onDone))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.cancel()
    })

    expect(activateStockWithInitialBalance).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // A unidade mostrada na tela TEM que ser a mesma que o cadastro de compra pede
  // (PurchaseFormScreen: líquido = frascos × volume, persistido em ml; sólido = unidades).
  // Pedir a quantidade numa unidade e gravá-la em outra corrompe o FIFO em silêncio.
  describe('unidade de estoque e hint de equivalência', () => {
    it('sólido → sufixo "un."; líquido → sufixo "mL" (nunca "un.")', async () => {
      useStockTracking.mockReturnValue({ refresh })
      const { result } = renderHook(() => useStockInitialBalance('settings', onDone))
      await waitFor(() => expect(result.current.medicines).toHaveLength(3))

      const [losartana, , ozempic] = result.current.medicines
      expect(losartana.stockUnit).toBe('un.')
      expect(ozempic.stockUnit).toBe('mL')
    })

    // O hint responde "quanto tempo de tratamento eu tenho na mão?" — DOSES, não princípio
    // ativo (que no líquido só repetia a concentração já exibida no pill ao lado do nome).
    it('sólido: hint conta DOSES (saldo ÷ dose por tomada)', async () => {
      useStockTracking.mockReturnValue({ refresh })
      const { result } = renderHook(() => useStockInitialBalance('settings', onDone))
      await waitFor(() => expect(result.current.medicines).toHaveLength(3))

      const losartana = result.current.medicines[0] // 2 comprimidos por tomada
      expect(balanceHint(losartana, '24')).toBe('Equivale a 12 doses')
      // Sem valor digitado → sem frase.
      expect(balanceHint(losartana, '')).toBe('')
    })

    it('injetável: conta APLICAÇÕES, convertendo a dose (mg) para ml — não repete a concentração', async () => {
      useStockTracking.mockReturnValue({ refresh })
      const { result } = renderHook(() => useStockInitialBalance('settings', onDone))
      await waitFor(() => expect(result.current.medicines).toHaveLength(3))

      const mounjaro = result.current.medicines[2] // dose 2,5 mg = 0,5 ml
      expect(balanceHint(mounjaro, '1,7')).toBe('Equivale a 3 aplicações')
      // A redundância que motivou a mudança: NÃO repetir a concentração do pill.
      expect(balanceHint(mounjaro, '1,7')).not.toContain('mg')
    })

    it('sem protocolo ativo: sólido cai no princípio ativo (fallback melhor que nada)', async () => {
      useStockTracking.mockReturnValue({ refresh })
      const { result } = renderHook(() => useStockInitialBalance('settings', onDone))
      await waitFor(() => expect(result.current.medicines).toHaveLength(3))

      // 30 × 850 mg = 25.500 mg → o formatador do core promove para grama (25,5 g).
      expect(balanceHint(result.current.medicines[1], '30')).toBe('Equivale a 25,5 g no total')
    })
  })
})
