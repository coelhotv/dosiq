import { useSyncExternalStore } from 'react'
import './OfflineBanner.css'

/**
 * Inscreve nos eventos de rede do browser para useSyncExternalStore.
 * @param {Function} callback - Função chamada quando o estado de rede muda
 * @returns {Function} Função de cleanup para remover os listeners
 */
function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const getClientSnapshot = () => navigator.onLine
const getServerSnapshot = () => true // assume online no servidor (SSR-safe)

/**
 * Banner fixo exibido quando o usuário perde conexão com a internet.
 * Desaparece automaticamente ao reconectar.
 * Posicionado acima do BottomNav para não ser coberto.
 */
export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  if (isOnline) return null

  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      Sem conexão — exibindo dados salvos
    </div>
  )
}
