import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LandingScreen from '../LandingScreen';
import { ROUTES } from '../../navigation/routes';
import { Alert } from 'react-native';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
};

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, edges }) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const Svg = ({ children }) => <React.Fragment>{children}</React.Fragment>;
  const Circle = () => <React.Fragment />;
  return {
    __esModule: true,
    default: Svg,
    Circle: Circle,
    Svg: Svg
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: () => <React.Fragment />,
  };
});

// Mock Lucide — Proxy retorna Fragment para qualquer ícone (migração T1.11)
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return new Proxy({}, { get: () => () => <React.Fragment /> });
});

// Mock AdherenceRing
jest.mock('@features/dashboard/components/AdherenceRing', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ score }) => <Text>{score}%</Text>;
});

describe('LandingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(<LandingScreen navigation={mockNavigation} />);
    
    expect(getByText('dosiq')).toBeTruthy();
    expect(getByText(/Nunca mais/)).toBeTruthy();
    expect(getByText('91%')).toBeTruthy();
    expect(getByText('40mg • 1 Comprimido')).toBeTruthy();
    expect(getByText('08:00')).toBeTruthy();
    expect(getByText('Criar conta')).toBeTruthy();
    expect(getByText('Já tenho conta')).toBeTruthy();
  });

  it('navigates to Login when "Já tenho conta" is pressed', () => {
    const { getByText } = render(<LandingScreen navigation={mockNavigation} />);
    
    fireEvent.press(getByText('Já tenho conta'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it('navigates to Signup when "Criar conta" is pressed', () => {
    const { getByText } = render(<LandingScreen navigation={mockNavigation} />);
    
    fireEvent.press(getByText('Criar conta'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(ROUTES.SIGNUP);
  });
});

// Spec 091 — AC-2.1: encerramento por sessão inválida mostra a mensagem UMA vez e apaga a marca.
describe('LandingScreen — sessão encerrada (spec 091)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require('@react-native-async-storage/async-storage')

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('marca presente ⇒ mostra "Sua sessão terminou. Entre de novo." e apaga a marca', async () => {
    AsyncStorage.getItem.mockImplementation(async (k) => (k === '@dosiq/session-ended-reason' ? 'invalid' : null))
    const { findByText } = render(<LandingScreen navigation={mockNavigation} />)
    expect(await findByText('Sua sessão terminou. Entre de novo.')).toBeTruthy()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@dosiq/session-ended-reason')
  })

  it('sem marca ⇒ nenhuma mensagem', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const { queryByText } = render(<LandingScreen navigation={mockNavigation} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(queryByText('Sua sessão terminou. Entre de novo.')).toBeNull()
  })
})
