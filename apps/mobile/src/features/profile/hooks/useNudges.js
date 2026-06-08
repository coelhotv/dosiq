import { useState, useEffect, useCallback } from 'react'
import { Platform, Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import {
  buildNudgeList,
  TZ_RECONCILE_NUDGE,
  TZ_NUDGE_LEGACY_KEY,
  dismissKey,
} from '@dosiq/core'
import { ROUTES } from '@navigation/routes'

const APP_VERSION = '0.15.0'
const CURRENT_PLATFORM = Platform.OS === 'android' ? 'android' : 'ios'

/**
 * Migra chave de dismiss legada do TzNudgeCard para o novo formato.
 * Executa uma única vez por instalação.
 */
async function migrateLegacyDismiss() {
  try {
    const legacy = await AsyncStorage.getItem(TZ_NUDGE_LEGACY_KEY)
    if (legacy === '1') {
      const newKey = dismissKey(TZ_RECONCILE_NUDGE)
      await AsyncStorage.setItem(newKey, '1')
      // Remove chave legada para não repetir a migração
      await AsyncStorage.removeItem(TZ_NUDGE_LEGACY_KEY)
    }
  } catch {
    // Falha silenciosa — na pior hipótese o nudge reaparece uma vez
  }
}

/**
 * Carrega as chaves de dismiss salvas no AsyncStorage.
 */
async function loadDismissedKeys() {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const nudgeKeys = keys.filter((k) => /^[\w-]+:\d+$/.test(k))
    const pairs = await AsyncStorage.multiGet(nudgeKeys)
    const dismissed = new Set()
    for (const [key, value] of pairs) {
      if (value === '1') dismissed.add(key)
    }
    return dismissed
  } catch {
    return new Set()
  }
}

/**
 * Hook principal de nudges para mobile.
 *
 * @param {'dashboard'|'profile'|'any'} targetView  view onde os nudges serão exibidos
 * @returns {{ nudge, dismiss, handleAction }}
 *   nudge: nudge de maior prioridade para exibir (ou null)
 *   dismiss: fn para dispensar o nudge atual
 *   handleAction: fn para executar a ação do nudge
 */
export function useNudges(targetView) {
  const navigation = useNavigation()
  const [nudge, setNudge] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      // 1. Migrar chave legada TzNudgeCard → novo formato
      await migrateLegacyDismiss()

      // 2. Carregar chaves de dismiss salvas
      const savedDismissed = await loadDismissedKeys()

      // 3. Buscar nudges remotos do Supabase (apenas ativos, view compatível)
      let remoteNudges = []
      try {
        const { data } = await supabase
          .from('in_app_nudges')
          .select('*')
          .eq('is_active', true)
          .in('target_view', [targetView, 'any'])
          .order('priority', { ascending: false })

        remoteNudges = data ?? []
      } catch {
        // Falha de rede — continua com nudges locais
      }

      if (!active) return

      // 4. Calcular lista via buildNudgeList
      const localNudges = targetView === 'profile' ? [TZ_RECONCILE_NUDGE] : []

      const list = buildNudgeList(remoteNudges, localNudges, {
        platform: CURRENT_PLATFORM,
        appVersion: APP_VERSION,
        dismissed: savedDismissed,
      })

      setNudge(list[0] ?? null)
    }

    load()
    return () => { active = false }
  }, [targetView])

  const dismiss = useCallback(async (n) => {
    setNudge(null)
    const key = dismissKey(n)
    try {
      await AsyncStorage.setItem(key, '1')
    } catch {
      // Falha silenciosa
    }
  }, [])

  const handleAction = useCallback((n) => {
    if (n.action_type === 'navigate' && n.action_payload?.route) {
      navigation.navigate(n.action_payload.route)
    } else if (n.action_type === 'open_url' && n.action_payload?.url) {
      Linking.openURL(n.action_payload.url)
    }
  }, [navigation])

  return { nudge, dismiss, handleAction }
}
