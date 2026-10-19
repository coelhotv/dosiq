import { describe, it, expect, afterEach, vi } from 'vitest'
import { packageFromText, presentationFromRow } from '../cmedPackage'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

// Strings reais do cmedIndex (medição 2026-10-18, spec 066 D2 · C-10/C-11).
describe('packageFromText — volume, unidades e embalagem lidos do texto da apresentação', () => {
  it.each([
    ['Ozempic 1,5 mL (q do índice truncado em 1)', '1,34 MG/ML SOL INJ CT X 1 CAR VD TRANS X 1,5 ML + 1 SIST APLIC PLAS (DOSES 0,25MG E 0,5 MG) + 6 AGULHAS NOVOFINE', 1.5, 1, 'caneta'],
    ['Wegovy 3 mL', '1,34 MG/ML SOL INJ SC CT 1 CAR VD TRANS X 3 ML + 1 SIST APLIC PLAS + 4 AGULHAS NOVOFINE PLUS', 3, 1, 'caneta'],
    ['Mounjaro 4 frascos-ampola', '15 MG/ML SOL INJ SC CT 4 FA VD TRANS X 0,5 ML', 0.5, 4, 'frasco_ampola'],
    ['Mounjaro seringa preenchida', '5 MG/ML SOL INJ SC CT 2 SER PREENC VD TRANS X 0,5 ML + 2 CAN APLIC', 0.5, 2, 'seringa_preenchida'],
    ['Mounjaro Multidose', '4,17 MG/ML SOL INJ SC CT CAR VD TRANS X 2,4 ML + CAN APLIC', 2.4, 1, 'caneta'],
    ['Lantus refil', '100 U/ML SOL INJ CT 1 CAR VD TRANS X 3 ML', 3, 1, 'refil'],
    ['Lantus frasco 10 mL', '100 U/ML SOL INJ CT 1 FA VD TRANS X 10 ML', 10, 1, 'frasco_ampola'],
    ['Glatus 3 canetas, volume sem "X"', '100 UI/ML SOL INJ CT 3 CAR VD TRANS 3 ML + 3 CAN APLIC', 3, 3, 'caneta'],
    ['ampolas', '5,0 MG/ML SOL INJ CT 5 AMP VD AMB X 2 ML', 2, 5, 'ampola'],
    ['caneta preenchida por extenso', '160 MG/ML SOL INJ CT 2 CANETAS PREENC X 1 ML', 1, 2, 'caneta'],
    ['FR AMP = frasco-ampola', '5 MG/ML SOL DIL INJ CT FR AMP VD TRANS X 1 ML', 1, 1, 'frasco_ampola'],
  ])('%s', (_label, text, volumeMl, units, container) => {
    expect(packageFromText(text, 'injetavel')).toEqual({ volumeMl, units, container })
  })

  it('líquido: volume do frasco, não o do copo dosador; sem embalagem', () => {
    expect(packageFromText('6 MG / ML XPE CT FR PLAS PET AMB X 120 ML + COP X 10 ML', 'liquido')).toEqual({ volumeMl: 120, units: 1, container: null })
  })
  it('líquido em caixa hospitalar: volume por frasco e nº de frascos', () => {
    expect(packageFromText('3 MG/ML XPE CX 60 FR PLAS PET AMB X 100 ML + 60 COP', 'liquido')).toEqual({ volumeMl: 100, units: 60, container: null })
  })
  it('colírio sem CT: um frasco', () => {
    expect(packageFromText('50 MG/ML SOL OFT FR GOT PLAS PE TRANS X 10 ML', 'liquido')).toEqual({ volumeMl: 10, units: 1, container: null })
  })
  it('kit de dois remédios com volumes diferentes: volume ambíguo fica vazio', () => {
    const kit = '(100,0 + 100,0) MG/ML SOL INJ IM CT 3 AMP VD AMB X 1 ML + (5,0 + 4,37) MG SOL INJ IM 3 AMP VD AMB X 2 ML'
    expect(packageFromText(kit, 'injetavel').volumeMl).toBeNull()
  })
  it('FR simples injetável (soro/hospital) não vira embalagem', () => {
    expect(packageFromText('9 MG/ML SOL INJ IV CX 50 FR PLAS PP TRANS SIST FECH X 125 ML', 'injetavel')).toEqual({ volumeMl: 125, units: 50, container: null })
  })
  it('litros, gramas, jatos e doses não viram volume em mL', () => {
    expect(packageFromText('14,7 MG/ML SOL INFUS CX ENVOL 8 BOLS PLAS PP TRANS SIST FECH X 1,5 L', 'liquido').volumeMl).toBeNull()
    expect(packageFromText('0,562 G/G PO SOL FR PLAS OPC X 174 G', 'liquido').volumeMl).toBeNull()
    expect(packageFromText('50 MCG SUS SPR NAS CT FR SPR PLAS PEAD OPC X 60 ACIONAMENTOS', 'liquido').volumeMl).toBeNull()
  })
  it('a concentração "MG/ML" nunca é lida como volume', () => {
    expect(packageFromText('100 MG/ML SOL INJ CT SER PREENC VD TRANS + ADAPT + AGU', 'injetavel').volumeMl).toBeNull()
  })
  it('sólido não tem pacote de volume', () => {
    expect(packageFromText('500 MG COM REV CT BL AL PLAS PVC TRANS X 21', 'comprimido')).toEqual({ volumeMl: null, units: null, container: null })
  })
  it('texto vazio ou nulo', () => {
    expect(packageFromText('', 'injetavel')).toEqual({ volumeMl: null, units: null, container: null })
    expect(packageFromText(null, 'liquido')).toEqual({ volumeMl: null, units: null, container: null })
  })
})

describe('presentationFromRow — contenção do C-11 (oral marcado injetável no índice)', () => {
  it.each([
    ['suspensão oral com seringa dosadora', '1 MG/ML SUS OR CT FR PLAS PET AMB X 150 ML + SER DOS'],
    ['xarope', '6 MG/ML XPE CT FR PLAS AMB X 120 ML + SER DOS'],
    ['gotas', '10 MG/ML SOL GOT CT FR PLAS X 20 ML'],
    ['solução oral', '0,75 MG/ML PO SOL OR CT FR VD AMB X 80 ML + 2 SER DOS X 6 ML'],
  ])('%s ⇒ liquido', (_label, text) => {
    expect(presentationFromRow('injetavel', text)).toBe('liquido')
  })
  it('injetável de verdade continua injetável', () => {
    expect(presentationFromRow('injetavel', '15 MG/ML SOL INJ SC CT 4 FA VD TRANS X 0,5 ML')).toBe('injetavel')
    expect(presentationFromRow('injetavel', '1,34 MG/ML SOL INJ CT X 1 CAR VD TRANS X 1,5 ML + 1 SIST APLIC PLAS')).toBe('injetavel')
  })
  it('injetável que também cita via oral mas tem INJ continua injetável', () => {
    expect(presentationFromRow('injetavel', '50 MG/ML PO SOL INJ OR CT FR VD X 10 ML')).toBe('injetavel')
  })
  it('as outras formas passam intactas; desconhecida ou nula ⇒ outro', () => {
    expect(presentationFromRow('comprimido', '500 MG COM CT BL X 21')).toBe('comprimido')
    expect(presentationFromRow('liquido', 'XPE CT FR X 100 ML')).toBe('liquido')
    expect(presentationFromRow('xyz', '')).toBe('outro')
    expect(presentationFromRow(null, 'SOL INJ')).toBe('outro')
  })
})
