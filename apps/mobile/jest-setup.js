// Fix para window.dispatchEvent e global events em ambiente de teste
const mockDispatchEvent = jest.fn();
if (typeof window !== 'undefined') {
  window.dispatchEvent = window.dispatchEvent || mockDispatchEvent;
}
global.window = global.window || {};
global.window.dispatchEvent = global.window.dispatchEvent || mockDispatchEvent;
global.dispatchEvent = global.dispatchEvent || mockDispatchEvent;

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
  multiRemove: jest.fn(() => Promise.resolve()),
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

// ADR-090: observabilidade = Sentry (crash) + PostHog (analytics). Firebase saiu.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
}))

jest.mock('posthog-react-native', () => {
  const client = {
    capture: jest.fn(),
    identify: jest.fn(),
    register: jest.fn(),
    screen: jest.fn(),
    reset: jest.fn(),
  }
  return {
    __esModule: true,
    default: jest.fn(() => client),
    PostHogProvider: ({ children }) => children,
    usePostHog: () => client,
  }
})

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

// Picker nativo de data/hora: sem mock, o módulo resolve `undefined` no ambiente de teste e
// QUALQUER componente que o renderize (TimeSchedulePicker → todo form de tratamento) morre com
// "Element type is invalid", apontando para o componente pai em vez do módulo faltante.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// Ícones viram host components nomeados (string), resolvidos SOB DEMANDA por Proxy.
//
// A lista fixa anterior (5 ícones) era uma armadilha: qualquer componente que usasse um sexto
// ícone quebrava no render com "Element type is invalid: ... got: undefined" — erro que não cita
// o ícone nem o mock, e que na prática desencorajava escrever teste de componente. O Proxy
// devolve o nome para QUALQUER ícone, então o mock deixa de ser uma lista a manter.
//
// 🔴 `__esModule: true` é OBRIGATÓRIO aqui, não decoração: com ele `false`, o interop do Babel
// COPIA as chaves próprias do módulo para montar o namespace do `import * as LucideIcons` — e um
// Proxy sobre `{}` não enumera nada, então o namespace chegava VAZIO e todo ícone virava
// `undefined`. Com `__esModule: true` o interop usa o objeto direto e o trap `get` funciona.
jest.mock('lucide-react-native', () => new Proxy({}, {
  get: (_target, prop) => {
    if (prop === '__esModule') return true;
    if (typeof prop !== 'string' || prop === 'default') return undefined;
    return prop;
  },
}));
