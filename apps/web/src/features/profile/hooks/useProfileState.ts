/**
 * useProfileState — Hook de lógica para a view de perfil.
 */
import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { createProfileRepository } from '@dosiq/core'
import { parseLocalDate, getSaoPauloTime } from '@utils/dateUtils'
import { validateUserProfile } from '@schemas/userProfileSchema'
import { emergencyCardService } from '@features/emergency/services/emergencyCardService'
import QRCode from 'qrcode'

// Repositório canônico de perfil (@dosiq/core) — fonte única web↔mobile.
const profileRepo = createProfileRepository({ client: supabase, getUserId })

// Helper to calculate age without blocking compiler optimization
function calculateAge(birthDate) {
  if (!birthDate) return null
  try {
    const birth = parseLocalDate(birthDate)
    const today = getSaoPauloTime()
    let years = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--
    return years >= 0 ? years : null
  } catch { return null }
}

/**
 * Sincroniza display_name do metadata para o perfil se ausente (via repo).
 */
async function syncDisplayName(user, settings) {
  if (settings && !settings.display_name && user.user_metadata?.name) {
    const updated = await profileRepo.updateProfile({ ...settings, display_name: user.user_metadata.name })
    return updated
  }
  return settings
}

/**
 * Carrega e sincroniza o cartão de emergência do usuário.
 * source === 'local' indica que o cartão veio do localStorage (ainda não
 * persistido no DB) — equivale ao antigo gate `!settings.emergency_card`.
 */
async function loadAndSyncEmergencyCard() {
  const cardResult = await emergencyCardService.load()
  const cardData = cardResult.success ? cardResult.data : null
  if (cardData && cardResult.source === 'local') {
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

  const displayName = useMemo(() => settings?.display_name || user?.user_metadata?.name || user?.email || 'Paciente', [settings, user])
  const initials = useMemo(() => displayName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''), [displayName])
  const age = useMemo(() => calculateAge(settings?.birth_date), [settings?.birth_date])
  const location = useMemo(() => {
    const parts = [settings?.city, settings?.state].filter(Boolean)
    return parts.join(', ') || null
  }, [settings?.city, settings?.state])

  const showFeedback = useCallback((msg) => {
    setMessage(msg); setTimeout(() => setMessage(null), 3000);
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const settingsData = await profileRepo.getProfile()
      const settings = await syncDisplayName(user, settingsData)
      const cardData = await loadAndSyncEmergencyCard()

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

  useEffect(() => {
    startTransition(() => {
      loadProfile()
    })
  }, [loadProfile])

  useEffect(() => {
    if (!emergencyCard) {
      startTransition(() => {
        setQrMiniatureUrl(null)
      })
      return
    }
    const generateQR = async () => {
      try {
        const payload = { v: '1', n: displayName, bt: emergencyCard.blood_type || '', a: emergencyCard.allergies?.join(', ') || '' }
        const qrString = btoa(encodeURIComponent(JSON.stringify(payload)).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16))))
        const url = await QRCode.toDataURL(qrString, { width: 100, margin: 1, errorCorrectionLevel: 'L' })
        startTransition(() => {
            setQrMiniatureUrl(url)
        })
      } catch {
        startTransition(() => {
            setQrMiniatureUrl(null)
        })
      }
    }
    generateQR()
  }, [emergencyCard, displayName])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const validation = validateUserProfile(profileForm)
    if (!validation.success) { setError(validation.errors[0]?.message); return; }
    setIsSaving(true); setError(null)
    try {
      const updated = await profileRepo.updateProfile(profileForm)
      setSettings(prev => ({ ...prev, ...updated }))
      setIsEditingProfile(false); showFeedback('Perfil atualizado!')
    } catch (err) { setError('Erro ao salvar: ' + err.message) }
    finally { setIsSaving(false) }
  }

  return {
    user, settings, emergencyCard, isLoading, error, qrMiniatureUrl, isEditingProfile, setIsEditingProfile,
    profileForm, setProfileForm, isSaving, message, displayName, initials, age, location, handleSaveProfile,
  }
}
