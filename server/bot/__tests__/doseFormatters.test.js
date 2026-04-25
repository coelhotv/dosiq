import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDoseGroupedByPlanMessage,
  formatDoseGroupedMiscMessage,
  getTimeOfDayEmoji,
} from '../utils/doseFormatters.js';

/**
 * Helper para criar uma dose fixture para testes.
 * @param {string|number} id - Identificador único
 * @param {string} medicineName - Nome do medicamento
 * @param {number} dosagePerIntake - Dosagem por ingestão
 * @returns {Object} DoseEntry
 */
function makeDose(id, medicineName, dosagePerIntake = 1) {
  return {
    protocolId: `proto-${id}`,
    protocolName: `Protocol-${id}`,
    medicineName,
    treatmentPlanId: null,
    treatmentPlanName: null,
    dosagePerIntake,
    medicineId: `med-${id}`,
  };
}

describe('getTimeOfDayEmoji', () => {
  test('Hora 8 (manhã) → 🌅', () => {
    const emoji = getTimeOfDayEmoji(8);
    assert.strictEqual(emoji, '🌅');
  });

  test('Hora 12 (meio-dia) → 🍽️', () => {
    const emoji = getTimeOfDayEmoji(12);
    assert.strictEqual(emoji, '🍽️');
  });

  test('Hora 15 (tarde) → ☕', () => {
    const emoji = getTimeOfDayEmoji(15);
    assert.strictEqual(emoji, '☕');
  });

  test('Hora 20 (noite) → 🌆', () => {
    const emoji = getTimeOfDayEmoji(20);
    assert.strictEqual(emoji, '🌆');
  });

  test('Hora 0 (madrugada) → 🌙', () => {
    const emoji = getTimeOfDayEmoji(0);
    assert.strictEqual(emoji, '🌙');
  });
});

describe('formatDoseGroupedByPlanMessage', () => {
  test('4 doses — contém planName, scheduledTime, contagem, medicamentos', () => {
    const doses = [
      makeDose(1, 'Atorvastatina'),
      makeDose(2, 'SeloZok'),
      makeDose(3, 'Vitamina D'),
      makeDose(4, 'Cálcio'),
    ];

    const message = formatDoseGroupedByPlanMessage('Quarteto Fantástico', doses, '08:00', 8);

    assert.ok(message.includes('Quarteto Fantástico'));
    assert.ok(message.includes('08:00'));
    assert.ok(message.includes('4 medicamentos'));
    assert.ok(message.includes('Atorvastatina'));
    assert.ok(message.includes('SeloZok'));
    assert.ok(message.includes('Vitamina D'));
    assert.ok(message.includes('Cálcio'));
    assert.ok(!message.includes('… e mais'), 'Não deve conter "… e mais" com 4 doses');
  });

  test('12 doses — trunca para 10 e mostra "… e mais 2"', () => {
    const doses = Array.from({ length: 12 }, (_, i) =>
      makeDose(i + 1, `Medicamento ${i + 1}`)
    );

    const message = formatDoseGroupedByPlanMessage('Plano Grande', doses, '09:00', 9);

    assert.ok(message.includes('12 medicamentos'));
    assert.ok(message.includes('… e mais 2'));
  });

  test('Dose com dosagePerIntake=0 usa ?? (não converte para 1)', () => {
    const doses = [
      makeDose(1, 'Medicamento A', 0),
      makeDose(2, 'Medicamento B', 2),
    ];

    const message = formatDoseGroupedByPlanMessage('Plano Teste', doses, '10:00', 10);

    // Verifica que 0 é preservado e não convertido para 1
    assert.ok(message.includes('0 cp'), 'Deve conter "0 cp" para dosagePerIntake=0');
    assert.ok(message.includes('2 cp'), 'Deve conter "2 cp" para dosagePerIntake=2');
  });

  test('planName com caracteres especiais é escapado', () => {
    const doses = [makeDose(1, 'Medicamento'), makeDose(2, 'Outro')];

    const message = formatDoseGroupedByPlanMessage('Plano "Especial" & Teste!', doses, '11:00', 11);

    // Verifica que caracteres especiais foram escapados (backslash)
    assert.ok(message.includes('\\'));
  });
});

describe('formatDoseGroupedMiscMessage', () => {
  test('2 doses — contém contagem, medicamentos, "pendentes" (plural)', () => {
    const doses = [makeDose(1, 'Ômega 3'), makeDose(2, 'Trimebutina')];

    const message = formatDoseGroupedMiscMessage(doses, '08:00', 8);

    assert.ok(message.includes('2 medicamentos'));
    assert.ok(message.includes('pendentes'));
    assert.ok(message.includes('Ômega 3'));
    assert.ok(message.includes('Trimebutina'));
  });

  test('1 dose — usa singular "medicamento" e "pendente"', () => {
    const doses = [makeDose(1, 'Medicamento Único')];

    const message = formatDoseGroupedMiscMessage(doses, '09:00', 9);

    assert.ok(message.includes('1 medicamento'));
    assert.ok(message.includes('pendente'));
    assert.ok(!message.includes('medicamentos'), 'Não deve conter plural "medicamentos"');
    assert.ok(!message.includes('pendentes'), 'Não deve conter plural "pendentes"');
  });

  test('12 doses — trunca para 10 e mostra "… e mais 2"', () => {
    const doses = Array.from({ length: 12 }, (_, i) =>
      makeDose(i + 1, `Medicamento ${i + 1}`)
    );

    const message = formatDoseGroupedMiscMessage(doses, '10:00', 10);

    assert.ok(message.includes('12 medicamentos'));
    assert.ok(message.includes('… e mais 2'));
  });

  test('Dose com dosagePerIntake=0 usa ?? (não converte para 1)', () => {
    const doses = [
      makeDose(1, 'Medicamento A', 0),
      makeDose(2, 'Medicamento B', 1),
    ];

    const message = formatDoseGroupedMiscMessage(doses, '11:00', 11);

    assert.ok(message.includes('0 cp'), 'Deve conter "0 cp" para dosagePerIntake=0');
    assert.ok(message.includes('1 cp'), 'Deve conter "1 cp" para dosagePerIntake=1');
  });

  test('scheduledTime é incorporado na mensagem', () => {
    const doses = [makeDose(1, 'Medicamento')];

    const message = formatDoseGroupedMiscMessage(doses, '14:30', 14);

    assert.ok(message.includes('14:30'));
  });

  test('Medicamento com caracteres especiais é escapado', () => {
    const doses = [
      makeDose(1, 'Medicamento & Teste!'),
      makeDose(2, 'Outro_Medicamento'),
    ];

    const message = formatDoseGroupedMiscMessage(doses, '12:00', 12);

    // Verifica que caracteres especiais foram escapados
    assert.ok(message.includes('\\'));
  });
});
