// Desativa o device durante logout
// Falha silenciosa — logout deve ocorrer mesmo se desativação remota falhar

export async function unregisterNotificationDevice({ supabase, userId, token }) {
  if (!supabase || !userId || !token) {
    return // falha silenciosa em params incompletos
  }

  try {
    await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', 'expo')
      .eq('push_token', token)
  } catch (error) {
    // falha silenciosa — logout local deve ocorrer de qualquer forma
    if (__DEV__) {
      console.warn('[unregisterNotificationDevice] Falha ao desativar device remotamente:', error.message)
    }
  }
}
