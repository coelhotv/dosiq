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
import { render } from '@testing-library/react-native'
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

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }))
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('@treatments/components/EvolutionBadge', () => 'EvolutionBadge')

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('TitrationTimeline — aviso de preparação de estoque', () => {
  it('mostra o aviso quando o usuário CONTROLA estoque', () => {
    mockUseStockTracking.mockReturnValue({ enabled: true, ready: true })
    const { queryByText } = render(<TitrationTimeline protocolId="proto-1" />)
    expect(queryByText(/A próxima etapa usa/)).toBeTruthy()
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
