// Mock manual do @notifee/react-native para testes (Spec 001).
// O pacote nativo não roda em jest; expõe a mesma superfície usada por alarmService.

const notifee = {
  createChannel: jest.fn(() => Promise.resolve('dose-alarm')),
  setNotificationCategories: jest.fn(() => Promise.resolve()),
  createTriggerNotification: jest.fn(() => Promise.resolve('notif-id')),
  displayNotification: jest.fn(() => Promise.resolve('notif-id')),
  cancelTriggerNotification: jest.fn(() => Promise.resolve()),
  cancelTriggerNotifications: jest.fn(() => Promise.resolve()),
  cancelNotification: jest.fn(() => Promise.resolve()),
  onForegroundEvent: jest.fn(() => () => {}),
  onBackgroundEvent: jest.fn(),
  requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  getDisplayedNotifications: jest.fn(() => Promise.resolve([])),
}

const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2 }
const AndroidVisibility = { PUBLIC: 1, PRIVATE: 0, SECRET: -1 }
const AndroidCategory = { ALARM: 'alarm' }
const TriggerType = { TIMESTAMP: 0, INTERVAL: 1 }
const EventType = { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 }
const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 }

module.exports = {
  __esModule: true,
  default: notifee,
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  TriggerType,
  EventType,
  AuthorizationStatus,
}
