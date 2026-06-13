/**
 * stock.js — Helpers puros de estoque (web↔mobile, sem deps de plataforma).
 *
 * Convencao: thresholds em DIAS restantes, alinhados com CLAUDE.md:
 *   CRITICAL <7d  ·  LOW <14d  ·  NORMAL <30d  ·  HIGH >=30d
 *
 * Para `vencendo`: itens com expDays < EXPIRY_WARNING_DAYS (90 dias).
 *
 * `calculateDailyIntake` e `calculateDaysRemaining` ja existem em
 * adherenceLogic.js — REUSAR (nao duplicar). Ver index.js barrel.
 */

import { getNow, formatLocalDate, parseLocalDate, parseISO, daysDifference, getLastDayOfMonth } from './dateUtils.js'
import { doseToMl, frequencyDailyFactor, calculateDailyIntake } from './adherenceLogic.js'
import { isLiquidMedicine } from './doseUnit.js'
import { cleanFloat } from './formUtils.js'

export const STOCK_STATUS = Object.freeze({
  CRITICO: 'critico',
  BAIXO: 'baixo',
  NORMAL: 'normal',
  ALTO: 'alto',
  VENCIDO: 'vencido',
})

export const STOCK_THRESHOLDS = Object.freeze({
  CRITICAL_DAYS: 7,
  LOW_DAYS: 14,
  NORMAL_DAYS: 30,
  EXPIRY_WARNING_DAYS: 90,
})

/**
 * resolveStockStatus — deriva status do estoque a partir de saldo + consumo
 * + data de validade mais proxima.
 *
 * @param {number} qty - saldo em unidades
 * @param {number} dailyConsumption - consumo diario (un./dia)
 * @param {string|null} [nearestExpiryYYYYMM] - validade mais proxima em "MM/YYYY"
 *   ou "YYYY-MM" (opcional)
 * @param {string} [today] - data ref em YYYY-MM-DD (default: hoje local)
 * @returns {'critico'|'baixo'|'normal'|'alto'|'vencido'}
 */
export function resolveStockStatus(qty, dailyConsumption, nearestExpiryYYYYMM = null, today = null) {
  const ref = today ?? formatLocalDate(getNow())

  // Vencido sobrepoe qualquer outra classificacao por seguranca.
  if (nearestExpiryYYYYMM) {
    const expDays = computeExpiryDays(nearestExpiryYYYYMM, ref)
    if (expDays != null && expDays < 0) return STOCK_STATUS.VENCIDO
  }

  // Sem consumo: classificar por saldo absoluto (proxy para "tem ou nao tem").
  if (!dailyConsumption || dailyConsumption <= 0) {
    if (qty <= 0) return STOCK_STATUS.CRITICO
    return STOCK_STATUS.NORMAL
  }

  const daysRemaining = qty / dailyConsumption
  if (daysRemaining < STOCK_THRESHOLDS.CRITICAL_DAYS) return STOCK_STATUS.CRITICO
  if (daysRemaining < STOCK_THRESHOLDS.LOW_DAYS) return STOCK_STATUS.BAIXO
  if (daysRemaining < STOCK_THRESHOLDS.NORMAL_DAYS) return STOCK_STATUS.NORMAL
  return STOCK_STATUS.ALTO
}

/**
 * stockDoseMetrics — modelo de estoque DOSE-PRIMARIO (012 B4 / ADR-067).
 *
 * A dose e a metrica fundamental; o dia corrido (runway) e projecao derivada.
 * O numero EXIBIDO e o total de doses fisicas restantes (decisao PO 2026-06-13):
 *   dosesRemaining = floor(saldo / tamanho-de-uma-tomada)
 * A COR/status (resolveStockStatus) continua medindo runwayDias (recompra e
 * cronologica). Diario: dosesRemaining ~ runwayDias (sem regressao de leitura).
 *
 * Liquido (dosage_unit termina em '/ml'): tamanho da tomada convertido p/ ml via
 * doseToMl (unit-aware ADR-065). Solido: tamanho = dose em unidades.
 *
 * @param {number} qty - saldo (ml p/ liquido, unidades p/ solido)
 * @param {Array} protocols - protocolos ativos do medicamento (com time_schedule,
 *   dosage_per_intake, intake_unit, frequency, medicine_id, active)
 * @param {{dosage_unit?: string, units_per_ml?: number, dosage_per_pill?: number}|null} [medicine]
 * @returns {{dosesRemaining: number, runwayDias: number, dosesPorDia: number, isDaily: boolean}}
 */
