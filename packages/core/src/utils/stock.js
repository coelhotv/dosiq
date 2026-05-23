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

import { getNow, formatLocalDate, parseLocalDate, daysDifference, getLastDayOfMonth } from './dateUtils.js'

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
