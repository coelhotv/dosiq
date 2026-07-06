// Wrapper seguro para Firebase Analytics — nunca quebra o fluxo do usuário
// CON-021: logEvent nunca lança exceção
// Falha silenciosa quando módulos nativos não estão disponíveis (ex: Expo Go, dev client sem Firebase)
import { 
  getAnalytics, 
  logEvent as firebaseLogEvent, 
  setUserId as firebaseSetUserId, 
  setUserProperty as firebaseSetUserProperty, 
  logScreenView as firebaseLogScreenView 
} from '@react-native-firebase/analytics'

function getAnalyticsInstance() {
  try {
    return getAnalytics()
  } catch {
    // Módulo nativo Firebase não disponível neste build (ex: Expo Go)
    return null
  }
}

export async function logEvent(eventName, params = {}) {
  try {
    const a = getAnalyticsInstance()
    if (!a) return
    await firebaseLogEvent(a, eventName, params)
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logEvent error:', error.message)
  }
}

export async function setUserId(userId) {
  try {
    // R-042: setUserId apenas com UUID interno — nunca PII
    const a = getAnalyticsInstance()
    if (!a) return
    await firebaseSetUserId(a, userId)
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserId error:', error.message)
  }
}

export async function setUserProperty(name, value) {
  try {
    const a = getAnalyticsInstance()
    if (!a) return
    await firebaseSetUserProperty(a, name, String(value))
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserProperty error:', error.message)
  }
}

export async function logScreenView(screenName, screenClass = screenName) {
  try {
    const a = getAnalyticsInstance()
    if (!a) return
    await firebaseLogScreenView(a, { screen_name: screenName, screen_class: screenClass })
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logScreenView error:', error.message)
  }
}