export function stockDoseMetrics(qty, protocols = [], medicine = null) {
  const active = (protocols || []).filter((p) => p && p.active !== false)
  if (active.length === 0 || !(qty > 0)) {
    return { dosesRemaining: 0, runwayDias: 0, dosesPorDia: 0, isDaily: true }
  }

  // Tamanho de UMA tomada (representativo: 1o protocolo ativo). Liquido -> ml.
  const rep = active[0]
  const dosePorTomada = Number(rep.dosage_per_intake) || 1
  const liquid = isLiquidMedicine(medicine)
  const doseSize = liquid
    ? doseToMl(dosePorTomada, rep.intake_unit, medicine?.units_per_ml, medicine?.dosage_per_pill)
    : dosePorTomada
  // cleanFloat antes do floor (R-277): 0,3/0,1=2,9999 nao pode virar 2 doses.
  const dosesRemaining = doseSize > 0 ? Math.floor(cleanFloat(qty / doseSize)) : 0

  // runway = dias corridos = saldo / consumo-diario (mesma unidade do saldo).
  // Reusa calculateDailyIntake (converte liquido + aplica frequencyDailyFactor).
  const dailyIntake = calculateDailyIntake(rep.medicine_id, active, medicine)
  const runwayDias = dailyIntake > 0 ? cleanFloat(qty / dailyIntake) : Infinity

  // doses/dia = tomadas/dia x cadencia (p/ custo/dia derivado dos consumidores).
  const dosesPorDia = active.reduce(
    (sum, p) => sum + (p.time_schedule?.length || 1) * frequencyDailyFactor(p),
    0
  )

  const isDaily = active.every(
    (p) => !p.frequency || p.frequency === 'diario' || p.frequency === 'diário'
  )

  return { dosesRemaining, runwayDias, dosesPorDia, isDaily }
}

/**
 * computeAverageUnitPrice — preco medio ponderado pela quantidade comprada.
 *
 * Ignora compras com quantidade <= 0 ou `unit_price` ausente/nulo.
 * Aceita `quantity_bought` (coluna canônica da tabela purchases) ou `quantity`
 * (contrato de input do form/schema) — o que estiver presente.
 *
 * @param {Array<{quantity_bought?: number, quantity?: number, unit_price: number}>} purchases
 * @returns {number} preco medio (0 se nao houver compras validas)
 */
export function computeAverageUnitPrice(purchases) {
  if (!Array.isArray(purchases) || purchases.length === 0) return 0

  let totalCost = 0
  let totalQty = 0
  for (const p of purchases) {
    const qty = Number(p?.quantity_bought ?? p?.quantity) || 0
    // Rejeitar explicitamente null/undefined ANTES de Number() —
    // Number(null) === 0 (finito) escaparia o filtro de isFinite.
    if (p?.unit_price == null || qty <= 0) continue
    const price = Number(p.unit_price)
    if (!Number.isFinite(price)) continue
    totalCost += qty * price
    totalQty += qty
  }

  if (totalQty === 0) return 0
  return totalCost / totalQty
}

/**
 * computeExpiryDays — calcula dias restantes ate validade.
 * Aceita "MM/YYYY" (mock format) ou "YYYY-MM-DD".
 *
 * Para "MM/YYYY", assume ultimo dia do mes como vencimento.
 *
 * @param {string} expiry
 * @param {string} [today] - data ref YYYY-MM-DD (default: hoje local)
 * @returns {number|null} dias (negativo se vencido) ou null se invalido
 */
