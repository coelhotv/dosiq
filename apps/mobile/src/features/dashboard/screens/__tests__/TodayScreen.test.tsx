import { render, act, waitFor } from '@testing-library/react-native';
import TodayScreen from '../TodayScreen';
import { useTodayData } from '@dashboard/hooks/useTodayData';

// Mock do hook de dados
jest.mock('@dashboard/hooks/useTodayData');

// Mock react-navigation — TodayScreen usa useFocusEffect (refresh on focus, Fase 4)
// que exige um NavigationContainer; sem isto o render lança fora do container.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => {},
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));

// Mock do lucide-react-native
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

// Redefinir View localmente para uso nos mocks (hoisted)
const MockView = require('react-native').View;

// Mock dos componentes como host components strings com testID
jest.mock('../../../../shared/components/ui/ScreenContainer', () => (props) => <MockView {...props} />);
jest.mock('../../../../shared/components/states/LoadingState', () => (props) => <MockView testID="loading-state" {...props} />);
jest.mock('../../../../shared/components/states/ErrorState', () => (props) => <MockView testID="error-state" {...props} />);
jest.mock('../../../../shared/components/states/EmptyState', () => (props) => <MockView testID="empty-state" {...props} />);
jest.mock('../../../dose/components/DoseRegisterModal', () => (props) => <MockView testID="dose-modal" {...props} />);
jest.mock('@dose/components/BulkDoseRegisterModal', () => (props) => <MockView testID="bulk-dose-modal" {...props} />);
jest.mock('../../components/AdherenceDayCard', () => (props) => <MockView testID="adherence-card" {...props} />);
jest.mock('../../components/TimeBlockSeparator', () => (props) => <MockView testID="time-separator" {...props} />);
jest.mock('../../components/DoseTimelineCard', () => (props) => <MockView testID="dose-card" {...props} />);
jest.mock('../../components/HeroDoseCard', () => (props) => <MockView testID="hero-card" {...props} />);
// 090 D-3: dose pendente de cold start lento — o Hoje a injeta nos próprios params ao montar.
let mockPending: unknown = null
jest.mock('@navigation/navigateToDose', () => ({
  subscribePendingDose: (fn: (p: unknown) => void) => {
    const p = mockPending; mockPending = null
    if (p) fn(p)
    return () => {}
  },
}))

// 090 D-5: o banner lê a aba Estoque. Controle de estoque LIGADO para o banner montar.
const mockStockRefresh = jest.fn()
let mockStockActive: unknown[] = []
jest.mock('@stock/hooks/useStock', () => ({
  useStock: () => ({ data: { active: mockStockActive }, refresh: mockStockRefresh }),
}))
jest.mock('@shared/hooks/useStockTracking', () => ({ useStockTracking: () => ({ enabled: true }) }))
jest.mock('../../components/StockAlertInline', () => (props) => <MockView testID="stock-alerts" {...props} />);
jest.mock('../../../../shared/components/feedback/StaleBanner', () => (props) => <MockView testID="stale-banner" {...props} />);

