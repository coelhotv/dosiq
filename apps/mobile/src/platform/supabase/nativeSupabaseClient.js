// nativeSupabaseClient.js — cliente Supabase para o app native
// R4-004: o singleton pode existir no app mobile, mas NUNCA em packages/*
// AppState listener garante refresh de token quando app volta ao foreground

import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import { nativePublicAppConfig } from '../config/nativePublicAppConfig'
import { secureStoreAuthStorage } from '../auth/secureStoreAuthStorage'

function createNativeSupabaseClient() {
  // Debug: confirmar URL e que URLSearchParams está patchado antes do createClient
  if (__DEV__) console.log('[supabase-init] URL:', nativePublicAppConfig.supabaseUrl)
  if (__DEV__) console.log('[supabase-init] URLSearchParams.set type:', typeof global.URLSearchParams?.prototype?.set)
  const supabase = createClient(
    nativePublicAppConfig.supabaseUrl,
    nativePublicAppConfig.supabaseAnonKey,
    {
      auth: {
        // Sessão persiste entre aberturas do app via SecureStore
        storage: secureStoreAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Universal Links desabilitados no native nesta fase (DL-005)
        detectSessionInUrl: false,
      },
    }
  )

  // Pausa/retoma refresh automático com ciclo de vida do app
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })

  return supabase
}

// Singleton mobile — exportado uma única vez
export const supabase = createNativeSupabaseClient()
