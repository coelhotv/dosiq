/**
 * Propriedades de analytics do local de aplicação (spec 071 PR3, TRACKING_PLAN §5.4).
 *
 * Mede COMPORTAMENTO de entrada, nunca o dado clínico: o valor do local (`abdomen_d`…) e o
 * "repetiu o último local" ficam fora (TRACKING_PLAN §6; linha SaMD da 071). A presença destas
 * chaves revela a FORMA injetável — aceito pelo PO (G-1 opção (a), 2026-10-01; coerente com a D-1
 * da spec 092, que leva `presentation` ao `dose_logged`): forma sim, classe/nome nunca. Por isso não
 * há chave `injectable` — `site_set` presente já é o denominador, e a 092 traz a forma.
 */

import { parseISO } from '@dosiq/core'

import type { SitePanelMeta } from '@shared/components/form/InjectionSitePicker'

export type { SitePanelMeta }
export type SiteInput = NonNullable<SitePanelMeta['input']>

export const EMPTY_SITE_META: SitePanelMeta = { opened: false, auto: false, input: null }

export type SiteChange = 'added' | 'changed' | 'removed'

/**
 * Props de local para um `dose_logged`. Dose não injetável → `{}` (chave ausente ≠ chave vazia,
 * padrão da 065). `previousSite` só na edição: `undefined` = registro novo (sem `site_change`).
 */
export function buildSiteEventProps({
  injectable,
  site,
  meta = EMPTY_SITE_META,
  previousSite,
}: {
  injectable: boolean
  site: string | null | undefined
  meta?: SitePanelMeta | null
  previousSite?: string | null
}): Record<string, unknown> {
  if (!injectable) return {}
  const m = meta ?? EMPTY_SITE_META
  const hasSite = !!site
  const props: Record<string, unknown> = {
    site_set: hasSite,
    site_panel_opened: m.opened,
    site_panel_auto: m.auto,
  }
  // O meio só existe quando a pessoa ESCOLHEU nesta sessão; valor herdado da edição não tem meio.
  if (hasSite && m.input) props.site_input = m.input
  if (previousSite !== undefined) {
    const change = siteChange(previousSite ?? null, site ?? null)
    if (change) props.site_change = change
  }
  return props
}

function siteChange(prev: string | null, next: string | null): SiteChange | null {
  if (prev === next) return null
  if (!prev) return 'added'
  if (!next) return 'removed'
  return 'changed'
}

/** Agregado do lote: contagens, nunca o local. `{}` quando o lote não tem injetável. */
export function buildBulkSiteCounts(itemProps: Array<Record<string, unknown> | null | undefined>) {
  // Item injetável = item com `site_set` (a chave só existe em dose injetável)
  const injectable = itemProps.filter((p) => typeof p?.site_set === 'boolean')
  if (injectable.length === 0) return {}
  return {
    injectable_count: injectable.length,
    site_set_count: injectable.filter((p) => p?.site_set === true).length,
  }
}

export type EditChangeKind = 'time' | 'quantity' | 'site'

/** O que mudou na edição de um registro — lista, sem o valor (padrão de `treatment_edited`). */
export function buildEditChangeKind(
  prev: { taken_at?: string | null; quantity_taken?: number | null; injection_site?: string | null },
  next: { taken_at?: string | null; quantity_taken?: number | null; injection_site?: string | null }
): EditChangeKind[] {
  const kinds: EditChangeKind[] = []
  // Instantes ISO completos (timestamptz), nunca data-só — parseISO do core (R-020).
  const t = (v?: string | null) => (v ? parseISO(v).getTime() : null)
  const q = (v?: number | null) => (v == null ? null : Number(v))
  if (t(prev.taken_at) !== t(next.taken_at)) kinds.push('time')
  if (q(prev.quantity_taken) !== q(next.quantity_taken)) kinds.push('quantity')
  if ((prev.injection_site ?? null) !== (next.injection_site ?? null)) kinds.push('site')
  return kinds
}
