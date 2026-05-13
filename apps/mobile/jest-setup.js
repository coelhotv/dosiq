import { NativeModules } from 'react-native'

// Fix para window.dispatchEvent e global events em ambiente de teste
const mockDispatchEvent = jest.fn();
if (typeof window !== 'undefined') {
  window.dispatchEvent = window.dispatchEvent || mockDispatchEvent;
}
global.window = global.window || {};
global.window.dispatchEvent = global.window.dispatchEvent || mockDispatchEvent;
global.dispatchEvent = global.dispatchEvent || mockDispatchEvent;

// Mock de módulos nativos do Firebase
NativeModules.RNFBAppModule = NativeModules.RNFBAppModule || {
  getAppConfig: jest.fn(() => ({})),
  initializeApp: jest.fn(() => Promise.resolve({})),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
NativeModules.RNFBAnalyticsModule = NativeModules.RNFBAnalyticsModule || {
  logEvent: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  setUserProperty: jest.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
};
NativeModules.RNFBNativeEventEmitter = NativeModules.RNFBNativeEventEmitter || {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

// Mock AppState - Ensuring it exists and has required methods
const RN = require('react-native');
if (RN.AppState) {
  RN.AppState.addEventListener = RN.AppState.addEventListener || jest.fn(() => ({ remove: jest.fn() }));
  RN.AppState.removeEventListener = RN.AppState.removeEventListener || jest.fn();
}

// Mocks de bibliotecas
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native')
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
    }),
    NavigationContainer: ({ children }) => children,
  }
})

jest.mock('@react-native-firebase/app', () => ({
  utils: jest.fn(),
}))

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(),
  setUserId: jest.fn(),
  setUserProperty: jest.fn(),
  logScreenView: jest.fn(),
}))

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
