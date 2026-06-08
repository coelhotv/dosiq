// isProtocolInPeriod = predicado period-only (active flag + janela start/end).
// NÃO usar isProtocolActiveOnDate (strict, frequency-aware) aqui: ele exige que
// o tratamento "dispare HOJE", jogando semanal/dias_alternados/quando_necessario
// pra "sem tratamento ativo" mesmo com a flag active ligada. Pro estoque, ter
// tratamento ativo = estar no período + active, independente de disparar hoje.
import { getTodayLocal, isProtocolInPeriod, doseToMl } from '@dosiq/core'

export function transformStockData(rawData) {
  const today = getTodayLocal()

  return rawData.map((item) => {
    const totalQuantity = item.medicine_stock_summary?.[0]?.total_quantity || 0
    const activeProtocols = (item.protocols || []).filter(p =>
      p.active && isProtocolInPeriod(p, today)
    )

    // Líquidos (022): saldo em ml → consumo convertido (gotas/UI → ml via units_per_ml).
    const isLiquid = Boolean(item.dosage_unit?.endsWith('/ml'))
    const dailyConsumption = activeProtocols.reduce((acc, p) => {
      const intakesPerDay = p.time_schedule?.length ?? 0
      const perDose = isLiquid
        ? doseToMl(Number(p.dosage_per_intake), p.intake_unit, item.units_per_ml)
        : Number(p.dosage_per_intake)
      return acc + (perDose * intakesPerDay)
    }, 0)

    const daysRemaining = dailyConsumption > 0
      ? totalQuantity / dailyConsumption
      : Infinity

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

    return {
      ...item,
      totalQuantity,
      dailyConsumption,
      daysRemaining,
      status,
      statusLabel,
      color,
      hasActiveProtocol: activeProtocols.length > 0,
      activeProtocols
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
