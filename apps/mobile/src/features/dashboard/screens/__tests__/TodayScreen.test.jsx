import { render } from '@testing-library/react-native';
import TodayScreen from '../TodayScreen';
import { useTodayData } from '@dashboard/hooks/useTodayData';

// Mock do hook de dados
jest.mock('@dashboard/hooks/useTodayData');

// Mock do lucide-react-native
jest.mock('lucide-react-native', () => ({
  Pill: 'Pill',
}));

// Redefinir View localmente para uso nos mocks (hoisted)
const mockView = require('react-native').View;

// Mock dos componentes como host components strings com testID
jest.mock('../../../../shared/components/ui/ScreenContainer', () => (props) => <mockView {...props} />);
jest.mock('../../../../shared/components/states/LoadingState', () => (props) => <mockView testID="loading-state" {...props} />);
jest.mock('../../../../shared/components/states/ErrorState', () => (props) => <mockView testID="error-state" {...props} />);
jest.mock('../../../../shared/components/states/EmptyState', () => (props) => <mockView testID="empty-state" {...props} />);
jest.mock('../../../dose/components/DoseRegisterModal', () => (props) => <mockView testID="dose-modal" {...props} />);
jest.mock('../../components/AdherenceDayCard', () => (props) => <mockView testID="adherence-card" {...props} />);
jest.mock('../../components/TimeBlockSeparator', () => (props) => <mockView testID="time-separator" {...props} />);
jest.mock('../../components/DoseTimelineCard', () => (props) => <mockView testID="dose-card" {...props} />);
jest.mock('../../components/HeroDoseCard', () => (props) => <mockView testID="hero-card" {...props} />);
jest.mock('../../components/StockAlertInline', () => (props) => <mockView testID="stock-alerts" {...props} />);
jest.mock('../../../../shared/components/feedback/StaleBanner', () => (props) => <mockView testID="stale-banner" {...props} />);

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
    useTodayData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });

    const { getByTestId } = render(<TodayScreen />);
    expect(getByTestId('loading-state')).toBeTruthy();
  });

  it('renders summary and doses when data is present', () => {
    useTodayData.mockReturnValue({
      data: {
        ...baseMockData,
        protocols: [{ id: '1', name: 'Protocol A', medicine_id: 'm1' }],
        medicines: { 'm1': { name: 'Med A' } },
        timeline: [{ id: 'd1', scheduledTime: '08:00', timelineStatus: 'PROXIMA' }]
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    const { getByTestId, queryByTestId } = render(<TodayScreen />);
    
    expect(queryByTestId('loading-state')).toBeNull();
    expect(getByTestId('adherence-card')).toBeTruthy();
    expect(getByTestId('hero-card')).toBeTruthy();
  });

  it('renders error state when error is present', () => {
    useTodayData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed to fetch'),
      refresh: mockRefresh,
    });

    const { getByTestId } = render(<TodayScreen />);
    expect(getByTestId('error-state')).toBeTruthy();
  });

  it('renders empty state when there are no protocols', () => {
    useTodayData.mockReturnValue({
      data: { ...baseMockData, protocols: [] },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    const { getByTestId } = render(<TodayScreen />);
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('renders stale banner when data is stale', () => {
    useTodayData.mockReturnValue({
      data: { ...baseMockData, protocols: [{ id: '1' }] },
      loading: false,
      error: null,
      stale: true,
      refresh: mockRefresh,
    });

    const { getByTestId } = render(<TodayScreen />);
    expect(getByTestId('stale-banner')).toBeTruthy();
  });
});
