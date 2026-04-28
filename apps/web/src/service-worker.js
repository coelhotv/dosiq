/* global clients */
import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Configurações do Workbox via vite-plugin-pwa (isso será substituído na build)
precacheAndRoute(self.__WB_MANIFEST || [])

// Força o Service Worker a assumir o controle imadiato sem esperar reload
self.skipWaiting()
clientsClaim()

// Ouvinte para eventos de notificação via Push API
self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  try {
    const data = event.data.json()
    const options = {
      body: data.body || 'Você tem uma nova mensagem.',
      icon: data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/'
      }
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Dosiq', options)
    )
  } catch (error) {
    console.error('[SW] Erro ao parsear payload do Web Push:', error)
  }
})

// Tratar evento de click na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Resolve a URL alvo (garante que seja absoluta)
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Tenta focar em uma janela já aberta com a mesma URL (ou similar)
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      
      // Se não encontrou, tenta focar em qualquer janela do app e navegar
      if (windowClients.length > 0) {
        const firstClient = windowClients[0]
        if ('navigate' in firstClient) {
          firstClient.navigate(targetUrl)
          return firstClient.focus()
        }
      }

      // Caso contrário, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
