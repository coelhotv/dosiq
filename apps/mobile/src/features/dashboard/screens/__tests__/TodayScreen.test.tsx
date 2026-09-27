import { render, act } from '@testing-library/react-native';
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
      await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
      expect(getByTestId('bulk-dose-modal').props.entryPoint).toBe('reminder')
    })

    it('deeplink dose-individual → reminder; depois, aberta pelo card → entryPoint zerado', async () => {
      withProtocol()
      const { getByTestId, getAllByTestId } = render(
        <TodayScreen route={{ params: { screen: 'dose-individual', protocolId: 'p1', at: '08:00' } } as any} navigation={nav} />
      )
      await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
      expect(getByTestId('dose-modal').props.entryPoint).toBe('reminder')
      act(() => { getAllByTestId('dose-card')[0].props.onRegister({ id: 'p1', medicine_id: 'm1' }, '08:00') })
      expect(getByTestId('dose-modal').props.entryPoint).toBeNull()
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
});
