// Hook automático para rastrear navegação
import { useEffect } from 'react'
import { logScreenView } from './firebaseAnalytics'

export function useScreenTracking(screenName, screenClass = screenName) {
  useEffect(() => {
    logScreenView(screenName, screenClass)
  }, [screenName, screenClass])
}
