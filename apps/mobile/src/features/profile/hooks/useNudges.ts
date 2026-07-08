import { useState, useEffect, useCallback } from 'react'
import { Platform, Linking, InteractionManager } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { buildNudgeList, dismissKey } from '@dosiq/core'
import { ROUTES } from '@navigation/routes'
import { navigationRef } from '@navigation/navigationRef'
import Constants from 'expo-constants'

const APP_VERSION = Constants.expoConfig?.version || '0.15.0'
const CURRENT_PLATFORM = Platform.OS === 'android' ? 'android' : 'ios'

const cacheKey = (view) => `nudges_cache:${view}`

async function loadCachedNudges(view) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(view))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveCachedNudges(view, nudges) {
  try {
    await AsyncStorage.setItem(cacheKey(view), JSON.stringify(nudges))
  } catch {
    // Falha silenciosa — cache best-effort
  }
}

/**
 * Carrega as chaves de dismiss salvas no AsyncStorage apenas para os nudges recebidos.
 * Evita getAllKeys() que varre todo o storage independente do tamanho.
 */
async function loadDismissedKeys(keysToCheck: string[]): Promise<Set<string>> {
  if (!keysToCheck || keysToCheck.length === 0) return new Set()
  try {
    const pairs = await AsyncStorage.multiGet(keysToCheck)
    const dismissed = new Set<string>()
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
 * @returns {{ nudge, dismiss, handleAction, refresh }}
 *   nudge: nudge de maior prioridade para exibir (ou null)
 *   dismiss: fn para dispensar o nudge atual
 *   handleAction: fn para executar a ação do nudge
 *   refresh: fn para forçar novo fetch
 */
export function useNudges(targetView) {
  const navigation = useNavigation()
  const [nudge, setNudge] = useState(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refresh = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let active = true

    async function load() {
      // 1. Buscar nudges remotos do Supabase; fallback para cache offline
      let remoteNudges = []
      try {
        const { data } = await supabase
          .from('in_app_nudges')
          .select('*')
          .eq('is_active', true)
          .in('target_view', [targetView, 'any'])
          .order('priority', { ascending: false })

        remoteNudges = data ?? []
        await saveCachedNudges(targetView, remoteNudges)
      } catch {
        remoteNudges = await loadCachedNudges(targetView)
      }

      if (!active) return

      // 2. Carregar dismiss apenas para os nudges encontrados (evita getAllKeys)
      const keysToCheck = remoteNudges.map((n) => `${n.id}:${n.version}`)
      const savedDismissed = await loadDismissedKeys(keysToCheck)

      // 3. Calcular lista via buildNudgeList
      const list = buildNudgeList(remoteNudges, [], {
        platform: CURRENT_PLATFORM,
        appVersion: APP_VERSION,
        dismissed: savedDismissed,
      })

      setNudge(list[0] ?? null)
    }

    load()
    return () => { active = false }
  }, [targetView, fetchKey])

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
    if (n.action_type === 'navigate') {
      const { tab, screen, route } = n.action_payload ?? {}
      if (tab && screen) {
        // Dois passos via navigationRef (mesmo padrão do usePushNotifications):
        // 1. Muda para o tab (mostra a tela raiz do stack)
        // 2. Após animações, navega para a screen dentro do stack agora ativo
        // Necessário porque navigate(tab, { screen }) reutiliza estado existente
        // do stack e pode manter só [Settings] sem a raiz embaixo.
        (navigationRef.navigate as any)(tab)
        InteractionManager.runAfterInteractions(() => {
          (navigationRef.navigate as any)(screen)
        })
      } else if (route) {
        (navigation.navigate as any)(route)
      }
    } else if (n.action_type === 'open_url' && n.action_payload?.url) {
      const { url } = n.action_payload
      Linking.canOpenURL(url).then((supported) => {
        if (supported) return Linking.openURL(url)
        if (__DEV__) console.warn('[useNudges] URL não suportada:', url)
      }).catch((err) => {
        if (__DEV__) console.error('[useNudges] Erro ao abrir URL:', err)
      })
    }
  }, [navigation])

  return { nudge, dismiss, handleAction, refresh }
}
