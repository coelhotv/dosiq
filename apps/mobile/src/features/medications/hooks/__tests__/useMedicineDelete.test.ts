// useMedicineDelete.test.ts — preCheck de dependências (spec 044 F3 / 029 F5)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook, act } from '@testing-library/react-native'
import { useMedicineDelete as useMedicineDeleteImport, MEDICINE_IN_USE_MESSAGE } from '../useMedicineDelete'
import { medicineService } from '../../services/medicineService'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useMedicineDelete = useMedicineDeleteImport as any

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}))

const mockShow = jest.fn()
jest.mock('@shared/components/feedback/Toast', () => ({
  useToast: () => ({ show: mockShow }),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  multiRemove: jest.fn(() => Promise.resolve()),
}))

jest.mock('@shared/utils/haptics', () => ({
  successHaptic: jest.fn(),
  errorHaptic: jest.fn(),
}))

jest.mock('../../services/medicineService', () => ({
  medicineService: { delete: jest.fn() },
}))

const MEDICINE_WITH_STOCK = {
  id: 'm1',
  name: 'Ozempic',
  protocols: [],
  titration_steps: [],
  stock: [{ id: 's1', quantity: 4 }],
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('useMedicineDelete — preCheck', () => {
  it('bloqueia por estoque quando o controle de estoque está ligado', () => {
    const { result } = renderHook(() => useMedicineDelete(MEDICINE_WITH_STOCK, true))
    expect(result.current.preCheck.canDelete).toBe(false)
    expect(result.current.preCheck.stockUnits).toBe(4)
  })

  it('modo dose-only: estoque não bloqueia (medicamento é arquivado — 094)', () => {
    const { result } = renderHook(() => useMedicineDelete(MEDICINE_WITH_STOCK, false))
    expect(result.current.preCheck.canDelete).toBe(true)
  })

  it('modo dose-only: tratamento ainda bloqueia', () => {
    const medicine = { ...MEDICINE_WITH_STOCK, protocols: [{ id: 'p1', active: true }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, false))
    expect(result.current.preCheck.canDelete).toBe(false)
  })

  it('modo dose-only: etapa de escada sem estado conhecido bloqueia (conservador)', () => {
    const medicine = { ...MEDICINE_WITH_STOCK, titration_steps: [{ id: 'ts1' }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, false))
    expect(result.current.preCheck.canDelete).toBe(false)
  })

  it('default do parâmetro é estoque ligado (fail-safe)', () => {
    const { result } = renderHook(() => useMedicineDelete(MEDICINE_WITH_STOCK))
    expect(result.current.preCheck.canDelete).toBe(false)
  })
})

// 094 (C1.5 G5a): excluir arquiva. Tratamento arquivado e escada morta são histórico, não dependência.
describe('useMedicineDelete — 094 arquivamento', () => {
  const BASE = { id: 'm1', name: 'Ozempic', protocols: [], titration_steps: [], stock: [] }
  const ladder = (archivedAt) => ({
    titration_steps: [{ protocol_id: 'p-exec', protocol: { archived_at: archivedAt } }],
  })

  it('tratamento arquivado não bloqueia', () => {
    const medicine = { ...BASE, protocols: [{ id: 'p1', active: false, archived_at: '2026-10-01T12:00:00Z' }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, true))
    expect(result.current.preCheck.canDelete).toBe(true)
  })

  it('tratamento pausado (não arquivado) bloqueia', () => {
    const medicine = { ...BASE, protocols: [{ id: 'p1', active: false, archived_at: null }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, true))
    expect(result.current.preCheck.canDelete).toBe(false)
  })

  it('etapa concluída não bloqueia', () => {
    const medicine = { ...BASE, titration_steps: [{ id: 's1', status: 'completed', titration: ladder(null) }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, true))
    expect(result.current.preCheck.canDelete).toBe(true)
  })

  it('etapa por vir de escada viva bloqueia', () => {
    const medicine = { ...BASE, titration_steps: [{ id: 's1', status: 'upcoming', titration: ladder(null) }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, true))
    expect(result.current.preCheck.canDelete).toBe(false)
  })

  it('etapa por vir de escada cujo tratamento foi excluído não bloqueia', () => {
    const medicine = {
      ...BASE,
      titration_steps: [{ id: 's1', status: 'upcoming', titration: ladder('2026-10-01T12:00:00Z') }],
    }
    const { result } = renderHook(() => useMedicineDelete(medicine, true))
    expect(result.current.preCheck.canDelete).toBe(true)
  })

  it('recusa do banco (DQ941) vira mensagem em português', async () => {
    jest.mocked(medicineService.delete).mockRejectedValueOnce(
      Object.assign(new Error('medicine_in_use'), { code: 'DQ941' })
    )
    const { result } = renderHook(() => useMedicineDelete(BASE, true))
    await act(async () => {
      await result.current.confirmDelete()
    })
    expect(mockShow).toHaveBeenCalledWith(MEDICINE_IN_USE_MESSAGE, { variant: 'error' })
  })
})
