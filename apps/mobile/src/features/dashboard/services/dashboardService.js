// dashboardService.js — serviço thin para dados do dashboard mobile
// ADR-029: thin local service — chama Supabase directamente via nativeSupabaseClient
// Schemas de domínio via @dosiq/core (nunca duplicar lógica de negócio)

import { z } from 'zod'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { parseLocalDate } from '@dosiq/core'

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
    .select('id, name, medicine_id, active, frequency, time_schedule, dosage_per_intake, start_date, end_date, titration_status')
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
  const endLocal = new Date(startLocal)
  endLocal.setDate(endLocal.getDate() + 1)
  const endUTC = endLocal.toISOString()
  if (__DEV__) console.log('[dashboardService] getTodayLogs boundaries — start:', startUTC, 'end:', endUTC)

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
    .select('id, name, dosage_per_pill, dosage_unit')
    .in('id', medicineIds)

  if (error) throw error

  return (data ?? []).reduce((acc, m) => {
    acc[m.id] = {
      name: m.name,
      dosage_per_pill: m.dosage_per_pill,
      dosage_unit: m.dosage_unit
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
  const startLocal = parseLocalDate(new Date().toISOString().split('T')[0])
  startLocal.setDate(startLocal.getDate() - (days - 1))
  const startUTC = startLocal.toISOString()
  
  const endLocal = parseLocalDate(new Date().toISOString().split('T')[0])
  endLocal.setDate(endLocal.getDate() + 1)
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
