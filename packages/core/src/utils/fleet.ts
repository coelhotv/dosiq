// packages/core/src/utils/fleet.ts
// Contagem da frota INSTALADA em campo — fonte ÚNICA (spec 051 / ADR-089 / RC3-2 F3).
//
// POR QUE ESTE MÓDULO EXISTE: até aqui a única implementação da união/janela/dedupe vivia dentro do
// heredoc `node -e` de `scripts/fleet-versions.sh`. O handler admin do kill switch precisa da MESMA
// contagem, porque o `acknowledge_affected_devices` compara *o número que o operador viu* com *o
// número que o servidor conta*. Duas implementações ⇒ divergência ⇒ recusa falsa em emergência, ou
// confirmação sobre um conjunto diferente do que será bloqueado. Script e handler consomem daqui.
//
// PURO: sem I/O, sem relógio, sem rede. Quem busca as linhas é o chamador (o script por curl, o
// handler por supabase-js). Isto recebe as linhas e conta.
//
// ⚠️ `notification_devices` é PISO, NÃO RETRATO (AP-314): só enxerga quem aceitou push. `device_activity`
// (ADR-089) é fonte ADITIVA que cruza quem usa o app sem nunca ter aceitado — união, nunca substituição.

import { compareSemver } from './semver'
import { parseISOOrNull } from './dateUtils'

/** Janela de atividade que define "frota ativa". Mesmo valor usado pelo script desde o ADR-088. */
export const FLEET_WINDOW_DAYS = 30

/** Uma instalação já normalizada e deduplicada. */
export interface FleetInstall {
  userId: string
  platform: string
  appVersion: string
  /** Instante da última atividade, em ISO. `updated_at` nos devices, `last_seen_at` na activity. */
  seenAt: string
}

/** Linha crua de `notification_devices` (`updated_at`) ou `device_activity` (`last_seen_at`). */
export interface FleetSourceRow {
  user_id?: string | null
  platform?: string | null
  app_version?: string | null
  updated_at?: string | null
  last_seen_at?: string | null
}

export interface FleetVersionBucket {
  version: string
  installs: number
  users: number
}

export interface FleetSummary {
  totalInstalls: number
  totalUsers: number
  /** Ordenado da versão mais nova para a mais antiga. */
  byVersion: FleetVersionBucket[]
  oldestVersion: string | null
}

/**
 * Aceita qualquer coisa e devolve um array de linhas.
 *
 * Existe porque o PostgREST devolve um OBJETO de erro (permissão, config) no lugar do array quando a
 * leitura falha — e um `.map` sobre esse objeto estoura. O script já fazia esse guard na fonte
 * aditiva; aqui vale para as duas, porque a fonte principal também pode falhar.
 */
function asRows(value: unknown): FleetSourceRow[] {
  return Array.isArray(value) ? (value as FleetSourceRow[]) : []
}

/** Milissegundos da linha, ou `null` quando o timestamp é ausente/ilegível. */
function seenAtMs(row: FleetInstall): number | null {
  // `seenAt` é timestamptz do Postgres (instante absoluto com offset), não date-string — comparar
  // instantes aqui é correto e não tem a armadilha de fuso do R-020. `parseISOOrNull` é o helper
  // canônico; entrada suja vira `NaN` e é filtrada abaixo.
  const ms = parseISOOrNull(row.seenAt)?.getTime()
  return ms === undefined || Number.isNaN(ms) ? null : ms
}

/**
 * Normaliza uma linha crua de qualquer das duas fontes, ou devolve `null` quando ela não descreve
 * uma instalação utilizável.
 *
 * `timestampField` diz qual coluna carrega a atividade: `notification_devices` usa `updated_at`,
 * `device_activity` usa `last_seen_at`. A normalização acontece ANTES de qualquer comparação — é o
 * ponto em que as duas fontes passam a ser comparáveis.
 */
function normalizeRow(
  row: FleetSourceRow,
  timestampField: 'updated_at' | 'last_seen_at',
): FleetInstall | null {
  // Linha sem `app_version` é ignorada: a coluna é nullable em `notification_devices` (verificado no
  // banco em 2026-07-25), e inventar uma versão transformaria "desconhecida" em "afetada" por chute.
  if (!row.app_version || !row.user_id || !row.platform) return null

  const fallbackField = timestampField === 'updated_at' ? 'last_seen_at' : 'updated_at'
  return {
    userId: row.user_id,
    platform: row.platform,
    appVersion: row.app_version,
    seenAt: row[timestampField] ?? row[fallbackField] ?? '',
  }
}

/**
 * Une as duas fontes e devolve UMA instalação por `(user_id, platform)`, mantendo a mais recente.
 *
 * O dedupe não é cosmético: um usuário com 3 aparelhos antigos não pode pesar como 3 votos contra um
 * DROP, nem inflar o raio de impacto que o admin confirma.
 *
 * Linhas sem `app_version` são IGNORADAS (a coluna é nullable em `notification_devices` — verificado
 * no banco em 2026-07-25). Uma instalação de versão desconhecida não pode ser contada como uma
 * versão qualquer, e inventar `'0.0.0'` a transformaria em "afetada" por chute.
 */
