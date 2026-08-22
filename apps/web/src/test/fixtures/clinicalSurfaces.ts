/**
 * Fixture compartilhado das superfícies clínicas (spec 073 PR 2 — T025).
 *
 * As duas superfícies corrigidas (cartão de emergência e modo consulta) falhavam pelo
 * MESMO trio de defeitos: vigência ignorada, colapso por `medicine_id` e produto cruzado
 * na posologia. Nenhum deles é visível com o fixture de 1 protocolo por medicamento que os
 * testes usavam — por isso o cenário canônico vive aqui e é importado pelos dois lados.
 *
 * ⚠️ Datas são RELATIVAS a hoje de propósito: o predicado de vigência (`isProtocolVigentOn`)
 * vem do core, que usa o relógio real e NÃO é mockado nestes testes. Data fixa vira bomba-
 * relógio (o teste passa hoje e quebra na virada do ano).
 *
 * @module clinicalSurfaces
 */

import { getTodayLocal, parseLocalDate, formatLocalDate } from '@dosiq/core'

/** Data local YYYY-MM-DD deslocada em `days` a partir de hoje (R-020: nada de `new Date(str)`). */
export function dateOffset(days: number): string {
  const d = parseLocalDate(getTodayLocal())
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

export const TODAY = getTodayLocal()

/** Paracetamol 500 mg/comprimido — o medicamento com DOIS tratamentos vigentes. */
export const MEDICINE_SOLID = Object.freeze({
  id: 'med-solid',
  name: 'Paracetamol',
  type: 'medicamento',
  presentation: 'comprimido',
  dosage_per_pill: 500,
  dosage_unit: 'mg',
  notes: null,
  min_stock_threshold: 5,
})

/** Ozempic 2,68 mg/mL — líquido semanal (cadência não-diária + unidade de tomada). */
export const MEDICINE_LIQUID = Object.freeze({
  id: 'med-liquid',
  name: 'Ozempic',
  type: 'medicamento',
  presentation: 'injetavel',
  dosage_per_pill: 2.68,
  dosage_unit: 'mg/ml',
  units_per_ml: null,
  notes: null,
  min_stock_threshold: 1,
})

/** Dipirona — o medicamento cujo ÚNICO tratamento está VENCIDO (não pode aparecer). */
export const MEDICINE_EXPIRED = Object.freeze({
  id: 'med-expired',
  name: 'Dipirona',
  type: 'medicamento',
  presentation: 'comprimido',
  dosage_per_pill: 1000,
  dosage_unit: 'mg',
  notes: null,
  min_stock_threshold: 5,
})

/** 500 mg, 2×/dia — 1º tratamento vigente do Paracetamol. */
export const PROTOCOL_SOLID_MORNING = Object.freeze({
  id: 'prot-solid-1',
  medicine_id: MEDICINE_SOLID.id,
  medicine_name: MEDICINE_SOLID.name,
  active: true,
  frequency: 'diário',
  time_schedule: ['08:00', '20:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  start_date: dateOffset(-30),
  end_date: dateOffset(30),
})

/** 500 mg, 1×/dia — 2º tratamento vigente do MESMO medicamento (o que o `Map` engolia). */
export const PROTOCOL_SOLID_EXTRA = Object.freeze({
  id: 'prot-solid-2',
  medicine_id: MEDICINE_SOLID.id,
  medicine_name: MEDICINE_SOLID.name,
  active: true,
  frequency: 'diário',
  time_schedule: ['14:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  start_date: dateOffset(-10),
  end_date: dateOffset(60),
})

/** Semanal: 1 aplicação de 0,9 mL por semana (fator 1/7 — não é 0,9/dia). */
export const PROTOCOL_LIQUID_WEEKLY = Object.freeze({
  id: 'prot-liquid-weekly',
  medicine_id: MEDICINE_LIQUID.id,
  medicine_name: MEDICINE_LIQUID.name,
  active: true,
  frequency: 'semanal',
  time_schedule: ['09:00'],
  dosage_per_intake: 0.9,
  intake_unit: 'ml',
  start_date: dateOffset(-60),
  end_date: dateOffset(90),
})

/** `active: true`, mas `end_date` ONTEM — o vazamento que o `p.active` solto permitia. */
export const PROTOCOL_EXPIRED = Object.freeze({
  id: 'prot-expired',
  medicine_id: MEDICINE_EXPIRED.id,
  medicine_name: MEDICINE_EXPIRED.name,
  active: true,
  frequency: 'diário',
  time_schedule: ['12:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  start_date: dateOffset(-90),
  end_date: dateOffset(-1),
})

/** Cenário completo: 2 vigentes do mesmo medicamento + 1 líquido semanal + 1 vencido. */
export const CLINICAL_MEDICINES = [MEDICINE_SOLID, MEDICINE_LIQUID, MEDICINE_EXPIRED]
export const CLINICAL_PROTOCOLS = [
  PROTOCOL_SOLID_MORNING,
  PROTOCOL_SOLID_EXTRA,
  PROTOCOL_LIQUID_WEEKLY,
  PROTOCOL_EXPIRED,
]
