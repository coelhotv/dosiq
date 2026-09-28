import { getNow } from '@dosiq/core'

// Desativa o device durante logout
// Falha silenciosa — logout deve ocorrer mesmo se desativação remota falhar

// Spec 091: `provider` explícito — o iOS registra também o token push-to-start do Live Activity
// (`apns_liveactivity`, spec 041), e a saída da conta precisa desativar os dois.
export async function unregisterNotificationDevice({ supabase, userId, token, provider = 'expo' }) {
  if (!supabase || !userId || !token) {
    return // falha silenciosa em params incompletos
  }

  try {
    await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: getNow().toISOString() })
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('push_token', token)
  } catch (error) {
    // falha silenciosa — logout local deve ocorrer de qualquer forma
    if (__DEV__) {
      console.warn('[unregisterNotificationDevice] Falha ao desativar device remotamente:', error.message)
    }
  }
}
