import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser, getUserSettings, generateTelegramToken as generateTokenService } from '../services/profileService'

/**
 * Hook para gerir o estado do perfil e configurações no mobile (H5.6)
 */
export function useProfile() {
  const [state, setState] = useState({
    user: null,
    settings: null,
    loading: true,
    error: null,
  })

  const loadProfile = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const [userRes, settingsRes] = await Promise.all([
        getCurrentUser(),
        getUserSettings()
      ])

      if (userRes.error) throw new Error(userRes.error)
      if (settingsRes.error) throw new Error(settingsRes.error)

      setState({
        user: userRes.data,
        settings: settingsRes.data,
        loading: false,
        error: null
      })
    } catch (err) {
      if (__DEV__) console.error('Erro no useProfile loadProfile:', err)
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message
      }))
    }
  }, [])

  /**
   * Gerar novo token de vinculação Telegram
   */
  const generateToken = async () => {
    try {
      const { token, error } = await generateTokenService()
      if (error) throw new Error(error)
      
      // Atualiza estado local com o novo token para exibição imediata
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, verification_token: token }
      }))
      return token
    } catch (err) {
      if (__DEV__) console.error('Erro no useProfile generateToken:', err)
      throw err
    }
  }

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  return {
    ...state,
    refresh: loadProfile,
    generateToken
  }
}
