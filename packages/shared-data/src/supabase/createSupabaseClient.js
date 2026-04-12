/**
 * createSupabaseClient — Wrapper conveniente sobre createSupabaseDependencies
 *
 * Retorna apenas o cliente Supabase (sem o objeto wrapper).
 * Usar quando o caller precisa apenas do cliente, nao das dependencias completas.
 *
 * @param {Object} options - Mesmas opcoes de createSupabaseDependencies
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
import { createSupabaseDependencies } from './createSupabaseDependencies.js'

export function createSupabaseClient(options) {
  const { supabase } = createSupabaseDependencies(options)
  return supabase
}
