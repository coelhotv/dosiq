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

/**
 * Cria as dependencias Supabase para a plataforma atual.
 *
 * @param {Object} options
 * @param {string} options.url - URL do projeto Supabase (https://...)
 * @param {string} options.anonKey - Anon key publica do projeto
 * @param {Object} options.authStorage - Adapter de storage async para sessao de autenticacao
 * @param {boolean} [options.detectSessionInUrl=false] - Detectar sessao na URL (apenas web)
 * @param {Function} options.createClientImpl - Implementacao de createClient (injetada)
 * @returns {{ supabase: import('@supabase/supabase-js').SupabaseClient }}
 */
export function createSupabaseDependencies({
  url,
  anonKey,
  authStorage,
  detectSessionInUrl = false,
  createClientImpl,
}) {
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
