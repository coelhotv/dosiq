// isProtocolInPeriod = predicado period-only (active flag + janela start/end).
// NÃO usar isProtocolActiveOnDate (strict, frequency-aware) aqui: ele exige que
// o tratamento "dispare HOJE", jogando semanal/dias_alternados/quando_necessario
// pra "sem tratamento ativo" mesmo com a flag active ligada. Pro estoque, ter
// tratamento ativo = estar no período + active, independente de disparar hoje.
import { getTodayLocal, isProtocolInPeriod, doseToMl, frequencyDailyFactor, isBiologicallyExpired, biologicalExpiryDaysLeft, stockDoseMetrics, isStockRunwayAlertExpected, computeSupplyDate, DEFAULT_TZ, formatMedicineFullName } from '@dosiq/core'

export function transformStockData(rawData) {
  const today = getTodayLocal()

  return rawData.map((item) => {
    const totalQuantity = item.medicine_stock_summary?.[0]?.total_quantity || 0
    const hasPurchases = (item.medicine_stock_summary?.[0]?.stock_entries_count ?? 0) > 0
    const activeProtocols = (item.protocols || []).filter(p =>
      p.active && isProtocolInPeriod(p, today)
    )

    // Líquidos (022): saldo em ml → consumo convertido (gotas/UI → ml via units_per_ml).
    const isLiquid = Boolean(item.dosage_unit?.endsWith('/ml'))
    const dailyConsumption = activeProtocols.reduce((acc, p) => {
      const intakesPerDay = p.time_schedule?.length ?? 0
      // mg → ml via dosage_per_pill (concentração); gotas/UI via units_per_ml (012 Fase B2).
      const perDose = isLiquid
        ? doseToMl(Number(p.dosage_per_intake), p.intake_unit, item.units_per_ml, item.dosage_per_pill)
        : Number(p.dosage_per_intake)
      // Frequência: semanal/alternados/personalizado não consomem todo dia.
      return acc + (perDose * intakesPerDay * frequencyDailyFactor(p))
    }, 0)

    const daysRemaining = dailyConsumption > 0
      ? totalQuantity / dailyConsumption
      : Infinity

    // 012 B4 / ADR-067: doses físicas restantes (número exibido p/ freq ≠ diário);
    // cor/status seguem runway (daysRemaining). Diário mantém "N dias".
    const { dosesRemaining, isDaily } = stockDoseMetrics(totalQuantity, activeProtocols, item)

    let status = 'HIGH'
    let statusLabel = 'Bom'
    let color = '#3b82f6'

    if (daysRemaining < 7) {
      status = 'CRITICAL'
      statusLabel = 'Crítico'
      color = '#ef4444'
    } else if (daysRemaining < 14) {
      status = 'LOW'
      statusLabel = 'Baixo'
      color = '#f59e0b'
    } else if (daysRemaining < 30) {
      status = 'NORMAL'
      statusLabel = 'Normal'
      color = '#22c55e'
    } else {
      status = 'HIGH'
      statusLabel = 'Bom'
      color = '#3b82f6'
    }

    // Eixo TTL pós-abertura (012 Fase A) — paralelo ao status por volume.
    // _latestOpenedAt injetado por useStock._fetchAndPersistStock.
    const stockRow = item._latestOpenedAt ? { opened_at: item._latestOpenedAt } : null
    const ttlExpired = stockRow ? isBiologicallyExpired(stockRow, item) : false
    const ttlDaysLeft = stockRow ? biologicalExpiryDaysLeft(stockRow, item) : null
    // Alerta ativo: vencido OU faltam ≤3 dias (e lote tem saldo)
    const ttlAlertActive = totalQuantity > 0 && (ttlExpired || (ttlDaysLeft !== null && ttlDaysLeft >= 0 && ttlDaysLeft <= 3))

    return {
      ...item,
      totalQuantity,
      hasPurchases,
      dailyConsumption,
      daysRemaining,
      dosesRemaining,
      isDailyStock: isDaily,
      status,
      statusLabel,
      color,
      hasActiveProtocol: activeProtocols.length > 0,
      activeProtocols,
      ttlExpired,
      ttlDaysLeft,
      ttlAlertActive,
    }
  })
}

export function filterActiveStockItems(processed) {
  return processed
    .filter(item => item.hasActiveProtocol)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
}

/**
 * Split PO-9 (§0.7): separa itens com protocolo ativo (com previsão de consumo)
 * dos itens só-estoque (saldo positivo sem treatment ativo — antes invisíveis).
 *
 * - active: hasActiveProtocol, ordenado por daysRemaining asc (mais crítico primeiro)
 * - inactive: !hasActiveProtocol && totalQuantity > 0, ordenado por nome
 *
 * O service já filtra `hasActiveProtocol || totalQuantity > 0`, então itens sem
 * protocolo e sem saldo nem chegam aqui.
 */
export function splitStockItems(processed) {
  const active = processed
    .filter(item => item.hasActiveProtocol)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  const inactive = processed
    .filter(item => !item.hasActiveProtocol && item.totalQuantity > 0)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return { active, inactive }
}

