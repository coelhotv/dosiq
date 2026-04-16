// import '@testing-library/react-native/extend-expect';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock environment variables for config validation
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'dummy-key';

// Mocks para bibliotecas de ícones e SVG
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  Rect: 'Rect',
  G: 'G',
  Polyline: 'Polyline',
}));

jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  Clock: 'Clock',
  AlertCircle: 'AlertCircle',
  ChevronRight: 'ChevronRight',
  Info: 'Info',
}));
