// Embalagem lida do TEXTO da apresentação CMED (campo `a`) — spec 066 D2, medição de 2026-10-18.
//
// Por que o texto e não `q`: no injetável o `q` do índice mistura volume (Lantus `X 3 ML` → 3) com nº de
// unidades (Mounjaro `CT 4 FA X 0,5 ML` → 4) e trunca decimal (Ozempic `X 1,5 ML` → 1) — C-10. O texto
// dá as três coisas que a compra de remédio `/ml` pede: volume por unidade, quantas vêm na caixa e como
// vêm embaladas. Cobertura medida no índice real: volume 99,9% (líquido) / 99,2% (injetável), unidades
// 97,5% / 97,8%, embalagem 74,5% do injetável. Sem casamento seguro, o campo fica vazio (nunca chuta).
//
// `presentationFromRow` é a contenção do C-11: 356 linhas orais (xarope/suspensão com seringa dosadora)
// vêm marcadas `injetavel` pelo pipeline; o texto diferencia a via. A correção na origem é do pipeline.

import { PRESENTATIONS, INJECTION_CONTAINERS } from '../../schemas/medicineSchema'

export type InjectionContainer = (typeof INJECTION_CONTAINERS)[number]

export interface CmedPackage {
  /** Volume de UMA unidade (frasco, caneta, ampola…) em mL. */
  volumeMl: number | null
  /** Quantas unidades vêm na caixa (`CT 4 FA` → 4; sem número → 1). */
  units: number | null
  /** Só injetável: embalagem no vocabulário do cadastro de compra. */
  container: InjectionContainer | null
}

const EMPTY: CmedPackage = { volumeMl: null, units: null, container: null }
const PRESENTATION_SET = new Set<string>(PRESENTATIONS)

// "1,5 ML" / "X 0,5 ML" / "3 ML"; nunca a concentração "MG/ML" (precedida de "/").
const VOLUME = /(?<![/\w])(\d+(?:[.,]\d+)?)\s*ML\b/g
const UNIT_TOKEN = '(FR AMP|FA|FRASCOS?-AMPOLAS?|FRASCOS?|FRS|FR|CARPULES?|CARP|CAR|CANETAS?|SERINGAS?|SER|AMPOLAS?|AMP|BOLS|ENVOL|FLAC|BG)'
const UNITS_AFTER_BOX = new RegExp(`\\b(?:CT|CX)\\b\\s*(?:X\\s*)?(\\d+)?\\s*${UNIT_TOKEN}\\b`)
const UNITS_BARE = new RegExp(`\\b${UNIT_TOKEN}\\b`)
// Outro remédio depois do "+": tem dose e forma próprias (kit de dois componentes).
const KIT_COMPONENT = /\b(MG|MCG|UI|U)\b.*\b(SOL|SUS|PO|EMU)\b/
const ORAL_ROUTE = /\b(OR|ORAL|XPE|GOT|ELX|OFT|NAS|OTO)\b/
const INJECTION = /\b(INJ|INFUS)\b/

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function volumeFrom(text: string): number | null {
  const volumes = [...text.matchAll(VOLUME)].map((m) => toNumber(m[1])).filter((n): n is number => n !== null)
  if (volumes.length === 0) return null
  // O primeiro volume é o do frasco; o seguinte costuma ser acessório (copo, seringa dosadora). Num kit
  // de dois remédios os volumes são de componentes diferentes ⇒ ambíguo.
  const tail = text.split(' + ').slice(1).join(' + ')
  if (new Set(volumes).size > 1 && KIT_COMPONENT.test(tail)) return null
  return volumes[0]
}

function unitsFrom(text: string): { units: number; token: string } | null {
  const boxed = UNITS_AFTER_BOX.exec(text)
  if (boxed) return { units: boxed[1] ? Number(boxed[1]) : 1, token: boxed[2] }
  // Sem "CT/CX" (colírio `FR GOT … X 10 ML`): a embalagem citada é uma só.
  const bare = UNITS_BARE.exec(text.split(' + ')[0])
  return bare ? { units: 1, token: bare[1] } : null
}

function containerFrom(text: string, token: string | null): InjectionContainer | null {
  if (/\bSER(INGAS?)? PREENC/.test(text)) return 'seringa_preenchida'
  if (!token) return null
  if (token.startsWith('CANETA')) return 'caneta'
  if (token === 'FA' || token === 'FR AMP' || token.includes('-AMP')) return 'frasco_ampola'
  if (token.startsWith('AMP')) return 'ampola'
  if (token.startsWith('CAR')) return /\b(CAN|SIST)\s+APLIC/.test(text) ? 'caneta' : 'refil'
  // FR simples no injetável é soro/hospital (medido: 96 de 101) — não vira embalagem.
  return null
}

/** Volume/unidades/embalagem para a compra de remédio `/ml` (líquido e injetável). Nunca lança. */
export function packageFromText(raw: string | null | undefined, presentation: string | null): CmedPackage {
  if (!raw || (presentation !== 'liquido' && presentation !== 'injetavel')) return EMPTY
  const text = raw.toUpperCase()
  const unit = unitsFrom(text)
  return {
    volumeMl: volumeFrom(text),
    units: unit ? unit.units : null,
    container: presentation === 'injetavel' ? containerFrom(text, unit ? unit.token : null) : null,
  }
}

/** Forma do cadastro a partir da linha, com a contenção do C-11 (via oral marcada `injetavel`). */
export function presentationFromRow(f: string | null, raw: string | null | undefined): string {
  if (f === null || !PRESENTATION_SET.has(f)) return 'outro'
  if (f !== 'injetavel') return f
  const text = (raw ?? '').toUpperCase()
  return ORAL_ROUTE.test(text) && !INJECTION.test(text) ? 'liquido' : 'injetavel'
}
