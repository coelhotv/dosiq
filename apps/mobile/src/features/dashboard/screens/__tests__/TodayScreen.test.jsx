import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TodayScreen from '../TodayScreen';
import { useTodayData } from '@dashboard/hooks/useTodayData';

// Mock do hook de dados
jest.mock('@dashboard/hooks/useTodayData');

// Mock dos componentes que podem causar problemas em testes unitários simples
jest.mock('@shared/components/ui/ScreenContainer', () => ({ children }) => <>{children}</>);
jest.mock('@features/dose/components/DoseRegisterModal', () => 'DoseRegisterModal');
jest.mock('@dashboard/components/AdherenceRing', () => 'AdherenceRing');
jest.mock('@dashboard/components/TodaySummaryCard', () => (props) => {
  const { View } = require('react-native');
  return <View testID="today-summary-card" />;
});
jest.mock('@dashboard/components/StockAlertInline', () => 'StockAlertInline');
jest.mock('@dashboard/components/PriorityActionCard', () => 'PriorityActionCard');
jest.mock('@dashboard/components/UpcomingDosesList', () => 'UpcomingDosesList');
jest.mock('@shared/components/feedback/StaleBanner', () => ({ isDaySegregated }) => {
  const { Text } = require('react-native');
  const msg = isDaySegregated
    ? 'Sem conexão. Mostrando agenda (logs de hoje não disponíveis).'
    : 'Sem conexão. Mostrando última sincronização disponível.';
  return <Text>{msg}</Text>;
});

describe('TodayScreen', () => {
  const mockRefresh = jest.fn();

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

    const { getByText } = render(<TodayScreen />);
    expect(getByText('A carregar o seu dia...')).toBeTruthy();
  });

  it('renders error state when there is an error', () => {
    useTodayData.mockReturnValue({
      data: null,
      loading: false,
      error: 'Erro de conexão',
      refresh: mockRefresh,
    });

    const { getByText } = render(<TodayScreen />);
    expect(getByText('Erro de conexão')).toBeTruthy();
  });

  it('renders empty state when there are no protocols', () => {
    useTodayData.mockReturnValue({
      data: { protocols: [], medicines: {}, stats: { expected: 0, taken: 0, score: 0 }, zones: { late: [], now: [], upcoming: [], done: [] }, stockAlerts: [] },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    const { getByText } = render(<TodayScreen />);
    expect(getByText(/Sem tratamentos activos/)).toBeTruthy();
  });

  it('renders summary and doses when data is present', () => {
    useTodayData.mockReturnValue({
      data: {
        protocols: [{ id: '1', name: 'Protocol A' }],
        medicines: { 'm1': { name: 'Med A' } },
        stats: { expected: 2, taken: 1, score: 50 },
        zones: { late: [], now: [], upcoming: [], done: [] },
        stockAlerts: []
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    const { getByTestId, queryByText } = render(<TodayScreen />);
    
    // Verificar que NÃO estamos em estado de loading nem erro
    expect(queryByText('A carregar o seu dia...')).toBeNull();
    expect(queryByText('Erro de conexão')).toBeNull();
    // TodaySummaryCard deve estar presente (verificado via testID do mock)
    expect(getByTestId('today-summary-card')).toBeTruthy();
    // refresh não deve ter sido invocado automaticamente
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('shows stale banner when data is stale (offline)', () => {
    useTodayData.mockReturnValue({
      data: { protocols: [], medicines: {}, stats: { expected: 0, taken: 0, score: 0 }, zones: { late: [], now: [], upcoming: [], done: [] }, stockAlerts: [] },
      loading: false,
      error: null,
      stale: true,
      refresh: mockRefresh,
    });

    const { getByText } = render(<TodayScreen />);
    // StaleBanner renderiza "Sem conexão"
    expect(getByText(/Sem conexão/i)).toBeTruthy();
  });
});