export function computeExpiryDays(expiry, today = null) {
  if (!expiry || typeof expiry !== 'string') return null
  const ref = today ?? formatLocalDate(getNow())

  let expiryDate
  // MM/YYYY -> ultimo dia do mes (getLastDayOfMonth aceita month 0-indexed)
  const mmYYYY = /^(\d{2})\/(\d{4})$/.exec(expiry)
  if (mmYYYY) {
    const month = parseInt(mmYYYY[1], 10)
    const year = parseInt(mmYYYY[2], 10)
    if (month < 1 || month > 12) return null
    const lastDay = getLastDayOfMonth(year, month - 1)
    const mm = String(month).padStart(2, '0')
    const dd = String(lastDay).padStart(2, '0')
    expiryDate = `${year}-${mm}-${dd}`
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    expiryDate = expiry
  } else {
    return null
  }

  const refDate = parseLocalDate(ref)
  const expDate = parseLocalDate(expiryDate)
  if (!refDate || !expDate) return null
  return daysDifference(refDate, expDate)
}

/**
 * isBiologicallyExpired — eixo de VALIDADE BIOLÓGICA (TTL pós-abertura) do lote.
 * 012 Fase A / ADR-059. PARALELO ao status por volume (resolveStockStatus,
 * ADR-018) — coexistem, não se substituem.
 *
 * Expirado quando: opened_at + shelf_life_days <= agora.
 * Eixo INATIVO (retorna false) quando: lote fechado (opened_at NULL), produto
 * sem TTL (shelf_life_days NULL/<=0), datas inválidas ou clock skew
 * (opened_at no futuro).
 *
 * @param {{opened_at?: string|Date|null}} stockRow - lote (linha de stock)
 * @param {{shelf_life_days?: number|null}} medicine - produto
 * @param {Date} [now] - instante de referência (injetável p/ teste)
 * @returns {boolean}
 */
export function isBiologicallyExpired(stockRow, medicine, now = null) {
  const openedAt = stockRow?.opened_at
  const shelfDays = Number(medicine?.shelf_life_days)
  if (!openedAt || !Number.isFinite(shelfDays) || shelfDays <= 0) return false

  // opened_at é timestamptz (instante absoluto ISO) — Date() direto é correto
  // aqui; a proibição R-020 vale para datas-calendário YYYY-MM-DD, não p/ ISO
  // completo com timezone.
  const opened = openedAt instanceof Date ? openedAt : parseISO(String(openedAt))
  if (Number.isNaN(opened.getTime())) return false

  const ref = now instanceof Date ? now : getNow()
  const expiresAtMs = opened.getTime() + shelfDays * 24 * 60 * 60 * 1000
  // Clock skew: abertura "no futuro" nunca conta como expirada.
  if (opened.getTime() > ref.getTime()) return false
  return expiresAtMs <= ref.getTime()
}

/**
 * biologicalExpiryDaysLeft — dias inteiros restantes até a expiração biológica
 * do lote (para copy "vence em N dias" e cadência D-3 da notificação).
 *
 * @param {{opened_at?: string|Date|null}} stockRow
 * @param {{shelf_life_days?: number|null}} medicine
 * @param {Date} [now]
 * @returns {number|null} dias restantes (negativo se expirado) ou null se eixo inativo
 */
export function biologicalExpiryDaysLeft(stockRow, medicine, now = null) {
  const openedAt = stockRow?.opened_at
  const shelfDays = Number(medicine?.shelf_life_days)
  if (!openedAt || !Number.isFinite(shelfDays) || shelfDays <= 0) return null

  const opened = openedAt instanceof Date ? openedAt : parseISO(String(openedAt))
  if (Number.isNaN(opened.getTime())) return null

  const ref = now instanceof Date ? now : getNow()
  if (opened.getTime() > ref.getTime()) return null
  const expiresAtMs = opened.getTime() + shelfDays * 24 * 60 * 60 * 1000
  return Math.floor((expiresAtMs - ref.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * formatBRL — formata valor em BRL (pt-BR) sem depender de Intl.NumberFormat.
 *
 * Implementacao manual: o Hermes (engine RN/mobile) nao garante suporte
 * completo a ICU, e Intl.NumberFormat pode renderizar moeda incorretamente em
 * dispositivos. Formatacao manual garante "R$ 1.234,56" identico web↔mobile.
 *
 * Negativos: sinal antes do simbolo ("-R$ 50,00"), preservando o contrato.
 *
 * @param {number} value
 * @returns {string}
 */
export function formatBRL(value) {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const sign = n < 0 ? '-' : ''
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.')
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}R$ ${groupedInt},${decPart}`
}
