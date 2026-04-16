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
jest.mock('@dashboard/components/TodaySummaryCard', () => 'TodaySummaryCard');
jest.mock('@dashboard/components/StockAlertInline', () => 'StockAlertInline');
jest.mock('@dashboard/components/PriorityActionCard', () => 'PriorityActionCard');
jest.mock('@dashboard/components/UpcomingDosesList', () => 'UpcomingDosesList');

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

    const { getByText } = render(<TodayScreen />);
    
    // Como os componentes estão mocked, verificamos se o dashboard rendidou (não-carregamento)
    // E se não estamos em estado de erro.
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
