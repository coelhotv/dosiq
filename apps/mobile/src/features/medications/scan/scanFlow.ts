// Núcleo puro do scanner de código de barras (spec 066 D1 · RC3 E-2/E-6).
//
// O estado da tela é DERIVADO de três fontes (índice, permissão, estado local): o reducer guarda só o
// que é da tela (lendo · ilegível · não encontrado · escolhendo), sem espelhar os hooks. O EAN lido é
// resolvido aqui, enquanto o índice está em memória, e o que sai é o RASCUNHO pronto, nunca um
// `rowIdx`: o índice é solto em background e pode ser trocado de versão, e um índice de linha velho
// apontaria outra caixa (dose errada). Nada aqui grava (INV-1).

import {
  countConcentrationChoices,
  groupByConcentration,
  isValidEan13,
  medicineDraftFromRow,
  resolveEan,
  type CmedIndex,
  type CmedMedicineDraft,
  type EanLookup,
  type PickerConcentration,
} from '@dosiq/core'
import type { CmedIndexStatus } from '@shared/hooks/useCmedIndex'

export const ILLEGIBLE_TIMEOUT_MS = 20_000

export interface ScanPermission {
  granted: boolean
  canAskAgain: boolean
  status: 'granted' | 'denied' | 'undetermined'
}

export type ScanScreen =
  | 'preparing'
  | 'pre_permission'
  | 'denied'
  | 'blocked'
  | 'offline'
  | 'index_failed'
  | 'version'
  | 'reading'
  | 'illegible'
  | 'not_found'
  | 'choosing'

export type ScanLocal =
  | { phase: 'reading' }
  | { phase: 'illegible' }
  | { phase: 'not_found' }
  | { phase: 'choosing'; title: string; options: PickerConcentration[] }

export type ScanLocalAction =
  | { type: 'timeout' }
  | { type: 'not_found' }
  | { type: 'choose'; title: string; options: PickerConcentration[] }
  | { type: 'retry' }

export const INITIAL_SCAN_LOCAL: ScanLocal = { phase: 'reading' }

export function scanLocalReducer(state: ScanLocal, action: ScanLocalAction): ScanLocal {
  switch (action.type) {
    case 'timeout':
      // Timer que dispara depois de um resultado não pode apagá-lo.
      return state.phase === 'reading' ? { phase: 'illegible' } : state
    case 'not_found':
      return { phase: 'not_found' }
    case 'choose':
      return { phase: 'choosing', title: action.title, options: action.options }
    case 'retry':
      return INITIAL_SCAN_LOCAL
    default:
      return state
  }
}

/** Mapa de estados do §5 do design: permissão → índice → leitura. "Digitar manualmente" vale em todos. */
export function scanScreenState(
  indexStatus: CmedIndexStatus,
  permission: ScanPermission | null,
  local: ScanLocal,
): ScanScreen {
  if (!permission) return 'preparing'
  if (!permission.granted) {
    if (!permission.canAskAgain) return 'blocked'
    return permission.status === 'denied' ? 'denied' : 'pre_permission'
  }
  if (indexStatus === 'offline') return 'offline'
  if (indexStatus === 'failed') return 'index_failed'
  if (indexStatus === 'version') return 'version'
  if (indexStatus !== 'ready') return 'preparing'
  return local.phase
}

// ── Permissão no Android (smoke C-D1-5, 2026-10-17) ──────────────────────────────────────────────
// O Expo calcula `canAskAgain` com `shouldShowRequestPermissionRationale`
// (expo-modules-core `PermissionsService.kt:215`). No modo "Perguntar sempre" (permissão de uma vez,
// Android 11+), depois que ela expira essa função devolve false, e a tela dizia "bloqueada" sem ser
// verdade: o sistema ainda mostra o diálogo. Só o pedido real separa os dois casos: bloqueada de
// fato volta sem diálogo, quase na hora; com diálogo, a resposta depende de a pessoa tocar.
export const NO_DIALOG_MS = 400

export type PermissionOutcome = 'granted' | 'denied' | 'blocked'

/** Resultado de um pedido de câmera. Só no Android o tempo decide entre negada e bloqueada. */
export function permissionOutcome(
  isAndroid: boolean,
  granted: boolean,
  canAskAgain: boolean,
  elapsedMs: number,
): PermissionOutcome {
  if (granted) return 'granted'
  if (canAskAgain) return 'denied'
  if (!isAndroid) return 'blocked'
  return elapsedMs < NO_DIALOG_MS ? 'blocked' : 'denied'
}

/**
 * A permissão que a tela usa. No Android, `!granted && !canAskAgain` não prova bloqueio: até a
 * sondagem responder (`probe`), a tela fica em preparo; depois vale o que o pedido real mostrou.
 */
export function effectivePermission(
  isAndroid: boolean,
  raw: ScanPermission | null,
  probe: PermissionOutcome | null,
): ScanPermission | null {
  if (!raw || !isAndroid || raw.granted || raw.canAskAgain) return raw
  if (probe === null) return null
  if (probe === 'denied') return { ...raw, canAskAgain: true, status: 'denied' }
  return raw
}

export type ScanResolution =
  | { kind: 'found'; draft: CmedMedicineDraft }
  | { kind: 'choose'; title: string; options: PickerConcentration[] }
  | { kind: 'not_found' }

/**
 * Rascunho da linha escolhida. `ambiguousBox`: a linha veio de um EAN com várias embalagens, então a
 * quantidade da caixa não é conhecida (escolher X30 ou X60 seria chute; ela não muda o cadastro).
 */
export function draftFromPick(index: CmedIndex, rowIdx: number, ambiguousBox: boolean): CmedMedicineDraft {
  const draft = medicineDraftFromRow(index.rows[rowIdx])
  return ambiguousBox ? { ...draft, boxQuantity: null } : draft
}

/** EAN lido → rascunho, escolha (FR-026) ou não encontrado. Nunca lança. */
export function resolveScannedEan(index: CmedIndex, lookup: EanLookup, ean: string): ScanResolution {
  if (!isValidEan13(ean)) return { kind: 'not_found' }
  const resolution = resolveEan(lookup, index, ean)
  if (resolution.kind === 'not_found') return { kind: 'not_found' }
  if (resolution.kind === 'found') return { kind: 'found', draft: draftFromPick(index, resolution.rowIdx, false) }

  const options = groupByConcentration(index, resolution.rowIdxs)
  // Mesma concentração (e sem laboratório a escolher): as linhas só diferem na embalagem.
  if (countConcentrationChoices(options) === 1 && options[0].laboratories.length < 2) {
    return { kind: 'found', draft: draftFromPick(index, options[0].rowIdx, true) }
  }
  return { kind: 'choose', title: index.rows[resolution.rowIdxs[0]].p, options }
}
