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

// Mock Lucide
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return {
    Sun: () => <React.Fragment />,
  };
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
    expect(getByText(/Sua saúde sob/)).toBeTruthy();
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
