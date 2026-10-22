// useOnboardingSetupWrites.test.tsx — escritas do setup do onboarding (spec 096 B3, T040a).
//
// Antes viviam no passo de estoque; agora rodam no S1, SÓ depois do consentimento A. Mantêm as duas
// garantias de antes: prazo por escrita (066 E, C-4) e idempotência do retry (classe do AP-283) — e o
// estado vive no navegador, então voltar do S1 ao S4 e confirmar de novo não duplica nada.

import { renderHook, act } from '@testing-library/react-native'
import { useOnboardingSetupWrites, WRITE_TIMEOUT_MS } from '../hooks/useOnboardingSetupWrites'

const mockMedicineCreate = jest.fn()
const mockProtocolCreate = jest.fn()
const mockMedicineUpdate = jest.fn((..._args: any[]) => Promise.resolve({}))
const mockProtocolUpdate = jest.fn((..._args: any[]) => Promise.resolve({}))
const mockChooseStockMode = jest.fn((..._args: any[]) => Promise.resolve())

jest.mock('@medications/services/medicineService', () => ({
  medicineService: {
    create: (...args: any[]) => mockMedicineCreate(...args),
    update: (...args: any[]) => mockMedicineUpdate(...args),
  },
}))
jest.mock('@treatments/services/protocolService', () => ({
  protocolService: {
    create: (...args: any[]) => mockProtocolCreate(...args),
    update: (...args: any[]) => mockProtocolUpdate(...args),
  },
}))
jest.mock('@profile/services/stockPreferenceService', () => ({
  chooseStockModeInOnboarding: (...args: any[]) => mockChooseStockMode(...args),
}))

const TIMEOUT_MESSAGE = 'A conexão está demorando. Verifique a internet e toque em Salvar de novo.'

const INPUT = {
  medicine: { name: 'Losartana Potássica', dosage_per_pill: '50', dosage_unit: 'mg' },
  medicineSource: 'scan',
  treatment: { frequency: 'diário', _remind: true },
  stockTracking: false,
}

beforeEach(() => {
  mockMedicineCreate.mockResolvedValue({ id: 'med-1' })
  mockProtocolCreate.mockResolvedValue({ id: 'prot-1' })
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('useOnboardingSetupWrites', () => {
  it('grava remédio → tratamento (sem _remind) → preferência, e devolve a intenção de lembrete', async () => {
    const { result } = renderHook(() => useOnboardingSetupWrites())
    let out
    await act(async () => { out = await result.current.writeSetup(INPUT) })
    expect(mockMedicineCreate).toHaveBeenCalledWith(INPUT.medicine, { surface: 'mobile', source: 'scan' })
    expect(mockProtocolCreate.mock.calls[0][0]).toEqual({ frequency: 'diário', medicine_id: 'med-1' })
    expect(mockChooseStockMode).toHaveBeenCalledWith(false)
    expect(out).toEqual({ remind: true })
  })

  it('2ª escrita falha: o retry reaproveita o id da 1ª (1 remédio só)', async () => {
    mockProtocolCreate.mockRejectedValueOnce(new Error('Erro de rede')).mockResolvedValueOnce({ id: 'prot-1' })
    const { result } = renderHook(() => useOnboardingSetupWrites())
    await act(async () => { await expect(result.current.writeSetup(INPUT)).rejects.toThrow('Erro de rede') })
    await act(async () => { await result.current.writeSetup(INPUT) })
    expect(mockMedicineCreate).toHaveBeenCalledTimes(1)
    expect(mockProtocolCreate).toHaveBeenCalledTimes(2)
    expect(mockProtocolCreate.mock.calls[1][0]).toMatchObject({ medicine_id: 'med-1' })
  })

  // RC6 #900: falha parcial + voltar e editar ⇒ atualiza o que já existe (nem pula, nem duplica).
  it('editou o remédio depois de criá-lo: atualiza o registro existente', async () => {
    mockProtocolCreate.mockRejectedValueOnce(new Error('Erro de rede')).mockResolvedValueOnce({ id: 'prot-1' })
    const { result } = renderHook(() => useOnboardingSetupWrites())
    await act(async () => { await expect(result.current.writeSetup(INPUT)).rejects.toThrow('Erro de rede') })
    const edited = { ...INPUT, medicine: { ...INPUT.medicine, dosage_per_pill: '100' } }
    await act(async () => { await result.current.writeSetup(edited) })
    expect(mockMedicineCreate).toHaveBeenCalledTimes(1)
    expect(mockMedicineUpdate).toHaveBeenCalledWith('med-1', edited.medicine, { surface: 'mobile' })
  })

  it('editou o tratamento depois de criá-lo: atualiza o protocolo existente', async () => {
    mockChooseStockMode.mockRejectedValueOnce(new Error('Erro de rede'))
    const { result } = renderHook(() => useOnboardingSetupWrites())
    await act(async () => { await expect(result.current.writeSetup(INPUT)).rejects.toThrow('Erro de rede') })
    const edited = { ...INPUT, treatment: { frequency: 'semanal', _remind: false } }
    await act(async () => { await result.current.writeSetup(edited) })
    expect(mockProtocolCreate).toHaveBeenCalledTimes(1)
    expect(mockProtocolUpdate).toHaveBeenCalledWith('prot-1', { frequency: 'semanal' }, { surface: 'mobile' })
    expect(mockMedicineUpdate).not.toHaveBeenCalled()
  })

  it('escrita sem resposta: estoura o prazo com a mensagem e não segue', async () => {
    jest.useFakeTimers()
    mockMedicineCreate.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useOnboardingSetupWrites())
    let caught: Error | null = null
    await act(async () => {
      const p = result.current.writeSetup(INPUT).catch((e) => { caught = e })
      jest.advanceTimersByTime(WRITE_TIMEOUT_MS)
      await p
    })
    expect(caught?.message).toBe(TIMEOUT_MESSAGE)
    expect(mockProtocolCreate).not.toHaveBeenCalled()
  })

  it('retry depois do prazo reaproveita a escrita atrasada', async () => {
    jest.useFakeTimers()
    let resolveLate: (v: any) => void = () => {}
    mockMedicineCreate.mockReturnValue(new Promise((r) => { resolveLate = r }))
    const { result } = renderHook(() => useOnboardingSetupWrites())
    await act(async () => {
      const p = result.current.writeSetup(INPUT).catch(() => {})
      jest.advanceTimersByTime(WRITE_TIMEOUT_MS)
      await p
    })
    await act(async () => { resolveLate({ id: 'med-late' }) })
    await act(async () => { await result.current.writeSetup(INPUT) })
    expect(mockMedicineCreate).toHaveBeenCalledTimes(1)
    expect(mockProtocolCreate.mock.calls[0][0]).toMatchObject({ medicine_id: 'med-late' })
  })

  it('sem remédio/tratamento no contexto ⇒ lança, nada gravado', async () => {
    const { result } = renderHook(() => useOnboardingSetupWrites())
    await act(async () => {
      await expect(result.current.writeSetup({ ...INPUT, medicine: null })).rejects.toThrow()
    })
    expect(mockMedicineCreate).not.toHaveBeenCalled()
  })
})
