// 066 Slice E (C-7) — unidade da tomada deduzida do texto da apresentação CMED. Casos com o texto REAL do
// índice v1.1.19 (medição de 2026-10-18), incluindo os que forçaram a ordem das regras.

import { describe, it, expect } from 'vitest'
import { defaultIntakeUnitFor, intakeUnitFromPresentation } from '../cmedIntakeUnit'

describe('intakeUnitFromPresentation', () => {
  it.each([
    ['Tobradex (colírio)', '3,0 MG/ML + 1,0 MG/ML SUS OFT CT FR GOT PLAS TRANS X 5 ML', 'mg/ml', 'liquido', 'gotas'],
    ['dipirona gotas', '500 MG/ML SOL OR CT FR GOT PLAS OPC  X 20 ML', 'mg/ml', 'liquido', 'gotas'],
    ['vitamina D em gotas (ui/ml): gotas vem antes de UI', '14000 UI/ML SOL OR CT FR GOT VD AMB X 10 ML', 'ui/ml', 'liquido', 'gotas'],
    ['nasal com conta-gotas', '0,5 MG/ML SOL NAS CT FR PLAS OPC CGT X 10 ML', 'mg/ml', 'liquido', 'gotas'],
    ['insulina', '100 U/ML SOL INJ CT 1 CAR VD TRANS X 3 ML + 1 CAN APLIC', 'ui/ml', 'injetavel', 'UI'],
    ['Mounjaro (GLP-1 prescrito em mg)', '15 MG/ML SOL INJ SC CT 4 FA VD TRANS X 0,5 ML', 'mg/ml', 'injetavel', 'mg'],
    ['Ozempic', '1,34 MG/ML SOL INJ CT X 1 CAR VD TRANS X 1,5 ML + 1 SIST APLIC PLAS', 'mg/ml', 'injetavel', 'mg'],
    ['dipirona injetável (ampola) não vira gotas', '500 MG/ML SOL INJ CT 120 AMP VD AMB  X 2 ML', 'mg/ml', 'injetavel', 'mg'],
    ['xarope', '3 MG/ML XPE CT FR VD AMB X 100 ML + COP', 'mg/ml', 'liquido', 'ml'],
    ['suspensão oral com seringa dosadora', '1 MG/ML SUS OR CT FR PLAS PET AMB X 100 ML + SER DOS', 'mg/ml', 'liquido', 'ml'],
    ['granulado pediátrico (Klaricid)', '50 MG/ML GRAN SUS PED CT FR PLAS OPC X 60 ML + SER DOS + ADAPT', 'mg/ml', 'liquido', 'ml'],
    ['spray sem regra → padrão do form completo', '10 MG/ML SOL SPRAY CT TB PLAS PEAD OPC X 50 ML', 'mg/ml', 'liquido', 'gotas'],
  ])('%s', (_label, text, dosageUnit, presentation, expected) => {
    expect(intakeUnitFromPresentation(text, dosageUnit, presentation)).toBe(expected)
  })

  it('não líquido (comprimido, seringa de dose única em mg) → null', () => {
    expect(intakeUnitFromPresentation('50 MG COM REV CT BL AL PLAS PVC TRANS X 30', 'mg', 'comprimido')).toBeNull()
    expect(intakeUnitFromPresentation('40 MG SOL INJ CT 2 SER PREENC VD TRANS GRAD X 0,4 ML', 'mg', 'injetavel')).toBeNull()
  })

  it('texto ausente cai no padrão; nunca lança', () => {
    expect(intakeUnitFromPresentation(null, 'mg/ml', 'liquido')).toBe('gotas')
    expect(intakeUnitFromPresentation(undefined, 'ui/ml', null)).toBe('UI')
    expect(intakeUnitFromPresentation('', null, null)).toBeNull()
  })
})

describe('defaultIntakeUnitFor (o mesmo padrão do form completo de tratamento)', () => {
  it.each([
    ['mg/ml', 'gotas'],
    ['ui/ml', 'UI'],
    ['mg', null],
    [null, null],
  ])('%s → %s', (dosageUnit, expected) => {
    expect(defaultIntakeUnitFor(dosageUnit)).toBe(expected)
  })
})
