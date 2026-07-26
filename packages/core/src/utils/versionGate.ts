// packages/core/src/utils/versionGate.ts
// Resolver puro do kill switch de versão mínima (spec 051-A / ADR-091 / CON-033).
//
// PURO: sem I/O, sem relógio, sem rede, sem storage. O chamador (mobile) já converteu qualquer
// falha de leitura (offline, timeout, error do PostgREST, linha ausente) para `gateRow = null` —
// este módulo não interpreta o erro, só decide sobre o que recebe.
//
// 🔴 A tabela-verdade abaixo É o contrato (CON-033 §1). Alterá-la exige emenda ao ADR-091.

import { compareSemver } from './semver'

/** Linha de `app_version_gate` para UMA plataforma — ou ausente/ilegível (ver `resolveVersionGate`). */
export interface VersionGateRow {
  is_active: boolean
  min_supported_version: string | null
  message: string | null
  store_url: string | null
}

export type VersionGateDecision =
  | { blocked: false }
  | { blocked: true; message: string | null; storeUrl: string | null }

/**
 * Decide se o boot deve ser bloqueado.
 *
 * `gateRow` é `null` para TODA indeterminação — o chamador não distingue "offline" de "linha
 * ausente" de "erro 42501": tudo vira `null` antes de chegar aqui, porque a decisão é a mesma
 * (ABRE) nos três casos (AP-303 — indeterminado não é negação).
 *
 * 🔴 Usa `compareSemver`, nunca `satisfiesSemver` (fail-closed por design — `semver.ts:45` —
 * nasceu p/ filtrar nudges, onde esconder é seguro; aqui inverteria a semântica e transformaria
 * config corrompida em bloqueio universal). O `null` de `compareSemver` é o "indeterminado" que
 * o AP-303 manda deixar passar.
 *
 * Retorno é união discriminada — estreitar com `=== true`/`=== false`, nunca `!decision.blocked`
 * (R-286: `!` não discrimina sob consumidor `strict:false`, e mobile/api herdam a base).
 */
export function resolveVersionGate(
  installedVersion: string | null | undefined,
  gateRow: VersionGateRow | null | undefined,
): VersionGateDecision {
  if (!gateRow) return { blocked: false }
  if (gateRow.is_active === false) return { blocked: false }

  const cmp = compareSemver(installedVersion, gateRow.min_supported_version)
  if (cmp === -1) {
    return { blocked: true, message: gateRow.message ?? null, storeUrl: gateRow.store_url ?? null }
  }
  return { blocked: false }
}
