// Wrapper seguro para Firebase Analytics — nunca quebra o fluxo do usuário
// CON-021: logEvent nunca lança exceção
import analytics from '@react-native-firebase/analytics'

export async function logEvent(eventName, params = {}) {
  try {
    await analytics().logEvent(eventName, params)
  } catch (error) {
    // Analytics nunca deve quebrar o fluxo do usuário — falha silenciosa
    if (__DEV__) console.warn('[Analytics] logEvent error:', error.message)
  }
}

export async function setUserId(userId) {
  try {
    // R-042: setUserId apenas com UUID interno — nunca PII
    await analytics().setUserId(userId)
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserId error:', error.message)
  }
}

export async function setUserProperty(name, value) {
  try {
    await analytics().setUserProperty(name, String(value))
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserProperty error:', error.message)
  }
}

export async function logScreenView(screenName, screenClass = screenName) {
  try {
    await analytics().logScreenView({ screen_name: screenName, screen_class: screenClass })
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logScreenView error:', error.message)
  }
}
