import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { partitionDoses } from '../utils/partitionDoses.js';

/**
 * Helper para criar uma dose fixture para testes.
 * @param {string|number} id - Identificador único
 * @param {string} medicineName - Nome do medicamento
 * @param {string|null} treatmentPlanId - ID do plano de tratamento (opcional)
 * @param {string|null} treatmentPlanName - Nome do plano de tratamento (opcional)
 * @returns {Object} DoseEntry
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
  };
}

describe('partitionDoses', () => {
  test('Caso vazio — array vazio retorna array vazio', () => {
    const result = partitionDoses([]);
    assert.strictEqual(result.length, 0);
  });

  test('Cenário A — 8 doses sem plano → 1 bloco misc', () => {
    const doses = [
      makeDose(1, 'Medicamento 1'),
      makeDose(2, 'Medicamento 2'),
      makeDose(3, 'Medicamento 3'),
      makeDose(4, 'Medicamento 4'),
      makeDose(5, 'Medicamento 5'),
      makeDose(6, 'Medicamento 6'),
      makeDose(7, 'Medicamento 7'),
      makeDose(8, 'Medicamento 8'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, 'misc');
    assert.strictEqual(result[0].planId, null);
    assert.strictEqual(result[0].planName, null);
    assert.strictEqual(result[0].doses.length, 8);
  });

  test('Cenário B — 4 doses do mesmo plano → 1 bloco by_plan', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Medicamento 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Medicamento 4', 'plan-A', 'Plano A'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, 'by_plan');
    assert.strictEqual(result[0].planId, 'plan-A');
    assert.strictEqual(result[0].planName, 'Plano A');
    assert.strictEqual(result[0].doses.length, 4);
  });

  test('Cenário C — 4 doses plano A + 2 avulsas → 2 blocos: by_plan + misc', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Medicamento 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Medicamento 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Medicamento 5'),
      makeDose(6, 'Medicamento 6'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 2);

    const byPlanBlock = result.find(b => b.kind === 'by_plan');
    assert.ok(byPlanBlock);
    assert.strictEqual(byPlanBlock.planId, 'plan-A');
    assert.strictEqual(byPlanBlock.doses.length, 4);

    const miscBlock = result.find(b => b.kind === 'misc');
    assert.ok(miscBlock);
    assert.strictEqual(miscBlock.doses.length, 2);
  });

  test('Cenário D — 4 doses plano A + 3 doses plano B → 2 blocos by_plan', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Medicamento 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Medicamento 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Medicamento 5', 'plan-B', 'Plano B'),
      makeDose(6, 'Medicamento 6', 'plan-B', 'Plano B'),
      makeDose(7, 'Medicamento 7', 'plan-B', 'Plano B'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 2);

    const blockA = result.find(b => b.planId === 'plan-A');
    assert.ok(blockA);
    assert.strictEqual(blockA.kind, 'by_plan');
    assert.strictEqual(blockA.doses.length, 4);

    const blockB = result.find(b => b.planId === 'plan-B');
    assert.ok(blockB);
    assert.strictEqual(blockB.kind, 'by_plan');
    assert.strictEqual(blockB.doses.length, 3);
  });

  test('Cenário E — 4 plano A + 3 plano B + 2 avulsas → 3 blocos: 2 by_plan + 1 misc', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Medicamento 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Medicamento 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Medicamento 5', 'plan-B', 'Plano B'),
      makeDose(6, 'Medicamento 6', 'plan-B', 'Plano B'),
      makeDose(7, 'Medicamento 7', 'plan-B', 'Plano B'),
      makeDose(8, 'Medicamento 8'),
      makeDose(9, 'Medicamento 9'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 3);

    const byPlanBlocks = result.filter(b => b.kind === 'by_plan');
    assert.strictEqual(byPlanBlocks.length, 2);

    const miscBlock = result.find(b => b.kind === 'misc');
    assert.ok(miscBlock);
    assert.strictEqual(miscBlock.doses.length, 2);
  });

  test('Cenário F — 4 plano A + 3 plano B + 1 avulsa → 3 blocos: 2 by_plan + 1 individual', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-A', 'Plano A'),
      makeDose(3, 'Medicamento 3', 'plan-A', 'Plano A'),
      makeDose(4, 'Medicamento 4', 'plan-A', 'Plano A'),
      makeDose(5, 'Medicamento 5', 'plan-B', 'Plano B'),
      makeDose(6, 'Medicamento 6', 'plan-B', 'Plano B'),
      makeDose(7, 'Medicamento 7', 'plan-B', 'Plano B'),
      makeDose(8, 'Medicamento 8'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 3);

    const byPlanBlocks = result.filter(b => b.kind === 'by_plan');
    assert.strictEqual(byPlanBlocks.length, 2);

    const individualBlock = result.find(b => b.kind === 'individual');
    assert.ok(individualBlock);
    assert.strictEqual(individualBlock.doses.length, 1);
  });

  test('Cenário G — 1 dose plano A + 1 dose plano B (cada com 1 dose) → 2 individuais', () => {
    const doses = [
      makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A'),
      makeDose(2, 'Medicamento 2', 'plan-B', 'Plano B'),
    ];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 2);

    const allIndividuals = result.every(b => b.kind === 'individual');
    assert.ok(allIndividuals, 'Todos os blocos devem ser individual');

    const planABlock = result.find(b => b.planId === 'plan-A');
    assert.ok(planABlock);
    assert.strictEqual(planABlock.planName, 'Plano A');
    assert.strictEqual(planABlock.doses.length, 1);

    const planBBlock = result.find(b => b.planId === 'plan-B');
    assert.ok(planBBlock);
    assert.strictEqual(planBBlock.planName, 'Plano B');
    assert.strictEqual(planBBlock.doses.length, 1);
  });

  test('Cenário H — 1 dose única com plano → 1 individual', () => {
    const doses = [makeDose(1, 'Medicamento 1', 'plan-A', 'Plano A')];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, 'individual');
    assert.strictEqual(result[0].doses.length, 1);
  });

  test('Cenário I — 1 dose única sem plano → 1 individual', () => {
    const doses = [makeDose(1, 'Medicamento 1')];

    const result = partitionDoses(doses);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, 'individual');
    assert.strictEqual(result[0].planId, null);
    assert.strictEqual(result[0].planName, null);
    assert.strictEqual(result[0].doses.length, 1);
  });
});
