import React from 'react';
import { render } from '@testing-library/react-native';
import TreatmentsScreen from '../TreatmentsScreen';
import { useTreatments as useTreatmentsImport } from '@features/treatments/hooks/useTreatments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useTreatments = useTreatmentsImport as any

jest.mock('@features/treatments/hooks/useTreatments');
jest.mock('@shared/components/ui/ScreenContainer', () => ({ children }) => <>{children}</>);
jest.mock('@dashboard/components/AdherenceRing', () => 'AdherenceRing');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => {},
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

// 090 D-8: densidade vem de `settings` (user_settings). Mockado para o teste escolher a fonte.
let mockProfileState: Record<string, unknown> = { profile: null, settings: null }
jest.mock('@profile/hooks/useProfile', () => ({
  useProfile: () => ({ ...mockProfileState, refresh: jest.fn() }),
}));

describe('TreatmentsScreen', () => {
  // Helper: shape Fase 2.5 do useTreatments (activeTab + counts + grupos + listas per-tab)
  const mockUseTreatments = (overrides = {}) => ({
    loading: false,
    hasLoaded: true,
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
    useTreatments.mockReturnValue(mockUseTreatments({ loading: true, hasLoaded: false, groups: null, data: null }));
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText(/Carregando tratamentos/i)).toBeTruthy();
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
    expect(getByText(/Nenhum tratamento cadastrado/i)).toBeTruthy();
  });

  // 090 D-8 (PO-10): com 5 tratamentos o adaptativo é "complexo" (> 3, agrupado por plano). A
  // densidade ESCOLHIDA mora em user_settings; ler de `profile` ignorava a escolha.
  describe('densidade escolhida (090 D-8)', () => {
    afterEach(() => {
      jest.clearAllMocks()
      jest.clearAllTimers()
      mockProfileState = { profile: null, settings: null }
    })

    const five = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, name: `Tratamento ${i}`, active: true, medicine_id: `m${i}`, tabStatus: 'ativo',
    }))
    const withFive = () => useTreatments.mockReturnValue(mockUseTreatments({
      groups: [{ id: 'g1', title: 'Plano Coração', protocols: five }],
      ativos: five,
      counts: { ativos: 5, pausados: 0, finalizados: 0 },
      currentItems: five,
    }))

    it('sem escolha → adaptativo (5 > 3 ⇒ agrupado)', () => {
      withFive()
      const { getByText } = render(<TreatmentsScreen />)
      expect(getByText('Plano Coração')).toBeTruthy()
    })

    it("settings.complexity_override = 'simple' → lista simples, sem agrupamento", () => {
      withFive()
      mockProfileState = { profile: { complexity_override: 'complex' }, settings: { complexity_override: 'simple' } }
      const { queryByText, getByText } = render(<TreatmentsScreen />)
      expect(queryByText('Plano Coração')).toBeNull()
      expect(getByText('Tratamento 0')).toBeTruthy()
    })
  })
});
