import { supabase } from '@shared/utils/supabase'

export const webpushService = {
  async subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
            throw new Error('VITE_VAPID_PUBLIC_KEY não está definido')
        }
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        })
      }

      await this.registerDevice(subscription)
      return subscription
    } catch (error) {
      console.error('[webpushService] Falha ao inscrever:', error)
      throw error
    }
  },

  async registerDevice(subscription) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const pushToken = JSON.stringify(subscription)

    // Detecção simplificada do tipo de app. Como Web Push no Dosiq foca no PWA, usaremos 'pwa'
    // E o provider é 'webpush'
    const payload = {
      pushToken,
      provider: 'webpush',
      appKind: 'pwa',
      platform: 'web',
      deviceName: navigator.userAgent
    }

    const response = await fetch('/api/register-webpush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
        throw new Error('Falha ao registrar device no backend')
    }
  }
}

// Utilitário para converter a chave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
