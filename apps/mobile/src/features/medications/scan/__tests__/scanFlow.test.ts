// 066 D1 (PO-2 · PO-3 · PO-9 · RC3 E-2/E-6) — núcleo puro do scanner: estado da tela, resolução do
// EAN lido e o estado local (lendo · ilegível · não encontrado · escolhendo). Nada aqui grava (INV-1).

import { decodeCmedIndex, buildEanLookup } from '@dosiq/core'
import fixture from '../../../../../../../packages/core/src/services/cmed/__tests__/fixtures/cmed-fixture.json'
import {
  ILLEGIBLE_TIMEOUT_MS,
  INITIAL_SCAN_LOCAL,
  NO_DIALOG_MS,
  draftFromPick,
  effectivePermission,
  permissionOutcome,
  resolveScannedEan,
  scanLocalReducer,
  scanScreenState,
} from '../scanFlow'

function indexFrom(mutate?: (raw: any) => void) {
  const raw = JSON.parse(JSON.stringify(fixture))
  mutate?.(raw)
  const result = decodeCmedIndex(raw)
  if (result.ok === false) throw new Error('fixture não decodificou')
  return { index: result.index, lookup: buildEanLookup(result.index) }
}

const GRANTED = { granted: true, canAskAgain: true, status: 'granted' as const }
const READING = INITIAL_SCAN_LOCAL

describe('scanScreenState — o que a tela mostra (PO-3, guard full: 7 estados de falha)', () => {
  it.each([
    ['permissão ainda carregando', 'ready', null, 'preparing'],
    ['nunca perguntada', 'ready', { granted: false, canAskAgain: true, status: 'undetermined' }, 'pre_permission'],
    ['negada, pode perguntar de novo', 'ready', { granted: false, canAskAgain: true, status: 'denied' }, 'denied'],
    ['bloqueada nos Ajustes', 'ready', { granted: false, canAskAgain: false, status: 'denied' }, 'blocked'],
    ['índice carregando', 'preparing', GRANTED, 'preparing'],
    ['índice ainda não pedido', 'idle', GRANTED, 'preparing'],
    ['offline sem cache', 'offline', GRANTED, 'offline'],
    ['índice corrompido', 'failed', GRANTED, 'index_failed'],
    ['layout de índice desconhecido (E10)', 'version', GRANTED, 'version'],
    ['pronto', 'ready', GRANTED, 'reading'],
  ] as const)('%s → %s', (_label, indexStatus, permission, expected) => {
    expect(scanScreenState(indexStatus, permission, READING)).toBe(expected)
  })

  it('a permissão vem antes do índice: negada não espera o índice carregar', () => {
    expect(scanScreenState('preparing', { granted: false, canAskAgain: false, status: 'denied' }, READING)).toBe('blocked')
  })

  it('estado local só vale com índice pronto e câmera liberada', () => {
    expect(scanScreenState('ready', GRANTED, { phase: 'illegible' })).toBe('illegible')
    expect(scanScreenState('ready', GRANTED, { phase: 'not_found' })).toBe('not_found')
    expect(scanScreenState('offline', GRANTED, { phase: 'not_found' })).toBe('offline')
  })
})

describe('scanLocalReducer', () => {
  it('20 s sem leitura → ilegível; tentar de novo volta a ler', () => {
    expect(ILLEGIBLE_TIMEOUT_MS).toBe(20_000)
    const illegible = scanLocalReducer(READING, { type: 'timeout' })
    expect(illegible.phase).toBe('illegible')
    expect(scanLocalReducer(illegible, { type: 'retry' }).phase).toBe('reading')
  })

  it('timeout atrasado não derruba um resultado já obtido', () => {
    const notFound = scanLocalReducer(READING, { type: 'not_found' })
    expect(scanLocalReducer(notFound, { type: 'timeout' })).toBe(notFound)
  })
})

