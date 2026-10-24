/**
 * pwaRegistration.ts
 *
 * Registra o Service Worker e injeta o <link rel="manifest"> no DOM
 * exclusivamente para usuários autenticados (PO-110-7 / ADR-116).
 * Idempotente: executa no máximo 1 vez por ciclo de vida da janela.
 */

let isRegistered = false

/**
 * Injeta o manifesto estático no <head> se ainda não estiver presente.
 */
export function injectManifestLink(): void {
  if (typeof document === 'undefined') return
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/manifest.webmanifest'
    document.head.appendChild(link)
  }
}

/**
 * Dispara o registro do Service Worker e a injeção do manifesto.
 * Seguro para ser chamado múltiplas vezes (idempotente).
 */
export async function registerPwa(): Promise<void> {
  if (isRegistered) return
  isRegistered = true

  injectManifestLink()

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      // Dynamic import do virtual:pwa-register fornecido pelo vite-plugin-pwa
      // eslint-disable-next-line import-x/no-unresolved -- modulo virtual fornecido pelo vite-plugin-pwa
      const pwa = await import('virtual:pwa-register') as { registerSW?: (options?: { immediate?: boolean }) => void }
      if (typeof pwa.registerSW === 'function') {
        pwa.registerSW({ immediate: true })
      }
    } catch {
      // Fallback gracioso em ambientes onde o módulo virtual não está ativo
    }
  }
}

/**
 * Reset de estado para execução de testes unitários.
 */
export function _resetPwaRegistrationForTesting(): void {
  isRegistered = false
}
