/**
 * useProfileState — Hook de lógica para a view de perfil.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@shared/utils/supabase'
import { parseLocalDate, getNow, getSaoPauloTime } from '@utils/dateUtils'
import { validateUserProfile } from '@schemas/userProfileSchema'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import QRCode from 'qrcode'

/**
 * Sincroniza display_name do metadata para user_settings se ausente.
 */
async function syncDisplayName(user, settings) {
  if (settings && !settings.display_name && user.user_metadata?.name) {
    await supabase
      .from('user_settings')
      .update({ display_name: user.user_metadata.name, updated_at: getNow().toISOString() })
      .eq('user_id', user.id)
    return { ...settings, display_name: user.user_metadata.name }
  }
  return settings
}

/**
 * Carrega e sincroniza o cartão de emergência do usuário.
 */
async function loadAndSyncEmergencyCard(settings) {
  const cardResult = await emergencyCardService.load()
  const cardData = cardResult.success ? cardResult.data : null
  if (cardData && cardResult.source === 'local' && settings && !settings.emergency_card) {
    emergencyCardService.save(cardData)
  }
  return cardData
}

export function useProfileState() {
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [emergencyCard, setEmergencyCard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [qrMiniatureUrl, setQrMiniatureUrl] = useState(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ display_name: '', birth_date: '', city: '', state: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const showFeedback = useCallback((msg) => {
    setMessage(msg); setTimeout(() => setMessage(null), 3000);
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: settingsData } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      const settings = await syncDisplayName(user, settingsData ?? {})
      const cardData = await loadAndSyncEmergencyCard(settings)

      setUser(user)
      setSettings(settings)
      setEmergencyCard(cardData)
      setProfileForm({
        display_name: settings?.display_name || user.user_metadata?.name || '',
        birth_date: settings?.birth_date || '',
        city: settings?.city || '',
        state: settings?.state || '',
      })
    } catch (err) {
      setError('Erro ao carregar perfil: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  const displayName = useMemo(() => settings?.display_name || user?.user_metadata?.name || user?.email || 'Paciente', [settings, user])
  const initials = useMemo(() => displayName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''), [displayName])
  
  const age = useMemo(() => {
    if (!settings?.birth_date) return null
    try {
      const birth = parseLocalDate(settings.birth_date); const today = getSaoPauloTime()
      let years = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--
      return years >= 0 ? years : null
    } catch { return null }
  }, [settings?.birth_date])

  const location = useMemo(() => [settings?.city, settings?.state].filter(Boolean).join(', ') || null, [settings])

  useEffect(() => {
    if (!emergencyCard) { setQrMiniatureUrl(null); return; }
    const generateQR = async () => {
      try {
        const payload = { v: '1', n: displayName, bt: emergencyCard.blood_type || '', a: emergencyCard.allergies?.join(', ') || '' }
        const qrString = btoa(encodeURIComponent(JSON.stringify(payload)).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16))))
        const url = await QRCode.toDataURL(qrString, { width: 100, margin: 1, errorCorrectionLevel: 'L' })
        setQrMiniatureUrl(url)
      } catch { setQrMiniatureUrl(null) }
    }
    generateQR()
  }, [emergencyCard, displayName])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const validation = validateUserProfile(profileForm)
    if (!validation.success) { setError(validation.errors[0]?.message); return; }
    setIsSaving(true); setError(null)
    try {
      await supabase.from('user_settings').upsert({ user_id: user.id, ...validation.data, updated_at: getNow().toISOString() }, { onConflict: 'user_id' })
      setSettings(prev => ({ ...prev, ...validation.data }))
      setIsEditingProfile(false); showFeedback('Perfil atualizado!')
    } catch (err) { setError('Erro ao salvar: ' + err.message) }
    finally { setIsSaving(false) }
  }

  return {
    user, settings, emergencyCard, isLoading, error, qrMiniatureUrl, isEditingProfile, setIsEditingProfile,
    profileForm, setProfileForm, isSaving, message, displayName, initials, age, location, handleSaveProfile,
  }
}
