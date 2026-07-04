/**
 * webSupabaseClient — Cliente Supabase para a plataforma web
 *
 * Criado via factory do shared-data com injecao de:
 * - config publica (publicAppConfig) lida do bootstrap web
 * - storage adapter (webStorageAdapter) para persistencia da sessao
 * - createClient de @supabase/supabase-js (injetado, nao importado dentro do pacote)
 *
 * Estrategia de coexistencia (H3.4):
 * O singleton legado em src/shared/utils/supabase.js permanece durante a transicao.
 * Novos servicos podem usar este cliente. Migracao completa na H3.5/H3.6.
 */
import { createClient } from '@supabase/supabase-js'
import { createSupabaseClient } from '@dosiq/shared-data'
import { publicAppConfig } from '@shared/platform/config/publicAppConfig'
import { webStorageAdapter } from '@shared/platform/storage/webStorageAdapter'

/**
 * Cliente Supabase criado via factory com dependencias injetadas.
 * Usar para novos servicos que adotam o padrao H3.
 */
export const webSupabaseClient = createSupabaseClient({
  url: publicAppConfig.supabaseUrl,
  anonKey: publicAppConfig.supabaseAnonKey,
  authStorage: webStorageAdapter,
  detectSessionInUrl: publicAppConfig.detectSessionInUrl,
  createClientImpl: createClient,
})