describe('TodayScreen', () => {
  const mockRefresh = jest.fn();
  const baseMockData = {
    protocols: [],
    medicines: {},
    stats: { expected: 0, taken: 0, score: 0 },
    zones: { late: [], now: [], upcoming: [], done: [] },
    stockAlerts: [],
    timeline: [],
    user: { name: 'Test User' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when loading is true and no data', () => {
    jest.mocked(useTodayData).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    } as any);

    const { getByTestId } = render(<TodayScreen route={{} as any} navigation={{} as any} />);
    expect(getByTestId('loading-state')).toBeTruthy();
  });

  it('renders summary and doses when data is present', () => {
    jest.mocked(useTodayData).mockReturnValue({
      data: {
        ...baseMockData,
        protocols: [{ id: '1', name: 'Protocol A', medicine_id: 'm1' }],
        medicines: { 'm1': { name: 'Med A' } },
        timeline: [{ id: 'd1', scheduledTime: '08:00', timelineStatus: 'PROXIMA' }]
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    } as any);

    const { getByTestId, queryByTestId } = render(<TodayScreen route={{} as any} navigation={{} as any} />);
    
    expect(queryByTestId('loading-state')).toBeNull();
    expect(getByTestId('adherence-card')).toBeTruthy();
    expect(getByTestId('hero-card')).toBeTruthy();
  });

  it('renders error state when error is present', () => {
    jest.mocked(useTodayData).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed to fetch'),
      refresh: mockRefresh,
    } as any);

    const { getByTestId } = render(<TodayScreen route={{} as any} navigation={{} as any} />);
    expect(getByTestId('error-state')).toBeTruthy();
  });

  it('renders empty state when there are no protocols', () => {
    jest.mocked(useTodayData).mockReturnValue({
      data: { ...baseMockData, protocols: [] },
      loading: false,
      error: null,
      refresh: mockRefresh,
    } as any);

    const { getByTestId } = render(<TodayScreen route={{} as any} navigation={{} as any} />);
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  // 065 AD-8: modal aberta por DEEPLINK (lembrete) → entryPoint 'reminder'; aberta pelo card → null.
  describe('entry_point reminder (065 AD-8)', () => {
    const withProtocol = () => jest.mocked(useTodayData).mockReturnValue({
      data: {
        ...baseMockData,
        protocols: [{ id: 'p1', medicine_id: 'm1' }],
        medicines: { m1: { name: 'Med' } },
        timeline: [{ id: 'd1', scheduledTime: '08:00', timelineStatus: 'PROXIMA' }],
      },
      loading: false, error: null, refresh: mockRefresh,
    } as any)
    const nav = { setParams: jest.fn() } as any

    it('deeplink bulk-plan → BulkDoseRegisterModal recebe entryPoint reminder', async () => {
      withProtocol()
      const { getByTestId } = render(
        <TodayScreen route={{ params: { screen: 'bulk-plan', planId: 'plan-1', at: '08:00' } } as any} navigation={nav} />
      )
      await waitFor(() => expect(getByTestId('bulk-dose-modal').props.entryPoint).toBe('reminder'))
    })

    it('deeplink dose-individual → reminder; depois, aberta pelo card → entryPoint zerado', async () => {
      withProtocol()
      const { getByTestId, getAllByTestId } = render(
        <TodayScreen route={{ params: { screen: 'dose-individual', protocolId: 'p1', at: '08:00' } } as any} navigation={nav} />
      )
      await waitFor(() => expect(getByTestId('dose-modal').props.entryPoint).toBe('reminder'))
      act(() => { getAllByTestId('dose-card')[0].props.onRegister({ id: 'p1', medicine_id: 'm1' }, '08:00') })
      expect(getByTestId('dose-modal').props.entryPoint).toBeNull()
    })

    // 090 C1.5 G-1 (PO-5): push tocado com o app fechado — o deeplink chega com os tratamentos
    // ainda carregando. Resolver cedo não acha o protocolo e o setParams apagava o pedido.
    // R-073: o efeito resolve num `setTimeout(0)` — fake timers drenam o timer de forma determinística
    // (a espera real de 10 ms dentro do `act` violava a R-070; achado RC6 #844).
    it('dose-individual no cold start: espera a carga e abre a modal quando o protocolo chega', () => {
      jest.useFakeTimers()
      try {
        const coldNav = { setParams: jest.fn() } as any
        jest.mocked(useTodayData).mockReturnValue({
          data: { ...baseMockData, protocols: [], medicines: {}, timeline: [] },
          loading: true, error: null, refresh: mockRefresh,
        } as any)
        const route = { params: { screen: 'dose-individual', protocolId: 'p1', at: '08:00' } } as any
        const { rerender, getByTestId } = render(<TodayScreen route={route} navigation={coldNav} />)
        act(() => { jest.runOnlyPendingTimers() })
        expect(coldNav.setParams).not.toHaveBeenCalled()

        withProtocol()
        rerender(<TodayScreen route={route} navigation={coldNav} />)
        act(() => { jest.runOnlyPendingTimers() })
        expect(getByTestId('dose-modal').props.entryPoint).toBe('reminder')
        expect(coldNav.setParams).toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    it('dose-individual de protocolo inexistente após a carga: limpa sem modal', async () => {
      const goneNav = { setParams: jest.fn() } as any
      withProtocol()
      const { queryByTestId } = render(
        <TodayScreen route={{ params: { screen: 'dose-individual', protocolId: 'apagado', at: '08:00' } } as any} navigation={goneNav} />
      )
      await waitFor(() => expect(goneNav.setParams).toHaveBeenCalled())
      expect(queryByTestId('dose-modal')?.props.entryPoint ?? null).toBeNull()
    })

    it('sem deeplink → nenhuma modal com reminder', () => {
      withProtocol()
      const { getByTestId } = render(<TodayScreen route={{} as any} navigation={nav} />)
      expect(getByTestId('bulk-dose-modal').props.entryPoint).toBeNull()
    })
  })

  it('renders stale banner when data is stale', () => {
    jest.mocked(useTodayData).mockReturnValue({
      data: { ...baseMockData, protocols: [{ id: '1' }] },
      loading: false,
      error: null,
      stale: true,
      refresh: mockRefresh,
    } as any);

    const { getByTestId } = render(<TodayScreen route={{} as any} navigation={{} as any} />);
    expect(getByTestId('stale-banner')).toBeTruthy();
  });

  // 090 D-5 (smoke 28/09): registrar dose recarrega o Hoje (novo capturedAt); o banner tem de
  // reler o estoque, senão fica com os dias do 1º render.
  describe('banner de estoque (090 D-5)', () => {
    afterEach(() => {
      jest.clearAllMocks()
      jest.clearAllTimers()
      mockStockActive = []
    })

    const today = (capturedAt: string) => jest.mocked(useTodayData).mockReturnValue({
      data: { ...baseMockData, capturedAt }, loading: false, error: null, refresh: mockRefresh,
    } as any)

    it('alertas saem dos itens da aba Estoque (id + dias em inteiro)', () => {
      mockStockActive = [{ id: 'm1', name: 'Selozok', daysRemaining: 6.5 }, { id: 'm2', name: 'Farto', daysRemaining: 40 }]
      today('2026-09-28T22:00:00.000Z')
      const { getByTestId } = render(<TodayScreen route={{ params: {} } as any} navigation={{ setParams: jest.fn() } as any} />)
      expect(getByTestId('stock-alerts').props.alerts).toEqual([{ medicineId: 'm1', medicineName: 'Selozok', daysRemaining: 6 }])
    })

    it('nova carga do Hoje (ex.: dose registrada) relê o estoque; a 1ª montagem não', () => {
      today('2026-09-28T22:00:00.000Z')
      const nav = { setParams: jest.fn() } as any
      const { rerender } = render(<TodayScreen route={{ params: {} } as any} navigation={nav} />)
      expect(mockStockRefresh).not.toHaveBeenCalled()
      today('2026-09-28T22:20:30.000Z')
      rerender(<TodayScreen route={{ params: {} } as any} navigation={nav} />)
      expect(mockStockRefresh).toHaveBeenCalledWith(true)
    })
  })

  describe('dose entregue pelo canal (090 PO-5)', () => {
    afterEach(() => {
      jest.clearAllMocks()
      jest.clearAllTimers()
      mockPending = null
    })

    // Smoke 28/09 21:11 (cold start real): a dose era entregue e virava `setParams`, mas o navegador de
    // abas ainda sem estado DESCARTAVA o setParams — route.params seguia undefined, Hoje sem modal.
    // Aqui o setParams é um no-op (como no aparelho): a modal só abre se a dose não depender dele.
    it('cold start: dose entregue ao montar abre a modal mesmo com o setParams descartado', async () => {
      mockPending = { screen: 'dose-individual', protocolId: 'p1', at: '20:10' }
      jest.mocked(useTodayData).mockReturnValue({
        data: { ...baseMockData, protocols: [], medicines: {}, timeline: [] },
        loading: true, error: null, refresh: mockRefresh,
      } as any)
      const nav = { setParams: jest.fn() } as any
      const route = { params: {} } as any
      const { rerender, getByTestId } = render(<TodayScreen route={route} navigation={nav} />)
      jest.mocked(useTodayData).mockReturnValue({
        data: { ...baseMockData, protocols: [{ id: 'p1', medicine_id: 'm1' }], medicines: { m1: { name: 'Med' } }, timeline: [] },
        loading: false, error: null, refresh: mockRefresh,
      } as any)
      rerender(<TodayScreen route={route} navigation={nav} />)
      await waitFor(() => expect(getByTestId('dose-modal').props.entryPoint).toBe('reminder'))
    })

    it('sem dose no canal não mexe nos params', () => {
      mockPending = null
      jest.mocked(useTodayData).mockReturnValue({ data: baseMockData, loading: true, error: null, refresh: mockRefresh } as any)
      const nav = { setParams: jest.fn() } as any
      const { queryByTestId } = render(<TodayScreen route={{ params: {} } as any} navigation={nav} />)
      expect(nav.setParams).not.toHaveBeenCalled()
      expect(queryByTestId('dose-modal')?.props.entryPoint ?? null).toBeNull()
    })
  })
});
