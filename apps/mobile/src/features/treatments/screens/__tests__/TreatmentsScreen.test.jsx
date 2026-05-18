import React from 'react';
import { render } from '@testing-library/react-native';
import TreatmentsScreen from '../TreatmentsScreen';
import { useTreatments } from '@features/treatments/hooks/useTreatments';

jest.mock('@features/treatments/hooks/useTreatments');
jest.mock('@shared/components/ui/ScreenContainer', () => ({ children }) => <>{children}</>);
jest.mock('@dashboard/components/AdherenceRing', () => 'AdherenceRing');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => {},
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('TreatmentsScreen', () => {
  // Helper: shape Fase 2.5 do useTreatments (activeTab + counts + grupos + listas per-tab)
  const mockUseTreatments = (overrides = {}) => ({
    loading: false,
    error: null,
    stale: false,
    refresh: jest.fn(),
    groups: [],
    data: [],
    activeTab: 'ativos',
    setActiveTab: jest.fn(),
    counts: { ativos: 0, pausados: 0, finalizados: 0 },
    ativos: [],
    pausados: [],
    finalizados: [],
    currentItems: [],
    ...overrides,
  })

  it('renders loading state', () => {
    useTreatments.mockReturnValue(mockUseTreatments({ loading: true, groups: null, data: null }));
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText(/Carregando seus tratamentos/i)).toBeTruthy();
  });

  it('renders list of treatments when data exists', () => {
    const protocol = { id: '1', name: 'Tratamento A', active: true, medicine_id: 'm1', tabStatus: 'ativo' }
    useTreatments.mockReturnValue(mockUseTreatments({
      groups: [{ id: 'g1', title: 'Geral', protocols: [protocol] }],
      ativos: [protocol],
      counts: { ativos: 1, pausados: 0, finalizados: 0 },
      currentItems: [protocol],
    }));
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText('Tratamento A')).toBeTruthy();
  });

  it('renders empty state when no treatments', () => {
    useTreatments.mockReturnValue(mockUseTreatments({ groups: [], data: [] }));
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText(/Comece seu primeiro tratamento/i)).toBeTruthy();
  });
});
