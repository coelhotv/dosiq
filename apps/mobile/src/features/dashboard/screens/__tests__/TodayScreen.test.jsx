import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import TodayScreen from '../TodayScreen';
import { useTodayData } from '@dashboard/hooks/useTodayData';

// Mock do hook de dados
jest.mock('@dashboard/hooks/useTodayData');

// Mock do lucide-react-native
jest.mock('lucide-react-native', () => ({
  Pill: 'Pill',
}));

// Mock dos componentes como views com testID
jest.mock('../../../../shared/components/ui/ScreenContainer', () => (props) => <View {...props} />);
jest.mock('../../../../shared/components/states/LoadingState', () => (props) => <View testID="loading-state" {...props} />);
jest.mock('../../../../shared/components/states/ErrorState', () => (props) => <View testID="error-state" {...props} />);
jest.mock('../../../../shared/components/states/EmptyState', () => (props) => <View testID="empty-state" {...props} />);
jest.mock('../../../dose/components/DoseRegisterModal', () => (props) => <View testID="dose-modal" {...props} />);
jest.mock('../components/AdherenceDayCard', () => (props) => <View testID="adherence-card" {...props} />);
jest.mock('../components/TimeBlockSeparator', () => (props) => <View testID="time-separator" {...props} />);
jest.mock('../components/DoseTimelineCard', () => (props) => <View testID="dose-card" {...props} />);
jest.mock('../components/HeroDoseCard', () => (props) => <View testID="hero-card" {...props} />);
jest.mock('../components/StockAlertInline', () => (props) => <View testID="stock-alerts" {...props} />);
jest.mock('../../../../shared/components/feedback/StaleBanner', () => (props) => <View testID="stale-banner" {...props} />);

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
});
