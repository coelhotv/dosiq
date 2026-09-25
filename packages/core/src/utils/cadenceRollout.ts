// packages/core/src/utils/cadenceRollout.ts
// Trava de rollout POR USUÁRIA da cadência `intervalo_dias` (085 C1.5/H-1, decisão do PO 2026-09-24).
//
// POR QUE EXISTE: a web publica no merge; o app mobile antigo não conhece `intervalo_dias`, trata
// valor desconhecido como DIÁRIO e materializa instâncias diárias pelo planner (useAlarmScheduler,
// dashboardService). Para um injetável mensal isso é lembrete todo dia e dado errado no banco.
// O risco é da usuária DONA do protocolo, não da frota — então a trava olha só os aparelhos dela, e
// o Slice C2 não precisa esperar a frota inteira atualizar.
//
// PURO: sem I/O e sem relógio. Quem busca as linhas (RLS `auth.uid() = user_id` nas duas tabelas) e
// fornece `now` é o chamador.
//
// ⚠️ NÃO usa `dedupeFleetInstalls`: ele guarda UMA instalação por (usuária, plataforma), a mais
// recente — um iPhone antigo ao lado de um iPhone novo sumiria, e é justamente o antigo que importa.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { compareSemver } from './semver'
import { getRawNow, parseISOOrNull } from './dateUtils'
import { FLEET_WINDOW_DAYS } from './fleet'

/**
 * Primeira versão mobile cujo motor conhece `intervalo_dias` (085 Slice C1). Bump de APP_VERSION
 * que carrega o C1 — mantenha em sincronia com `apps/mobile/app.config.js` do release do C1.
 */
export const INTERVAL_CADENCE_MIN_MOBILE_VERSION = '0.33.2'

const MOBILE_PLATFORMS = new Set(['ios', 'android'])
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Linha crua de `device_activity` (`last_seen_at`) ou `notification_devices` (`updated_at`, `is_active`). */
export interface CadenceInstallRow {
  platform?: string | null
  app_version?: string | null
  last_seen_at?: string | null
  updated_at?: string | null
  is_active?: boolean | null
}

function asRows(value: unknown): CadenceInstallRow[] {
  return Array.isArray(value) ? (value as CadenceInstallRow[]) : []
}

/** Aparelho mobile visto dentro da janela da frota ativa (mesmos 30 dias do ADR-088). */
function isRecentMobile(row: CadenceInstallRow, nowMs: number): boolean {
  if (row.is_active === false) return false
  if (!row.platform || !MOBILE_PLATFORMS.has(row.platform)) return false
  const seen = parseISOOrNull(row.last_seen_at ?? row.updated_at ?? null)?.getTime()
  if (seen === undefined || Number.isNaN(seen)) return false
  return nowMs - seen <= FLEET_WINDOW_DAYS * MS_PER_DAY
}

/**
 * A cadência `intervalo_dias` pode ser OFERECIDA a esta usuária?
 *
 * Regra "pelo menos um registro atualizado" (PO, 2026-09-24):
 * - existe ao menos UM aparelho mobile recente com versão >= mínima; E
 * - NENHUM aparelho mobile recente abaixo da mínima (ou de versão ilegível — desconhecida não é
 *   "atualizada" por chute).
 * Sem nenhum registro ⇒ NÃO libera: um celular anterior à telemetria é invisível, e parecer
 * "só web" liberaria justamente o caso perigoso. Custo aceito: quem só usa a web vê a opção
 * depois de instalar o app atualizado.
 *
 * @param deviceRows linhas de `notification_devices` da usuária
 * @param activityRows linhas de `device_activity` da usuária
 * @param now instante de referência
 */
export function isIntervalCadenceAvailable(
  deviceRows: unknown,
  activityRows: unknown,
  now: Date,
  minVersion: string = INTERVAL_CADENCE_MIN_MOBILE_VERSION,
): boolean {
  const nowMs = now.getTime()
  const recent = [...asRows(deviceRows), ...asRows(activityRows)].filter((r) => isRecentMobile(r, nowMs))
  if (recent.length === 0) return false
  return recent.every((r) => {
    const cmp = compareSemver(r.app_version, minVersion)
    return cmp !== null && cmp >= 0
  })
}

/** Teto de linhas por tabela; o máximo medido em prod foi 40 (2026-09-24). Resposta cheia = truncada. */
const CADENCE_ROWS_LIMIT = 200

/**
 * Busca os aparelhos DA PRÓPRIA usuária (RLS `auth.uid() = user_id`) e aplica a trava.
 *
 * Qualquer falha ⇒ `false`: não oferecer é o lado seguro, e nada que a usuária tentou se perde.
 * Resposta do tamanho do teto é tratada como truncada (AP-186): um aparelho antigo fora do recorte
 * liberaria justamente o caso perigoso.
 * R-295: colunas conferidas em `information_schema` 2026-09-24.
 */
export async function fetchIntervalCadenceAvailability(
  client: SupabaseClient<Database>,
  userId: string | null | undefined,
  now: Date = getRawNow(), // instante real: compara com timestamps do banco (getNow desloca o relógio)
): Promise<boolean> {
  if (!userId) return false
  try {
    const [devices, activity] = await Promise.all([
      client
        .from('notification_devices')
        .select('platform,app_version,is_active,last_seen_at,updated_at')
        .eq('user_id', userId)
        .limit(CADENCE_ROWS_LIMIT),
      client
        .from('device_activity')
        .select('platform,app_version,last_seen_at')
        .eq('user_id', userId)
        .limit(CADENCE_ROWS_LIMIT),
    ])
    if (devices.error || activity.error) return false
    const d = asRows(devices.data)
    const a = asRows(activity.data)
    if (d.length >= CADENCE_ROWS_LIMIT || a.length >= CADENCE_ROWS_LIMIT) return false
    return isIntervalCadenceAvailable(d, a, now)
  } catch {
    return false
  }
}
