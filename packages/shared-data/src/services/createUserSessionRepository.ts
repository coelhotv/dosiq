/**
 * createUserSessionRepository — Factory para repositorio de sessao do usuario
 *
 * Operacoes de autenticacao/sessao sem acoplamento a singleton web.
 * O cliente Supabase e injetado pelo caller (web ou mobile).
 *
 * @example
 * const repo = createUserSessionRepository({ supabase })
 * const user = await repo.getCurrentUser()
 */

import type { AuthError, Session, User } from '@supabase/supabase-js'

/**
 * Shape mínimo do client Supabase consumido aqui (apenas `.auth`) — estrutural, para
 * não acoplar a uma instanciação genérica específica de `SupabaseClient<Database>`.
 */
interface SupabaseLike {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: AuthError | null }>
    getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }>
    signOut(): Promise<{ error: AuthError | null }>
  }
}

/**
 * @param deps
 * @param deps.supabase
 * @returns {UserSessionRepository}
 */
export function createUserSessionRepository({ supabase }: { supabase: SupabaseLike }) {
  if (!supabase) throw new Error('createUserSessionRepository: supabase client is required')

  /**
   * Retorna o usuario autenticado atual, ou null se nao autenticado.
   * @returns {Promise<import('@supabase/supabase-js').User|null>}
   */
  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data?.user ?? null
  }

  /**
   * Retorna a sessao ativa atual, ou null se nao autenticado.
   * @returns {Promise<import('@supabase/supabase-js').Session|null>}
   */
  async function getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data?.session ?? null
  }

  /**
   * Retorna o ID do usuario atual, ou null se nao autenticado.
   * @returns {Promise<string|null>}
   */
  async function getUserId() {
    const user = await getCurrentUser()
    return user?.id ?? null
  }

  /**
   * Faz logout do usuario atual.
   * @returns {Promise<void>}
   */
  async function signOut() {
    await supabase.auth.signOut()
  }

  return {
    getCurrentUser,
    getSession,
    getUserId,
    signOut,
  }
}
