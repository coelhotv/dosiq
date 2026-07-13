// dashboardService.js — serviço thin para dados do dashboard mobile
// ADR-029: thin local service — chama Supabase directamente via nativeSupabaseClient
// Schemas de domínio via @dosiq/core (nunca duplicar lógica de negócio)

import { z } from 'zod'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { parseLocalDate, getTodayLocal, addDays, createDoseInstanceRepository } from '@dosiq/core'
import { debugLog } from '@shared/utils/debugLog'

// Repo de instâncias (leitura de adesão ← dose_instances, S3.6). RLS escopa por user_id.
// TODO(040-strict): supabase client local não tipado como Database (nível B)
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase as any })

/**
 * Busca protocolos ativos do utilizador.
 * Seleciona apenas colunas necessárias para o dashboard (R-127: slim select).
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getActiveProtocols(userId, dateStr) {
  z.string().uuid().parse(userId)
  const { data, error } = await supabase
    .from('protocols')
    .select('id, name, medicine_id, active, frequency, time_schedule, dosage_per_intake, intake_unit, start_date, end_date, titration_status, weekdays, critical_alarm, treatment_plan_id, treatment_plan:treatment_plans(id, name, emoji, color)')
    .eq('user_id', userId)
    .eq('active', true)
    .lte('start_date', dateStr)
    .or(`end_date.is.null,end_date.gte.${dateStr}`)
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
  z.string().uuid().parse(userId)
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(dateStr)
  // Boundaries UTC derivadas da meia-noite local (R-020: nunca raw new Date('YYYY-MM-DDT...'))
  // startUTC = meia-noite local do dia → UTC
  const startLocal = parseLocalDate(dateStr)
  const startUTC = startLocal.toISOString()
  // endUTC = meia-noite local do dia seguinte → UTC (exclusive upper boundary)
  const endLocal = addDays(startLocal, 1)
  const endUTC = endLocal.toISOString()
  debugLog('dashboardService', `getTodayLogs boundaries — start: ${startUTC} end: ${endUTC}`)

  const { data, error } = await supabase
    .from('medicine_logs')
    .select('id, protocol_id, medicine_id, taken_at, quantity_taken')
    .eq('user_id', userId)
    .gte('taken_at', startUTC)
    .lt('taken_at', endUTC)

  if (error) throw error
  return data ?? []
}

/**
 * Busca os dados dos medicamentos referenciados pelos protocolos.
 * Usado para enriquecer a lista de doses na tela Hoje.
 *
 * @param {string[]} medicineIds
 * @returns {Promise<Record<string, Object>>} — map de id → { name, dosage_per_pill, dosage_unit }
 */
export async function getMedicinesData(medicineIds) {
  // Validação conforme regra de camada de serviço (R-125)
  z.array(z.string().uuid()).parse(medicineIds)

  if (!medicineIds.length) return {}

  const { data, error } = await supabase
    .from('medicines')
    .select('id, name, type, presentation, dosage_per_pill, dosage_unit, concentration_volume_ml, units_per_ml')
    .in('id', medicineIds)

  if (error) throw error

  return (data ?? []).reduce((acc, m) => {
    acc[m.id] = {
      name: m.name,
      // type + presentation: ícone canônico de identificação (getMedicineIconName, 012 Fase A)
      type: m.type,
      presentation: m.presentation,
      dosage_per_pill: m.dosage_per_pill,
      dosage_unit: m.dosage_unit,
      concentration_volume_ml: m.concentration_volume_ml,
      units_per_ml: m.units_per_ml
    }
    return acc
  }, {})
}

/**
 * Busca as configurações do usuário, incluindo o nome.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserSettings(userId) {
  z.string().uuid().parse(userId)
  const { data, error } = await supabase
    .from('user_settings')
    .select('display_name, timezone, complexity_override')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') return null
  if (error) throw error
  return data
}

/**
 * Busca logs para um período de dias (histórico).
 * @param {string} userId
 * @param {number} days
 * @returns {Promise<Array>}
 */
export async function getLogsForPeriod(userId, days = 7) {
  z.string().uuid().parse(userId)
  
  // boundaries UTC baseadas na meia-noite local
  const todayStr = getTodayLocal()
  const startLocal = addDays(todayStr, -(days - 1))
  const startUTC = startLocal.toISOString()
  
  const endLocal = addDays(todayStr, 1)
  const endUTC = endLocal.toISOString()
  
  const { data, error } = await supabase
    .from('medicine_logs')
    .select('id, protocol_id, medicine_id, taken_at, quantity_taken')
    .eq('user_id', userId)
    .gte('taken_at', startUTC)
    .lt('taken_at', endUTC)

  if (error) throw error
  return data ?? []
}

/**
 * Busca as ocorrências materializadas (`dose_instances`) do usuário numa janela de `days`
 * dias até hoje + AMANHÃ (S3.6, ADR-054). Fonte da adesão/streak no mobile —
 * `taken/(taken+missed)`, `skipped_*` neutro — em vez de inferir sobre logs ±2h.
 * F4.3e: a janela superior vai até o FIM de amanhã (não fim de hoje) p/ o `lookAhead`
 * ("Em breve") enxergar as doses do começo de amanhã dentro da tolerância — espelha o
 * fetch web `[ontem, amanhã]`. Janela curta (≤15d) é OOM-safe (R-249).
 *
 * @param {string} userId
 * @param {number} days - dias para trás (default 14: 7d atual + 7d anterior p/ o trend)
 * @param {number} lookAheadDays - dias para frente além de amanhã (default 2 = fim de amanhã)
 * @returns {Promise<Array>} linhas de dose_instances (status, scheduled_for, ...)
 */
export async function getDoseInstancesForPeriod(userId, days = 14, lookAheadDays = 2) {
  z.string().uuid().parse(userId)

  const todayStr = getTodayLocal()
  const startUTC = addDays(todayStr, -(days - 1)).toISOString()
  const endUTC = addDays(todayStr, lookAheadDays).toISOString()

  return doseInstanceRepo.getWindow(userId, startUTC, endUTC)
}

/**
 * Busca SÓ a data das doses registradas nos últimos `days` dias (select enxuto — R-127).
 * Fonte do gatilho do card de upsell de estoque (spec 044, F4b / T018): `useTodayData`
 * só carrega 14 dias de logs, insuficiente para o critério de streak de 14 dias
 * consecutivos "ancorado no presente" (precisa de folga antes do início da janela).
 * Não reutiliza `getLogsForPeriod` porque este não precisa de protocol_id/medicine_id/
 * quantity_taken — só `taken_at`, o suficiente pra `evaluateStockUpsell` (@dosiq/core).
 *
 * @param {string} userId
 * @param {number} days
 * @returns {Promise<Array<{ taken_at: string }>>}
 */
export async function getDoseLogDatesForPeriod(userId, days = 30) {
  z.string().uuid().parse(userId)

  const todayStr = getTodayLocal()
  const startUTC = addDays(todayStr, -(days - 1)).toISOString()
  const endUTC = addDays(todayStr, 1).toISOString()

  const { data, error } = await supabase
    .from('medicine_logs')
    .select('taken_at')
    .eq('user_id', userId)
    .gte('taken_at', startUTC)
    .lt('taken_at', endUTC)

  if (error) throw error
  return data ?? []
}
