/**
 * createSupabaseDependencies — Factory para dependencias Supabase por plataforma
 *
 * Nao importa `createClient` diretamente — a implementacao e injetada pelo caller.
 * Isso garante que o pacote compartilhado nao acopla a nenhuma plataforma especifica.
 *
 * Web:    injetar createClient de @supabase/supabase-js
 * Mobile: injetar createClient de @supabase/supabase-js (com AsyncStorage nativo)
 * Tests:  injetar mock de createClient
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StorageAdapter } from '@dosiq/storage'

/**
 * Implementacao de createClient injetada pelo caller (evita acoplar o pacote
 * a uma versao especifica de @supabase/supabase-js).
 */
type CreateClientImpl = (
  url: string,
  anonKey: string,
  options: {
    auth: {
      storage: StorageAdapter
      persistSession: boolean
      autoRefreshToken: boolean
      detectSessionInUrl: boolean
    }
  }
) => SupabaseClient

export interface CreateSupabaseDependenciesOptions {
  url: string
  anonKey: string
  authStorage: StorageAdapter
  detectSessionInUrl?: boolean
  createClientImpl: CreateClientImpl
}

/**
 * Cria as dependencias Supabase para a plataforma atual.
 *
 * @param options
 * @param options.url - URL do projeto Supabase (https://...)
 * @param options.anonKey - Anon key publica do projeto
 * @param options.authStorage - Adapter de storage async para sessao de autenticacao
 * @param options.detectSessionInUrl - Detectar sessao na URL (apenas web)
 * @param options.createClientImpl - Implementacao de createClient (injetada)
 * @returns { supabase: SupabaseClient }
 */
export function createSupabaseDependencies({
  url,
  anonKey,
  authStorage,
  detectSessionInUrl = false,
  createClientImpl,
}: CreateSupabaseDependenciesOptions) {
  if (!url) throw new Error('createSupabaseDependencies: url is required')
  if (!anonKey) throw new Error('createSupabaseDependencies: anonKey is required')
  if (!authStorage) throw new Error('createSupabaseDependencies: authStorage is required')
  if (typeof createClientImpl !== 'function') {
    throw new Error('createSupabaseDependencies: createClientImpl must be a function')
  }

  const supabase = createClientImpl(url, anonKey, {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
    },
  })

  return { supabase }
}
