/**
 * resolveUserTz — resolve o fuso horário (IANA) do dono de um recurso (F4.3f.1).
 *
 * Fonte de verdade: `user_settings.timezone` (ADR-049). Usado no write-path
 * (geração de dose_instances na criação/edição de protocolo) e no cron de
 * renovação — a geração materializa `scheduled_for` no fuso do DONO, não em SP.
 *
 * BEST-EFFORT / falha-fechado-em-SP: qualquer erro, linha ausente ou tz nulo →
 * `DEFAULT_TIMEZONE`. Nunca lança (o caller é best-effort, R-245).
 *
 * @param {Object} client  client Supabase (authenticated ou service_role).
 * @param {string} userId  dono do recurso.
 * @returns {Promise<string>} tz IANA (`user_settings.timezone` ou `America/Sao_Paulo`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { DEFAULT_TIMEZONE } from '../schemas/userSettingsSchema.js'

export async function resolveUserTz(client: SupabaseClient<Database>, userId: string | null | undefined): Promise<string> {
  if (!userId) return DEFAULT_TIMEZONE
  try {
    const { data, error } = await client
      .from('user_settings')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data?.timezone) return DEFAULT_TIMEZONE
    return data.timezone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * resolveUserTzMap — resolve o tz de VÁRIOS usuários numa query (evita N+1 no cron).
 * @param {Object} client  client Supabase.
 * @param {string[]} userIds  lista (pode ter repetidos).
 * @returns {Promise<Map<string,string>>} userId → tz (ausentes não entram; caller usa fallback).
 */
export async function resolveUserTzMap(client: SupabaseClient<Database>, userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set((userIds || []).filter(Boolean))] as string[]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  try {
    const { data, error } = await client
      .from('user_settings')
      .select('user_id, timezone')
      .in('user_id', unique)
    if (error || !data) return map
    for (const row of data) {
      if (row?.user_id && row?.timezone) map.set(row.user_id, row.timezone)
    }
  } catch {
    // best-effort — map vazio → caller cai no DEFAULT_TIMEZONE
  }
  return map
}
