// useMedicineDelete.test.ts — preCheck de dependências (spec 044 F3 / 029 F5)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook } from '@testing-library/react-native'
import { useMedicineDelete as useMedicineDeleteImport } from '../useMedicineDelete'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useMedicineDelete = useMedicineDeleteImport as any

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}))

jest.mock('@shared/components/feedback/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
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

  it('modo dose-only: estoque não bloqueia (CASCADE do FK zera no banco)', () => {
    const { result } = renderHook(() => useMedicineDelete(MEDICINE_WITH_STOCK, false))
    expect(result.current.preCheck.canDelete).toBe(true)
  })

  it('modo dose-only: tratamento ainda bloqueia', () => {
    const medicine = { ...MEDICINE_WITH_STOCK, protocols: [{ id: 'p1', active: true }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, false))
    expect(result.current.preCheck.canDelete).toBe(false)
  })

  it('modo dose-only: etapa de titulação ainda bloqueia (FK sem ON DELETE)', () => {
    const medicine = { ...MEDICINE_WITH_STOCK, titration_steps: [{ id: 'ts1' }] }
    const { result } = renderHook(() => useMedicineDelete(medicine, false))
    expect(result.current.preCheck.canDelete).toBe(false)
  })

  it('default do parâmetro é estoque ligado (fail-safe)', () => {
    const { result } = renderHook(() => useMedicineDelete(MEDICINE_WITH_STOCK))
    expect(result.current.preCheck.canDelete).toBe(false)
  })
})
