// Migrado de node:test → vitest (Gate 6 — R-276)
// Vitest é o test runner canônico deste projeto. node:test não é reconhecido pelo vitest.

import { describe, it, expect } from 'vitest'
import { partitionDoses } from '../utils/partitionDoses.js'

/**
 * Helper para criar uma dose fixture para testes.
 */
function makeDose(id, medicineName, treatmentPlanId = null, treatmentPlanName = null) {
  return {
    protocolId: `proto-${id}`,
    protocolName: `Protocol-${id}`,
    medicineName,
    treatmentPlanId,
    treatmentPlanName,
    dosagePerIntake: 1,
    medicineId: `med-${id}`,
  }
}

describe('partitionDoses', () => {
  it('caso vazio — array vazio retorna array vazio', () => {
    expect(partitionDoses([])).toHaveLength(0)
  })

  it('Cenário A — 8 doses sem plano → 1 bloco misc', () => {
    const doses = Array.from({ length: 8 }, (_, i) => makeDose(i + 1, `Medicamento ${i + 1}`))
    const result = partitionDoses(doses)

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('misc')
    expect(result[0].planId).toBeNull()
    expect(result[0].planName).toBeNull()
    expect(result[0].doses).toHaveLength(8)
  })

  it('Cenário B — 4 doses do mesmo plano → 1 bloco by_plan', () => {
    const doses = Array.from({ length: 4 }, (_, i) => makeDose(i + 1, `Medicamento ${i + 1}`, 'plan-A', 'Plano A'))
    const result = partitionDoses(doses)

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('by_plan')
    expect(result[0].planId).toBe('plan-A')
    expect(result[0].planName).toBe('Plano A')
    expect(result[0].doses).toHaveLength(4)
  })

  it('Cenário C — 4 doses plano A + 2 avulsas → 2 blocos: by_plan + misc', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Medicamento 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Medicamento 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Medicamento 5'),
      makeDose(6, 'Medicamento 6'),
    ]
    const result = partitionDoses(doses)

    expect(result).toHaveLength(2)

    const byPlanBlock = result.find(b => b.kind === 'by_plan')
    expect(byPlanBlock).toBeDefined()
    expect(byPlanBlock.planId).toBe('plan-A')
    expect(byPlanBlock.doses).toHaveLength(4)

    const miscBlock = result.find(b => b.kind === 'misc')
    expect(miscBlock).toBeDefined()
    expect(miscBlock.doses).toHaveLength(2)
  })

  it('Cenário D — 4 doses plano A + 3 doses plano B → 2 blocos by_plan', () => {
    const doses = [
      makeDose(1, 'Med 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Med 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Med 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Med 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Med 5', 'plan-B', 'Plano B'),
      makeDose(6, 'Med 6', 'plan-B', 'Plano B'),
      makeDose(7, 'Med 7', 'plan-B', 'Plano B'),
    ]
    const result = partitionDoses(doses)

    expect(result).toHaveLength(2)

    const blockA = result.find(b => b.planId === 'plan-A')
    expect(blockA?.kind).toBe('by_plan')
    expect(blockA?.doses).toHaveLength(4)

    const blockB = result.find(b => b.planId === 'plan-B')
    expect(blockB?.kind).toBe('by_plan')
    expect(blockB?.doses).toHaveLength(3)
  })

  it('Cenário E — 4 plano A + 3 plano B + 2 avulsas → 3 blocos: 2 by_plan + 1 misc', () => {
    const doses = [
      makeDose(1, 'Med 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Med 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Med 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Med 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Med 5', 'plan-B', 'Plano B'),
      makeDose(6, 'Med 6', 'plan-B', 'Plano B'),
      makeDose(7, 'Med 7', 'plan-B', 'Plano B'),
      makeDose(8, 'Med 8'),
      makeDose(9, 'Med 9'),
    ]
    const result = partitionDoses(doses)

    expect(result).toHaveLength(3)
    expect(result.filter(b => b.kind === 'by_plan')).toHaveLength(2)

    const miscBlock = result.find(b => b.kind === 'misc')
    expect(miscBlock).toBeDefined()
    expect(miscBlock.doses).toHaveLength(2)
  })

  it('Cenário F — 4 plano A + 3 plano B + 1 avulsa → 3 blocos: 2 by_plan + 1 individual', () => {
    const doses = [
      makeDose(1, 'Med 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Med 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Med 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Med 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Med 5', 'plan-B', 'Plano B'),
      makeDose(6, 'Med 6', 'plan-B', 'Plano B'),
      makeDose(7, 'Med 7', 'plan-B', 'Plano B'),
      makeDose(8, 'Med 8'),
    ]
    const result = partitionDoses(doses)

    expect(result).toHaveLength(3)
    expect(result.filter(b => b.kind === 'by_plan')).toHaveLength(2)

    const individualBlock = result.find(b => b.kind === 'individual')
    expect(individualBlock).toBeDefined()
    expect(individualBlock.doses).toHaveLength(1)
  })

  it('Cenário G — 1 dose plano A + 1 dose plano B → 2 individuais', () => {
    const doses = [
      makeDose(1, 'Med 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Med 2', 'plan-B', 'Plano B'),
    ]
    const result = partitionDoses(doses)

    expect(result).toHaveLength(2)
    expect(result.every(b => b.kind === 'individual')).toBe(true)

    const planABlock = result.find(b => b.planId === 'plan-A')
    expect(planABlock?.planName).toBe('Plano A')
    expect(planABlock?.doses).toHaveLength(1)

    const planBBlock = result.find(b => b.planId === 'plan-B')
    expect(planBBlock?.planName).toBe('Plano B')
    expect(planBBlock?.doses).toHaveLength(1)
  })

  it('Cenário H — 1 dose única com plano → 1 individual', () => {
    const result = partitionDoses([makeDose(1, 'Med 1', 'plan-A', 'Plano A')])

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('individual')
    expect(result[0].doses).toHaveLength(1)
  })

  it('Cenário I — 1 dose única sem plano → 1 individual', () => {
    const result = partitionDoses([makeDose(1, 'Med 1')])

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('individual')
    expect(result[0].planId).toBeNull()
    expect(result[0].planName).toBeNull()
    expect(result[0].doses).toHaveLength(1)
  })
})