describe('resolveScannedEan (PO-2 · PO-3 · PO-9 · E-2: devolve rascunho, nunca rowIdx)', () => {
  it('EAN conhecido → rascunho completo da caixa (SC-005)', () => {
    const { index, lookup } = indexFrom()
    const result = resolveScannedEan(index, lookup, '7896004778402')
    expect(result.kind).toBe('found')
    if (result.kind !== 'found') return
    expect(result.draft).toMatchObject({
      dosage_per_pill: 500,
      dosage_unit: 'mg',
      presentation: 'comprimido',
      boxQuantity: 21,
      isGeneric: true,
      laboratory: null,
      anvisa_registration: null,
      strengthLabel: '500 mg + 125 mg',
    })
    expect(result.draft.displayLaboratory).toBeTruthy()
    expect(result).not.toHaveProperty('rowIdx')
  })

  it('o 2º EAN da mesma linha resolve igual', () => {
    const { index, lookup } = indexFrom()
    expect(resolveScannedEan(index, lookup, '7896004795232').kind).toBe('found')
  })

  it('EAN ausente do índice → not_found, sem throw', () => {
    const { index, lookup } = indexFrom()
    expect(resolveScannedEan(index, lookup, '7891234567895')).toEqual({ kind: 'not_found' })
  })

  it.each(['', '123', 'abcdefghijklm', '7890000000025'])('EAN inválido %p → not_found (E1, E7)', (ean) => {
    const { index, lookup } = indexFrom()
    expect(resolveScannedEan(index, lookup, ean)).toEqual({ kind: 'not_found' })
  })

  it('EAN com 2 linhas que só diferem na quantidade da caixa → 1 rascunho, quantidade desconhecida', () => {
    // A quantidade da caixa não muda o cadastro (C5 R-4); escolher X30 ou X60 seria chute.
    const { index, lookup } = indexFrom()
    const result = resolveScannedEan(index, lookup, '7891317020576')
    expect(result.kind).toBe('found')
    if (result.kind !== 'found') return
    expect(result.draft.dosage_per_pill).toBe(500)
    expect(result.draft.boxQuantity).toBeNull()
  })

  it('EAN com linhas de concentração diferente → pede a escolha, nada preenchido antes (FR-026)', () => {
    const { index, lookup } = indexFrom((raw) => {
      raw.cols.d[10] = 250
      raw.cols.ds[10] = '250 mg'
    })
    const result = resolveScannedEan(index, lookup, '7891317020576')
    expect(result.kind).toBe('choose')
    if (result.kind !== 'choose') return
    expect(result.options).toHaveLength(2)
    expect(result.title).toBe('Divalproato de Sódio')
  })

  it('dose ambígua → rascunho sem dose (INV-2)', () => {
    const { index, lookup } = indexFrom()
    const result = resolveScannedEan(index, lookup, '7890000000031')
    expect(result.kind).toBe('found')
    if (result.kind !== 'found') return
    expect(result.draft.dosage_per_pill).toBeNull()
    expect(result.draft.doseAmbiguous).toBe(true)
  })
})

describe('draftFromPick', () => {
  it('escolha no passo 2 vira rascunho; a quantidade só vale se a linha escolhida for a única', () => {
    const { index } = indexFrom()
    expect(draftFromPick(index, 8, false).boxQuantity).toBe(21)
    expect(draftFromPick(index, 9, true).boxQuantity).toBeNull()
  })
})

describe('permissão no Android: "Perguntar sempre" não é bloqueio (C-D1-5)', () => {
  const LOOKS_BLOCKED = { granted: false, canAskAgain: false, status: 'denied' as const }

  it('sem diálogo (resposta na hora) = bloqueada; com diálogo e negativa = negada', () => {
    expect(permissionOutcome(true, false, false, NO_DIALOG_MS - 1)).toBe('blocked')
    expect(permissionOutcome(true, false, false, NO_DIALOG_MS + 500)).toBe('denied')
    expect(permissionOutcome(true, true, false, 10)).toBe('granted')
    expect(permissionOutcome(true, false, true, 10)).toBe('denied')
  })

  it('iOS mantém o canAskAgain do sistema (lá, negar uma vez já bloqueia)', () => {
    expect(permissionOutcome(false, false, false, 5_000)).toBe('blocked')
  })

  it('Android com cara de bloqueada espera a sondagem (preparo), depois vale o pedido real', () => {
    expect(effectivePermission(true, LOOKS_BLOCKED, null)).toBeNull()
    expect(scanScreenState('ready', effectivePermission(true, LOOKS_BLOCKED, null), READING)).toBe('preparing')
    expect(scanScreenState('ready', effectivePermission(true, LOOKS_BLOCKED, 'denied'), READING)).toBe('denied')
    expect(scanScreenState('ready', effectivePermission(true, LOOKS_BLOCKED, 'blocked'), READING)).toBe('blocked')
  })

  it('iOS e permissão concedida passam direto', () => {
    expect(effectivePermission(false, LOOKS_BLOCKED, null)).toBe(LOOKS_BLOCKED)
    expect(effectivePermission(true, GRANTED, null)).toBe(GRANTED)
  })
})
