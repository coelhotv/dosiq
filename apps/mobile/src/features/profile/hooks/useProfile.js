import { useState, useEffect, useCallback, useMemo } from 'react'
import { calculateAge, getInitials } from '@dosiq/core'
import {
  getCurrentUser,
  getUserSettings,
  getProfile,
  generateTelegramToken as generateTokenService,
} from '../services/profileService'

/**
 * Hook para gerir o estado do perfil e configurações no mobile (H5.6 + Fase 4).
 *
 * Expõe, além de user/settings (notificações), os dados de perfil
 * (display_name, birth_date, city, state, phone, complexity_override) e
 * derivados de exibição (displayName, initials, age, location).
 */
export function useProfile() {
  const [state, setState] = useState({
    user: null,
    settings: null,
    profile: null,
    loading: true,
    error: null,
  })

  const loadProfile = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const [userRes, settingsRes, profileRes] = await Promise.all([
        getCurrentUser(),
        getUserSettings(),
        getProfile()
      ])

      if (userRes.error) throw new Error(userRes.error)
      if (settingsRes.error) throw new Error(settingsRes.error)
      if (profileRes.error) throw new Error(profileRes.error)

      setState({
        user: userRes.data,
        settings: settingsRes.data,
        profile: profileRes.data,
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

  // Derivados de exibição (Hub/Edit). Fallback de nome: display_name → email.
  const displayName = useMemo(
    () => state.profile?.display_name || state.user?.email || 'Paciente',
    [state.profile, state.user],
  )
  const initials = useMemo(() => getInitials(displayName), [displayName])
  const age = useMemo(() => calculateAge(state.profile?.birth_date), [state.profile])
  const location = useMemo(() => {
    const parts = [state.profile?.city, state.profile?.state].filter(Boolean)
    return parts.join(', ') || null
  }, [state.profile])
  const hasProfile = useMemo(
    () => Boolean(state.profile?.display_name),
    [state.profile],
  )

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
    displayName,
    initials,
    age,
    location,
    hasProfile,
    refresh: loadProfile,
    generateToken
  }
}