export function dedupeFleetInstalls(deviceRows: unknown, activityRows: unknown): FleetInstall[] {
  const merged: FleetInstall[] = [
    ...asRows(deviceRows).map((row) => normalizeRow(row, 'updated_at')),
    ...asRows(activityRows).map((row) => normalizeRow(row, 'last_seen_at')),
  ].filter((install): install is FleetInstall => install !== null)

  const latest = new Map<string, FleetInstall>()
  for (const install of merged) {
    const key = `${install.userId}|${install.platform}`
    const previous = latest.get(key)
    if (!previous) {
      latest.set(key, install)
      continue
    }
    const a = seenAtMs(install)
    const b = seenAtMs(previous)
    // Timestamp ilegível nunca vence: `null > x` seria `false` em JS, mas explicitar evita que uma
    // refatoração futura troque a comparação por algo que trate NaN como "mais recente".
    if (a !== null && (b === null || a > b)) latest.set(key, install)
  }

  return [...latest.values()]
}

/** Distribuição por versão — o relatório que `scripts/fleet-versions.sh` imprime. */
export function summarizeFleetVersions(installs: FleetInstall[]): FleetSummary {
  const byVersion = new Map<string, { installs: number; users: Set<string> }>()
  for (const install of installs) {
    const bucket = byVersion.get(install.appVersion) ?? { installs: 0, users: new Set<string>() }
    bucket.installs += 1
    bucket.users.add(install.userId)
    byVersion.set(install.appVersion, bucket)
  }

  // Da mais NOVA para a mais antiga. Versão ilegível vai para o fim (compareSemver devolve null).
  const versions = [...byVersion.keys()].sort((a, b) => {
    const cmp = compareSemver(b, a)
    if (cmp !== null) return cmp
    return a.localeCompare(b)
  })

  return {
    totalInstalls: installs.length,
    totalUsers: new Set(installs.map((i) => i.userId)).size,
    byVersion: versions.map((version) => {
      const bucket = byVersion.get(version)
      return {
        version,
        installs: bucket?.installs ?? 0,
        users: bucket?.users.size ?? 0,
      }
    }),
    oldestVersion: versions.length > 0 ? versions[versions.length - 1] : null,
  }
}

/**
 * Instalações que o gate BLOQUEARIA se ativado — o raio de impacto que o admin confirma (S-7).
 *
 * Filtro: mesma plataforma E versão instalada abaixo do piso.
 *
 * 🔴 FAIL-CLOSED, ao contrário do resolver do cliente. Versão instalada ilegível
 * (`compareSemver === null`) conta como AFETADA. No cliente, indeterminado ABRE (AP-303: não
 * bloquear quem não se sabe). Aqui, indeterminado CONTA: este número existe para o operador medir o
 * estrago antes de causá-lo, e subestimar o estrago é o único erro que importa. As duas escolhas
 * são a mesma política — errar para o lado de não prejudicar o usuário.
 *
 * ⚠️ NÃO CONFUNDIR AS DUAS INDETERMINAÇÕES — elas têm respostas OPOSTAS, e é fácil colapsá-las:
 *  - versão INSTALADA ilegível ⇒ conta como afetada (não sei o que esse aparelho tem ⇒ assumo o pior);
 *  - PISO ilegível/ausente ⇒ `0` (não há limiar definido ⇒ nada está definido como afetado).
 * Tratar piso inválido como "todos afetados" produziria um número que parece medição e é ruído — a
 * frota inteira, sempre, para qualquer lixo digitado. O Zod da escrita já recusa ativar sem piso
 * `X.Y.Z`; este `0` é a segunda camada, não a primeira.
 */
export function countAffectedInstalls(
  installs: FleetInstall[],
  options: { platform: string; minSupportedVersion: string | null | undefined },
): number {
  const { platform, minSupportedVersion } = options
  if (!minSupportedVersion) return 0
  // Piso que o próprio comparador não consegue ler não define limiar nenhum.
  if (compareSemver(minSupportedVersion, minSupportedVersion) === null) return 0

  let affected = 0
  for (const install of installs) {
    if (install.platform !== platform) continue
    const cmp = compareSemver(install.appVersion, minSupportedVersion)
    if (cmp === null || cmp === -1) affected += 1
  }
  return affected
}

/**
 * Data-limite ISO (`YYYY-MM-DD`) da janela de frota, para o filtro `gte` do PostgREST.
 * Recebe o "agora" — o módulo não olha o relógio (testável sem mock de tempo).
 */
export function fleetWindowStart(now: Date, windowDays: number = FLEET_WINDOW_DAYS): string {
  // eslint-disable-next-line no-restricted-syntax -- aritmética de instante UTC absoluto, não parse de date-string (R-020)
  const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  return start.toISOString().slice(0, 10)
}
