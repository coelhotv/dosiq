/**
 * §3.8 Locais de aplicação (spec 097 FR-013, INV-6, D-C1).
 *
 * - Um cartão por MEDICAMENTO (D-C1, PO 2026-10-04): `medicine_logs.medicine_id` existe em toda
 *   linha; `protocol_id` falta em parte dos registros com local (12 de 48 no banco, 2026-10-04).
 * - Medicamento e local saem da própria linha do registro (R-299); a entidade viva só dá o nome.
 *   Medicamento arquivado continua contando (fato).
 * - Só entra medicamento com ≥ 1 aplicação com local da lista no período (D-C3, smoke C, PO
 *   2026-10-04: cartão "em branco" não diz nada). Denominador sempre junto do mapa: `withSite` de
 *   `total`. Local fora da lista conta no total e não no mapa (o CHECK impede; o agregador não quebra).
 * - Linha SaMD: só contagem. Nenhuma ordem por uso, alerta ou sugestão de próximo local.
 */
import { formatMedicineConcentration } from '../../../utils/doseUnit'
import { INJECTION_SITES } from '../../../utils/injectionSites'
import { localDayOf } from '../reportFormat'
import type { ReportInputs } from '../reportTypes'

export interface InjectionSiteCount {
  site: string
  label: string
  count: number
}

export interface InjectionSiteCard {
  medicineId: string
  /** "Nome · concentração" — distingue duas canetas do mesmo nome (smoke C). */
  name: string
  /** Aplicações do medicamento no período. */
  total: number
  /** Aplicações com local da lista. */
  withSite: number
  /** Só locais usados, na ordem canônica de `INJECTION_SITES` (não por contagem — sem ranking). */
  counts: InjectionSiteCount[]
}

const SITE_ORDER = new Map(INJECTION_SITES.map((s, i) => [s.value, i]))
const SITE_LABEL = new Map(INJECTION_SITES.map((s) => [s.value, s.label]))

export function buildInjectionSites(inputs: ReportInputs): InjectionSiteCard[] {
  const { from, to } = inputs.window
  const medicines = new Map(inputs.medicines.map((m) => [m.id, m]))
  const acc = new Map<string, { total: number; sites: Map<string, number> }>()

  for (const log of inputs.medicineLogs) {
    const day = localDayOf(log.taken_at, inputs.timezone)
    if (!day || day < from || day > to) continue
    const entry = acc.get(log.medicine_id) ?? { total: 0, sites: new Map<string, number>() }
    entry.total += 1
    if (log.injection_site && SITE_ORDER.has(log.injection_site)) {
      entry.sites.set(log.injection_site, (entry.sites.get(log.injection_site) ?? 0) + 1)
    }
    acc.set(log.medicine_id, entry)
  }

  const cards: InjectionSiteCard[] = []
  for (const [medicineId, entry] of acc) {
    const medicine = medicines.get(medicineId) ?? null
    const counts = [...entry.sites.entries()]
      .map(([site, count]) => ({ site, label: SITE_LABEL.get(site) as string, count }))
      .sort((a, b) => (SITE_ORDER.get(a.site) as number) - (SITE_ORDER.get(b.site) as number))
    if (!counts.length) continue
    const concentration = medicine ? formatMedicineConcentration(medicine) : null
    cards.push({
      medicineId,
      name: medicine ? (concentration ? `${medicine.name} · ${concentration}` : medicine.name) : 'Medicamento sem cadastro',
      total: entry.total,
      withSite: counts.reduce((n, c) => n + c.count, 0),
      counts,
    })
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
