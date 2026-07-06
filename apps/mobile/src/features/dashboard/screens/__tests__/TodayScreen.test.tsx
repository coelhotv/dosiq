import { render } from '@testing-library/react-native';
import TodayScreen from '../TodayScreen';
import { useTodayData } from '@dashboard/hooks/useTodayData';

// Mock do hook de dados
jest.mock('@dashboard/hooks/useTodayData');

// Mock react-navigation — TodayScreen usa useFocusEffect (refresh on focus, Fase 4)
// que exige um NavigationContainer; sem isto o render lança fora do container.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => {},
}));

// Mock do lucide-react-native
jest.mock('lucide-react-native', () => ({
  Pill: 'Pill',
  Plus: 'Plus',
}));

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
