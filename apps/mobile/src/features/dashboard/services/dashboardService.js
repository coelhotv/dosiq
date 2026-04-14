// dashboardService.js — serviço thin para dados do dashboard mobile
// ADR-029: thin local service — chama Supabase directamente via nativeSupabaseClient
// Schemas de domínio via @meus-remedios/core (nunca duplicar lógica de negócio)

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { parseLocalDate } from '@meus-remedios/core'

/**
 * Busca protocolos activos do utilizador.
 * Selecciona apenas colunas necessárias para o dashboard (R-127: slim select).
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getActiveProtocols(userId) {
  const { data, error } = await supabase
    .from('protocols')
    .select('id, name, medicine_id, frequency, time_schedule, dosage_per_intake, titration_status')
    .eq('user_id', userId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

/**
 * Busca os logs de medicação de um dia específico.
 * Boundaries em UTC derivadas da meia-noite local (parseLocalDate).
 * Padrão do projecto: todos os timestamps no DB são UTC (R-020).
 * parseLocalDate('2026-04-13') → new Date('2026-04-13T00:00:00') → meia-noite local
 * .toISOString() → '2026-04-13T03:00:00.000Z' (para UTC-3) — boundary correcta.
 *
 * @param {string} userId
 * @param {string} dateStr  — formato YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getTodayLogs(userId, dateStr) {
  // Meia-noite local → UTC (evita o problema de datas UTC que cruzam a meia-noite local)
  const startUTC = parseLocalDate(dateStr).toISOString()
  // Fim do dia local: 23:59:59 → UTC
  const endUTC = new Date(`${dateStr}T23:59:59`).toISOString()
  console.log('[dashboardService] getTodayLogs boundaries — start:', startUTC, 'end:', endUTC)

  const { data, error } = await supabase
    .from('medicine_logs')
    .select('id, protocol_id, medicine_id, taken_at, quantity_taken')
    .eq('user_id', userId)
    .gte('taken_at', startUTC)
    .lte('taken_at', endUTC)

  if (error) throw error
  return data ?? []
}

/**
 * Busca os nomes dos medicamentos referenciados pelos protocolos.
 * Usado para enriquecer a lista de doses na tela Hoje.
 *
 * @param {string[]} medicineIds
 * @returns {Promise<Record<string, string>>} — map de id → name
 */
export async function getMedicineNames(medicineIds) {
  if (!medicineIds.length) return {}

  const { data, error } = await supabase
    .from('medicines')
    .select('id, name')
    .in('id', medicineIds)

  if (error) throw error

  return (data ?? []).reduce((acc, m) => {
    acc[m.id] = m.name
    return acc
  }, {})
}
