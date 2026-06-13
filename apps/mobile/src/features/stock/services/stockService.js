// stockService.js — Fase 3 CRUD Estoque mobile (S3.2 G2: adopt factories).
//
// G2: thin wrapper sobre createStockRepository + createPurchaseRepository de
// @dosiq/core/repositories. O `stockService` exportado é a COMPOSIÇÃO das duas
// instâncias (callers continuam usando stockService.createPurchase/etc num único
// objeto). DI mobile: nativeSupabaseClient + getUserId via supabase.auth.
//
// Mudança vs S3.1: userId NÃO é mais param explícito — a factory resolve via
// getUserId injetado. Call sites mobile (hooks/screens) dropam o arg userId.
//
// getStockData (legacy MVP read-only) preservado sem callers reais (apenas refs
// em comentários) — mantido pra não introduzir risco; remover em fix-pack pós-Fase 3.

import { z } from 'zod'
import {
  createStockRepository,
  createPurchaseRepository,
  getTodayLocal,
  isProtocolActiveOnDate,
} from '@dosiq/core'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'
import { debugLog, errorLog } from '@shared/utils/debugLog'

async function getUserId() {
  const { data, error } = await nativeSupabaseClient.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

// ───────────────────────────────────────────────────────────────────────────
// LEGACY — getStockData (MVP read-only, mantido por segurança; sem callers)
// ───────────────────────────────────────────────────────────────────────────

/**
 * @deprecated PO-9 §0.7 — filtra `protocols.active=true` no servidor e esconde
 * meds com estoque órfão. Substituído por
 * `stockService.getMedicinesWithStockOrActiveProtocol`. Remover em fix-pack
 * pós-Fase 3 (sem callers após Wave 4).
 *
 * Busca medicamentos com estoque + protocolos ativos pra cálculo de consumo.
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getStockData(userId) {
  try {
    z.string().uuid().parse(userId)
    debugLog('stockService', `getStockData: ${userId}`)

    const { data: rawData, error } = await nativeSupabaseClient
      .from('medicines')
      .select(`
        id,
        name,
        laboratory,
        dosage_unit,
        dosage_per_pill,
        concentration_volume_ml,
        shelf_life_days,
        medicine_stock_summary!left (
          total_quantity
        ),
        protocols (
          id,
          dosage_per_intake,
          time_schedule,
          frequency,
          active,
          start_date,
          end_date
        )
      `)
      .eq('user_id', userId)
      .eq('protocols.active', true)
      .order('name')

    if (error) {
      errorLog('stockService', 'getStockData query error', error)
      return { success: false, error: 'Erro ao carregar dados de estoque' }
    }

    const today = getTodayLocal()
    const validData = (rawData || []).filter((m) =>
      (m.protocols || []).some((p) => isProtocolActiveOnDate(p, today)),
    )

    return { success: true, data: validData }
  } catch (err) {
    errorLog('stockService', 'getStockData unexpected', err)
    return { success: false, error: err.message }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FASE 3 S3.2 G2 — composição das factories de @dosiq/core
// ───────────────────────────────────────────────────────────────────────────

const stockRepo = createStockRepository({ client: nativeSupabaseClient, getUserId })
const purchaseRepo = createPurchaseRepository({ client: nativeSupabaseClient, getUserId })

export const stockService = { ...stockRepo, ...purchaseRepo }