// ═══ 105 Fatia B — remédio que zera de propósito (mensal / etapa de passagem) ═══
// INV-1: elegibilidade e data vêm do core (`isStockRunwayAlertExpected` / `computeSupplyDate`), as
// MESMAS funções do servidor. Aqui só se monta a entrada e se anota o item — lista, badge e banner do
// Hoje leem o item, então este é o ponto único de troca (C-B1).

/**
 * Protocolos do item na forma do core. 🔴 O embed `protocols(...)` do select do estoque NÃO traz
 * `medicine_id` (`createStockRepository.getMedicinesWithStockOrActiveProtocol`), e o core filtra por
 * ele: sem isto a lista ficava vazia e o predicado respondia "alerta como hoje" (smoke 2026-11-06).
 * O embed é filho do medicamento, então `medicine_id = item.id` é fato, não suposição.
 */
function runwayProtocolsOf(it) {
  return (it?.activeProtocols ?? []).map((p) => ({ ...p, medicine_id: p?.medicine_id ?? it.id }))
}

/** Itens elegíveis à leitura de doses pendentes (o predicado diz que zerar é o plano). */
export function supplyEligibleMedicineIds(items, steps) {
  if (!Array.isArray(items) || !Array.isArray(steps)) return []
  return items
    .filter((it) => it?.hasActiveProtocol && !isStockRunwayAlertExpected(it.id, runwayProtocolsOf(it), steps))
    .map((it) => it.id)
}

/** Saldo por medicamento na forma do core (líquido precisa da concentração p/ converter a dose). */
function runwayStocksOf(items) {
  const stocks = {}
  for (const it of items) {
    stocks[it.id] = {
      qty: it.totalQuantity ?? 0,
      dosage_unit: it.dosage_unit ?? null,
      units_per_ml: it.units_per_ml ?? null,
      dosage_per_pill: it.dosage_per_pill ?? null,
    }
  }
  return stocks
}

/**
 * Anota cada item com `runwayAlertExpected` e `supply` (resultado do core, ou null).
 *
 * `steps === null` = leitura das etapas falhou ⇒ fail-safe (AP-277 / INV-2): alerta como hoje, sem
 * data. Nunca cala por falta de dado.
 * Item elegível perde o tier de falta (`CRITICAL`/`LOW`) e vira `PLANNED`: saldo segue visível (FR-G5).
 */
export function attachSupplyRunway(items, { steps, instances, now, tz = DEFAULT_TZ }) {
  if (!Array.isArray(items)) return items
  if (!Array.isArray(steps)) {
    return items.map((it) => ({ ...it, runwayAlertExpected: true, supply: null }))
  }
  const stocks = runwayStocksOf(items)
  return items.map((it) => {
    if (!it.hasActiveProtocol) return { ...it, runwayAlertExpected: true, supply: null }
    const protocols = runwayProtocolsOf(it)
    const runwayAlertExpected = isStockRunwayAlertExpected(it.id, protocols, steps)
    if (runwayAlertExpected) return { ...it, runwayAlertExpected, supply: null }
    const supply = computeSupplyDate({
      medicineId: it.id,
      protocols,
      steps,
      instances: instances ?? [],
      stocks,
      tz,
      now,
    })
    return { ...it, runwayAlertExpected, supply, status: 'PLANNED', statusLabel: 'Planejado', color: '#64748b' }
  })
}

/** 'YYYY-MM-DD' → 'DD/MM', sem `new Date(string)` (R-020). Inválido ⇒ null. */
export function formatSupplyDateShort(date) {
  const m = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null
  return m ? `${m[3]}/${m[2]}` : null
}

/**
 * Texto da próxima compra do item (FR-009/G-B3), ou null quando não há data (FR-010: a UI mostra o
 * saldo em doses). Escada: a compra é do PRÓXIMO remédio, dito no texto.
 */
export function supplyLabelOf(item) {
  const s = item?.supply
  if (!s || s.status !== 'due') return null
  const short = formatSupplyDateShort(s.date)
  if (!short) return null
  return s.reason === 'step_switch' ? `Próxima etapa: comprar até ${short}` : `Próxima compra até ${short}`
}

/** Medicamentos a comprar (data `due`) que NÃO estão na lista — precisam do cadastro buscado. */
export function supplyBuyIdsMissing(items) {
  if (!Array.isArray(items)) return []
  const listed = new Set(items.map((it) => it?.id))
  const ids = items
    .filter((it) => it?.supply?.status === 'due' && !listed.has(it.supply.medicineId))
    .map((it) => it.supply.medicineId)
  return [...new Set(ids)]
}

/**
 * Anota `supplyBuyName` = nome COMPLETO (com concentração) do remédio a comprar, como o card da
 * titulação mostra: "Mounjaro" sozinho não diz qual caneta comprar. Fonte: o próprio item da lista
 * ou o cadastro buscado (`summaries`); sem nenhum dos dois ⇒ null (o card cai num texto genérico).
 */
export function attachSupplyBuyNames(items, summaries = []) {
  if (!Array.isArray(items)) return items
  const byId = new Map()
  for (const m of summaries ?? []) if (m?.id) byId.set(m.id, m)
  for (const it of items) if (it?.id) byId.set(it.id, it)
  return items.map((it) => {
    if (it?.supply?.status !== 'due') return it
    const med = byId.get(it.supply.medicineId)
    return { ...it, supplyBuyName: med ? formatMedicineFullName(med) : null }
  })
}
