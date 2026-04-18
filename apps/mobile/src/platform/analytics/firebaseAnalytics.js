// Wrapper seguro para Firebase Analytics — nunca quebra o fluxo do usuário
// CON-021: logEvent nunca lança exceção
// Falha silenciosa quando módulos nativos não estão disponíveis (ex: Expo Go, dev client sem Firebase)
import analytics from '@react-native-firebase/analytics'

function getAnalytics() {
  try {
    return analytics()
  } catch {
    // Módulo nativo Firebase não disponível neste build (ex: Expo Go)
    return null
  }
}

export async function logEvent(eventName, params = {}) {
  try {
    const a = getAnalytics()
    if (!a) return
    await a.logEvent(eventName, params)
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logEvent error:', error.message)
  }
}

export async function setUserId(userId) {
  try {
    // R-042: setUserId apenas com UUID interno — nunca PII
    const a = getAnalytics()
    if (!a) return
    await a.setUserId(userId)
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserId error:', error.message)
  }
}

export async function setUserProperty(name, value) {
  try {
    const a = getAnalytics()
    if (!a) return
    await a.setUserProperty(name, String(value))
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserProperty error:', error.message)
  }
}

export async function logScreenView(screenName, screenClass = screenName) {
  try {
    const a = getAnalytics()
    if (!a) return
    await a.logScreenView({ screen_name: screenName, screen_class: screenClass })
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logScreenView error:', error.message)
  }
}
