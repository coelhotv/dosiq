import { useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { calculateAge, getInitials } from '@dosiq/core'
import { describeError } from '@shared/utils/networkError'
import {
  getCurrentUser,
  getUserSettings,
  getProfile,
  updateTimezone as updateTimezoneService,
  hasFuturePendingDoses as hasFuturePendingDosesService,
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

      // ADR-049 — fuso é definido manualmente pelo usuário no settings (fonte de verdade).
      // NÃO auto-sobrescrever pelo fuso do device no launch: isso clobberava a escolha
      // manual (device do emulador = SP sempre, revertia Manaus→SP a cada load).
      // Auto-detect de viagem exige flag tz_source (auto|manual) — fora de escopo F1.2.

      setState({
        user: userRes.data,
        settings: settingsRes.data,
        profile: profileRes.data,
        loading: false,
        error: null
      })
    } catch (err) {
      if (__DEV__) console.error('Erro no useProfile loadProfile:', err)
      // `err.message` cru chegava à tela: em modo avião isso é "TypeError: Network request
      // failed", em inglês (achado no smoke 055). A tela do Perfil renderiza inteira sem
      // rede — só o e-mail falta —, então a mensagem é informativa, não bloqueante.
      setState(prev => ({
        ...prev,
        loading: false,
        error: describeError(err)
      }))
    }
  }, [])

  /**
   * Atualizar fuso horário manualmente (seletor em SettingsScreen — ADR-049).
   * Persiste no banco e actualiza o estado local.
   */
  const updateTimezone = useCallback(async (tz, options = {}) => {
    // F4.3f.2: options.regen=true ("Me mudei") re-ancora as doses futuras no fuso novo.
    const res = await updateTimezoneService(tz, options)
    if (res.success) {
      setState(prev => ({
        ...prev,
        settings: prev.settings ? { ...prev.settings, timezone: tz } : null
      }))
      // F4.3f.0: ajuste manual do fuso dispensa o nudge do Perfil (TzNudgeCard)
      // — não reaparece após o usuário acertar o tz.
      AsyncStorage.setItem('dosiq_tz_nudge_dismissed', '1').catch(() => {})
    }
    return res
  }, [])

  /**
   * F4.3f.2: há dose futura pendente? Decide se o prompt de intenção deve aparecer
   * na troca de fuso (sem dose futura → persiste direto).
   */
  const checkFuturePendingDoses = useCallback(() => hasFuturePendingDosesService(), [])

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
    generateToken,
    updateTimezone,
    checkFuturePendingDoses,
  }
}
