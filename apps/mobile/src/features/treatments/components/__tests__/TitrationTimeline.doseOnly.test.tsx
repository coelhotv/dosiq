// Regressão do aviso de preparação de estoque em modo dose-only (spec 044 + 029 F5 §8).
//
// POR QUE ESTE TESTE EXISTE: o gate já existia como `doseOnly?: boolean` com default `false`, e
// NENHUM call site passava — então quem desligou o controle de estoque lia "Você ainda não tem
// estoque cadastrado dela" sobre um cadastro que, para ele, não existe. A copy §8 dizia
// "(omitido em dose-only)"; o fio nunca foi ligado, e nada no pipeline reclamou: prop opcional
// com default permissivo compila, passa no lint e renderiza texto errado em silêncio.
//
// O teste trava o COMPORTAMENTO (o aviso some quando a preferência está off), não a fiação — se
// alguém voltar a esconder a decisão atrás de uma prop, ele quebra.

import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import TitrationTimeline from '../TitrationTimeline'

const mockUseStockTracking = jest.fn()
jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: () => mockUseStockTracking(),
}))

// Escada de 2 etapas com medicamentos DIFERENTES: é a condição que dispara o aviso.
const STEPS = [
  {
    id: 'step-0',
    position: 0,
    status: 'current',
    started_at: '2026-07-01T12:00:00.000Z',
    duration_days: 7,
    dose: 1,
    intake_unit: null,
    protocol_id: 'proto-1',
    medicine: { id: 'med-a', name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 5, concentration_volume_ml: 0.5 },
  },
  {
    id: 'step-1',
    position: 1,
    status: 'upcoming',
    started_at: null,
    duration_days: 7,
    dose: 1,
    intake_unit: null,
    protocol_id: 'proto-1',
    medicine: { id: 'med-b', name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 10, concentration_volume_ml: 0.5 },
  },
]

jest.mock('@treatments/hooks/useTitrationTimeline', () => ({
  useTitrationTimeline: () => ({
    steps: STEPS,
    hasLadder: true,
    loading: false,
    refresh: jest.fn(),
  }),
}))

const mockNavigateCrossTab = jest.fn()
jest.mock('@navigation/navigateCrossTab', () => ({
  navigateCrossTab: (...a: unknown[]) => mockNavigateCrossTab(...a),
}))

const mockGetTotalQuantity = jest.fn(async (_id: string) => 0 as number)
jest.mock('@stock/services/stockService', () => ({
  stockService: { getTotalQuantity: (id: string) => mockGetTotalQuantity(id) },
}))

// Foco = efeito (o aviso relê o saldo do próximo remédio a cada foco).
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}))
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('@treatments/components/EvolutionBadge', () => 'EvolutionBadge')

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('TitrationTimeline — aviso de preparação de estoque', () => {
  it('mostra o aviso quando o usuário CONTROLA estoque e o próximo remédio está sem saldo', async () => {
    mockUseStockTracking.mockReturnValue({ enabled: true, ready: true })
    const { findByText } = render(<TitrationTimeline protocolId="proto-1" />)
    expect(await findByText(/A próxima etapa usa/)).toBeTruthy()
    expect(mockGetTotalQuantity).toHaveBeenCalledWith('med-b')
  })

  // 105 smoke (2026-11-06): comprou o remédio da próxima etapa ⇒ o aviso some (era fixo).
  it('saldo do próximo remédio cobre a 1ª dose ⇒ SEM aviso', async () => {
    mockUseStockTracking.mockReturnValue({ enabled: true, ready: true })
    mockGetTotalQuantity.mockResolvedValueOnce(1)
    const { queryByText } = render(<TitrationTimeline protocolId="proto-1" />)
    await waitFor(() => expect(mockGetTotalQuantity).toHaveBeenCalled())
    await waitFor(() => expect(queryByText(/A próxima etapa usa/)).toBeNull())
  })

  it('leitura do saldo falhou ⇒ aviso aparece (fail-safe)', async () => {
    mockUseStockTracking.mockReturnValue({ enabled: true, ready: true })
    mockGetTotalQuantity.mockRejectedValueOnce(new Error('offline'))
    const { findByText } = render(<TitrationTimeline protocolId="proto-1" />)
    expect(await findByText(/A próxima etapa usa/)).toBeTruthy()
  })

  // 105 Fatia B (smoke 2026-11-06): o aviso abre o estoque do remédio da PRÓXIMA etapa.
  it('toque no aviso ⇒ estoque do medicamento da próxima etapa (aba Estoque → detalhe)', async () => {
    mockUseStockTracking.mockReturnValue({ enabled: true, ready: true })
    const { findByTestId } = render(<TitrationTimeline protocolId="proto-1" />)
    fireEvent.press(await findByTestId('titration-prep-stock'))
    expect(mockNavigateCrossTab).toHaveBeenCalledWith('Estoque', 'StockDetail', {
      medicineId: 'med-b',
      medicineName: expect.stringContaining('Mounjaro'),
    })
  })

  it('OMITE o aviso em dose-only — não há cadastro de estoque a faltar', () => {
    mockUseStockTracking.mockReturnValue({ enabled: false, ready: true })
    const { queryByText } = render(<TitrationTimeline protocolId="proto-1" />)
    expect(queryByText(/A próxima etapa usa/)).toBeNull()
    expect(queryByText(/estoque cadastrado/)).toBeNull()
  })

  it('não pisca o aviso enquanto a preferência não foi lida', () => {
    // `ready:false` é "ainda não sei". Renderizar o aviso aqui mostraria a mensagem por um
    // instante para quem desligou o estoque — mesma razão do gate da tab bar.
    mockUseStockTracking.mockReturnValue({ enabled: true, ready: false })
    const { queryByText } = render(<TitrationTimeline protocolId="proto-1" />)
    expect(queryByText(/A próxima etapa usa/)).toBeNull()
  })
})
