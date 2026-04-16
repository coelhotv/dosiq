import { useState, useEffect } from 'react'
import NetInfo from '@react-native-community/netinfo'

/**
 * Hook para monitorar o estado de conectividade global do dispositivo.
 * @returns {{ isOnline: boolean, isInternetReachable: boolean }}
 */
export function useOnlineStatus() {
  const [status, setStatus] = useState({
    isOnline: true, // Default otimista
    isInternetReachable: true,
  })

  useEffect(() => {
    // Inscreve para mudanças no estado da rede
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus({
        isOnline: !!state.isConnected,
        isInternetReachable: !!state.isInternetReachable,
      })
    })

    // Fetch inicial para garantir que temos o estado atual
    NetInfo.fetch().then((state) => {
      setStatus({
        isOnline: !!state.isConnected,
        isInternetReachable: !!state.isInternetReachable,
      })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return status
}
