// titrationTimelineRefresh.test.tsx — 052 Slice C (regressão do smoke do PO, 2026-07-20).
//
// 🔴 O QUE ESTE ARQUIVO TRAVA
// Confirmar a etapa pelo banner tem de RECARREGAR A ESCADA. O banco ficava correto e o banner
// continuava na tela: a escada é estado do `TitrationTimeline` (via `useTitrationTimeline`), que
// só recarrega em focus ou quando o `protocolId` muda — e o `refresh` do `onStartPendingStep` é
// o do PROTOCOLO, outro estado.
//
// Antes do Slice C o defeito era invisível porque a confirmação de um `medicine_switch` navegava
// para o protocolo recém-criado: a troca de `protocolId` remontava a timeline e trazia a escada
// nova de carona. A navegação fazia DOIS trabalhos, e só um deles estava escrito em algum lugar.
// Com executor único não há para onde navegar, e o trabalho não-escrito sumiu.
//
// Por isso o teste assere a ORDEM (confirma → recarrega) e não só que ambos aconteceram: é a
// ordem que prova que o recarregamento é consequência da ação, e não coincidência de um focus.

import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

const mockRefresh = jest.fn(() => Promise.resolve())

// Escada real o bastante para `resolvePendingSwitch` produzir a pendência: vigente vencida
// (started_at + duration_days no passado) e a seguinte em `pending_confirmation` com OUTRO
// medicamento. Fixture com datas LOCAIS derivadas de offset, nunca `toISOString()` (AP-270).
const mockDia = 24 * 60 * 60 * 1000
const mockDiasAtras = (n: number) => new Date(Date.now() - n * mockDia).toISOString()

const mockSteps = [
  {
    id: 'step-vigente', position: 0, status: 'current', dose: 5, intake_unit: 'mg',
    duration_days: 14, started_at: mockDiasAtras(20), ended_at: null,
    medicine_id: 'med-5', medicine: { id: 'med-5', name: 'Mounjaro', dosage_unit: 'mg' },
  },
  {
    id: 'step-pendente', position: 1, status: 'pending_confirmation', dose: 7.5, intake_unit: 'mg',
    duration_days: 14, started_at: null, ended_at: null,
    medicine_id: 'med-75', medicine: { id: 'med-75', name: 'Mounjaro', dosage_unit: 'mg' },
  },
]

jest.mock('@treatments/hooks/useTitrationTimeline', () => ({
  useTitrationTimeline: () => ({
    steps: mockSteps,
    hasLadder: true,
    loading: false,
    refresh: mockRefresh,
    timezone: 'America/Sao_Paulo',
  }),
}))

// `useFocusEffect` vira no-op — e isso é parte da asserção, não conveniência de setup: com o
// caminho de FOCUS desligado, o único refresh possível é o disparado pela ação. Era justamente
// o focus que mascarava o defeito em produção (sair da tela e voltar corrigia a tela sozinho,
// escondendo que a confirmação não invalidava nada).
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }))

jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: () => ({ enabled: false, ready: true }),
}))

// O banner real dispara `onStart` só por toque; substituí-lo por um disparo direto mantém o
// teste sobre O FIO (quem chama quem, em que ordem), que é onde o defeito estava.
jest.mock('@treatments/components/EvolutionPendingBanner', () => {
  const { Text } = require('react-native')
  return function MockBanner({ onStart }: any) {
    setTimeout(() => onStart?.(), 0)
    return <Text>banner-pendente</Text>
  }
})

import TitrationTimeline from '@treatments/components/TitrationTimeline'

describe('TitrationTimeline — confirmar etapa recarrega a escada (052 Slice C)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('🔴 recarrega a escada DEPOIS de confirmar — senão o banner sobrevive à própria ação', async () => {
    const ordem: string[] = []
    const onStartPendingStep = jest.fn(async () => { ordem.push('confirmou') })
    mockRefresh.mockImplementation(async () => { ordem.push('recarregou') })

    render(
      <TitrationTimeline protocolId="proto-1" onStartPendingStep={onStartPendingStep} />
    )

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())

    expect(onStartPendingStep).toHaveBeenCalledWith('step-pendente')
    // A ordem É a asserção: recarregar ANTES da RPC responder releria a escada velha.
    expect(ordem).toEqual(['confirmou', 'recarregou'])
  })
})
