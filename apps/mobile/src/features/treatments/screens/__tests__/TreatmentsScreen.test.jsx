import React from 'react';
import { render } from '@testing-library/react-native';
import TreatmentsScreen from '../TreatmentsScreen';
import { useTreatments } from '@features/treatments/hooks/useTreatments';

jest.mock('@features/treatments/hooks/useTreatments');
jest.mock('@shared/components/ui/ScreenContainer', () => ({ children }) => <>{children}</>);
jest.mock('@dashboard/components/AdherenceRing', () => 'AdherenceRing');

describe('TreatmentsScreen', () => {
  it('renders loading state', () => {
    useTreatments.mockReturnValue({ loading: true, data: null });
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText(/Carregando seus tratamentos/i)).toBeTruthy();
  });

  it('renders list of treatments when data exists', () => {
    useTreatments.mockReturnValue({
      loading: false,
      data: [
        { id: '1', name: 'Tratamento A', active: true, medicine_id: 'm1' }
      ]
    });
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText('Tratamento A')).toBeTruthy();
  });

  it('renders empty state when no treatments', () => {
    useTreatments.mockReturnValue({ loading: false, data: [] });
    const { getByText } = render(<TreatmentsScreen />);
    expect(getByText(/Você não possui protocolos/i)).toBeTruthy();
  });
});
