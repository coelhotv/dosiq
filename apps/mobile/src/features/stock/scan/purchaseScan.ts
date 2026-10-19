// "Ler a caixa" no registro de compra (spec 066 D2 · FR-027 · INV-6).
//
// A caixa lida é comparada ao remédio travado da compra: idêntica preenche, similar pergunta antes,
// outro remédio não preenche nada. O que a caixa diz é SUGESTÃO: quantidade, laboratório e EAN entram
// como valores editáveis do form (várias caixas, comprimidos já tomados), e nada é gravado aqui.

import { classifySameMedicine, type CandidateMedicineLike, type CmedMedicineDraft, type SameMedicineMatch } from '@dosiq/core'

const RANK: Record<SameMedicineMatch, number> = { identico: 2, similar: 1, outro: 0 }

// A quantidade da caixa só é contagem em forma sólida; em líquido/injetável `X 240` é volume (plan R-3).
const COUNTED_PRESENTATIONS = new Set(['comprimido', 'capsula'])

/**
 * Composto de dose ambígua chega sem dose (INV-2): compara uma vez por concentração possível e fica
 * com a melhor resposta, como o `findScanCandidates` do cadastro.
 */
export function classifyPurchaseScan(
  draft: CmedMedicineDraft,
  medicine: CandidateMedicineLike | null | undefined,
): SameMedicineMatch {
  const variants =
    draft.dosage_per_pill === null && draft.strengthChoices.length > 0
      ? draft.strengthChoices.map((c) => ({ ...draft, dosage_per_pill: c.dose, dosage_unit: c.unit }))
      : [draft]
  return variants
    .map((variant) => classifySameMedicine(variant, medicine))
    .reduce<SameMedicineMatch>((best, m) => (RANK[m] > RANK[best] ? m : best), 'outro')
}

export interface PurchaseScanFill {
  /** Ausente = não sugerir (forma não contável, líquido ou caixa de embalagem desconhecida). */
  quantity?: string
  /** Ausente = manter o que está (laboratório travado por marca, ou caixa sem laboratório). */
  laboratory?: string
  ean: string | null
  /** Remédio `/ml` (frascos × volume): nº de unidades da caixa, volume de uma em mL (pt-BR) e embalagem. */
  bottles?: string
  volume?: string
  container?: string
}

export function purchaseScanFill(
  draft: CmedMedicineDraft,
  ean: string | null | undefined,
  opts: { labLocked: boolean; liquidInputs: boolean },
): PurchaseScanFill {
  const fill: PurchaseScanFill = { ean: ean && /^[0-9]{13}$/.test(ean) ? ean : null }
  const box = draft.boxQuantity
  if (!opts.liquidInputs && COUNTED_PRESENTATIONS.has(draft.presentation) && box !== null && box > 0) {
    fill.quantity = String(box)
  }
  if (!opts.labLocked && draft.displayLaboratory) fill.laboratory = draft.displayLaboratory
  // Remédio `/ml`: frascos × volume, lidos do texto da embalagem (o `q` do injetável não serve — C-10).
  if (opts.liquidInputs) {
    if (draft.boxUnits !== null && draft.boxUnits > 0) fill.bottles = String(draft.boxUnits)
    if (draft.boxVolumeMl !== null && draft.boxVolumeMl > 0) fill.volume = String(draft.boxVolumeMl).replace('.', ',')
    if (draft.boxContainer) fill.container = draft.boxContainer
  }
  return fill
}

export type ScanFieldKey = 'quantity' | 'laboratory' | 'ean' | 'bottles' | 'volume' | 'container'

/** Tudo o que esta leitura preenche, campo a campo (o form e os campos de remédio `/ml`). */
export function fillEntries(fill: PurchaseScanFill): Partial<Record<ScanFieldKey, string>> {
  const entries: Partial<Record<ScanFieldKey, string>> = { ean: fill.ean ?? '' }
  if (fill.quantity) entries.quantity = fill.quantity
  if (fill.laboratory) entries.laboratory = fill.laboratory
  if (fill.bottles) entries.bottles = fill.bottles
  if (fill.volume) entries.volume = fill.volume
  if (fill.container) entries.container = fill.container
  return entries
}

/** O que uma leitura trocou: o valor posto e o que havia antes, para a leitura seguinte poder desfazer. */
export interface ScanFillRecord {
  applied: Partial<Record<ScanFieldKey, string>>
  before: Partial<Record<ScanFieldKey, string>>
}

/**
 * C-12 (smoke 1.6): uma leitura nova desfaz a anterior — devolve o valor de antes aos campos que ainda
 * estão como a caixa deixou (o que a pessoa editou fica, INV-6) — e então aplica a nova, se houver.
 * Devolve os campos finais que mudaram e o registro desta leitura.
 */
export function nextScanFields(
  current: Record<ScanFieldKey, string>,
  fill: PurchaseScanFill | null,
  previous: ScanFillRecord | null,
): { changes: Partial<Record<ScanFieldKey, string>>; record: ScanFillRecord | null } {
  const next = { ...current }
  if (previous) {
    for (const [key, value] of Object.entries(previous.applied) as [ScanFieldKey, string][]) {
      if (current[key] === value) next[key] = previous.before[key] ?? ''
    }
  }
  let record: ScanFillRecord | null = null
  if (fill) {
    record = { applied: {}, before: {} }
    for (const [key, value] of Object.entries(fillEntries(fill)) as [ScanFieldKey, string][]) {
      record.before[key] = next[key]
      record.applied[key] = value
      next[key] = value
    }
  }
  const changes: Partial<Record<ScanFieldKey, string>> = {}
  for (const key of Object.keys(next) as ScanFieldKey[]) if (next[key] !== current[key]) changes[key] = next[key]
  return { changes, record }
}

export function filledNotice(fill: PurchaseScanFill): string {
  return fill.quantity
    ? 'Preenchido pela caixa. Confira a quantidade: comprou mais de uma caixa ou já tomou algum?'
    : 'Preenchido pela caixa. Confira antes de registrar.'
}

export type StockScanResolution<T> =
  | { kind: 'one'; medicine: T }
  | { kind: 'choose'; candidates: { medicine: T; match: 'identico' | 'similar' }[] }
  | { kind: 'none' }

/**
 * "Ler a caixa" na aba Estoque (FR-030): qual remédio da conta é esta caixa? Um idêntico só ⇒ abre a
 * compra nele; vários idênticos, ou nenhum idêntico e algum similar ⇒ a pessoa escolhe (o app nunca
 * escolhe entre candidatos); nada ⇒ ainda não está cadastrado. Idênticos vêm antes dos similares.
 */
export function resolveStockScan<T extends CandidateMedicineLike>(
  draft: CmedMedicineDraft,
  medicines: readonly T[] | null | undefined,
): StockScanResolution<T> {
  const identicos: T[] = []
  const similares: T[] = []
  for (const medicine of medicines ?? []) {
    const match = classifyPurchaseScan(draft, medicine)
    if (match === 'identico') identicos.push(medicine)
    else if (match === 'similar') similares.push(medicine)
  }
  if (identicos.length === 1) return { kind: 'one', medicine: identicos[0] }
  if (identicos.length + similares.length === 0) return { kind: 'none' }
  return {
    kind: 'choose',
    candidates: [
      ...identicos.map((medicine) => ({ medicine, match: 'identico' as const })),
      ...similares.map((medicine) => ({ medicine, match: 'similar' as const })),
    ],
  }
}
