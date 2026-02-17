import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2 } from '../formatters.js';

describe('escapeMarkdownV2', () => {
  describe('casos básicos', () => {
    it.each([
      [null, ''],
      [undefined, ''],
      ['', ''],
      ['texto simples', 'texto simples'],
      ['Texto Com Espaços', 'Texto Com Espaços'],
      ['Açãoção', 'Açãoção'],
      ['💊 Remédio', '💊 Remédio'],
      [123, ''],
      [{}, ''],
      [[], '']
    ])('caso %s retorna %s', (input, expected) => {
      expect(escapeMarkdownV2(input)).toBe(expected);
    });
  });

  describe('caracteres reservados únicos', () => {
    it.each([
      ['!', '\\!'],
      ['.', '\\.'],
      ['_', '\\_'],
      ['*', '\\*'],
      ['[', '\\['],
      [']', '\\]'],
      ['(', '\\('],
      [')', '\\)'],
      ['~', '\\~'],
      ['`', '\\`'],
      ['>', '\\>'],
      ['#', '\\#'],
      ['+', '\\+'],
      ['-', '\\-'],
      ['=', '\\='],
      ['|', '\\|'],
      ['{', '\\{'],
      ['}', '\\}'],
      ['\\', '\\\\']
    ])('escapar "%s" retorna "%s"', (input, expected) => {
      expect(escapeMarkdownV2(input)).toBe(expected);
    });
  });

  describe('números decimais', () => {
    it.each([
      ['1.5', '1\\.5'],
      ['2.5mg', '2\\.5mg'],
      ['0.25', '0\\.25'],
      ['100.50', '100\\.50'],
      ['Tomar 1.5 comprimidos', 'Tomar 1\\.5 comprimidos'],
      ['Dose: 2.5mg/dia', 'Dose: 2\\.5mg/dia'],
      ['0.5 ml', '0\\.5 ml']
    ])('escapar "%s" retorna "%s"', (input, expected) => {
      expect(escapeMarkdownV2(input)).toBe(expected);
    });
  });

  describe('abreviações com ponto', () => {
    it.each([
      ['Dr. Silva', 'Dr\\. Silva'],
      ['Sr. João', 'Sr\\. João'],
      ['Sra. Maria', 'Sra\\. Maria'],
      ['Av. Paulista', 'Av\\. Paulista'],
      ['Prof. Carlos', 'Prof\\. Carlos'],
      ['etc.', 'etc\\.'],
      ['1.500 pessoas', '1\\.500 pessoas'],
      ['Fim.', 'Fim\\.']
    ])('escapar "%s" retorna "%s"', (input, expected) => {
      expect(escapeMarkdownV2(input)).toBe(expected);
    });
  });

  describe('frases completas', () => {
    it.each([
      ['Omega 3!', 'Omega 3\\!'],
      ['Vitamina D3 + K2', 'Vitamina D3 \\+ K2'],
      ['Tomar 2.5mg (meio comprimido).', 'Tomar 2\\.5mg \\(meio comprimido\\)\\.'],
      ['Cuidado! Não exceder a dose.', 'Cuidado\\! Não exceder a dose\\.'],
      ['Remédio [Genérico]', 'Remédio \\[Genérico\\]'],
      ['Tomar pela manhã > noite', 'Tomar pela manhã \\> noite'],
      ['Item #12345', 'Item \\#12345'],
      ['Lista: item-1, item-2', 'Lista: item\\-1, item\\-2'],
      ['Dose = 500mg', 'Dose \\= 500mg'],
      ['Opção A | Opção B', 'Opção A \\| Opção B'],
      ['Variável {nome}', 'Variável \\{nome\\}'],
      ['Pressão `alta`', 'Pressão \\`alta\\`'],
      ['Texto ~riscado~', 'Texto \\~riscado\\~'],
      ['~5 dias restantes', '\\~5 dias restantes']
    ])('escapar "%s" retorna "%s"', (input, expected) => {
      expect(escapeMarkdownV2(input)).toBe(expected);
    });
  });

  describe('casos de borda', () => {
    it.each([
      [
        '_*[]()~`>#+-=|{}.!',
        '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!'
      ],
      ['\\!', '\\\\\\!'],
      ['\\\\', '\\\\\\\\'],
      [
        'Dr. Silva (CRM 12345) - Especialista!',
        'Dr\\. Silva \\(CRM 12345\\) \\- Especialista\\!'
      ],
      ['Linha 1\nLinha 2!', 'Linha 1\nLinha 2\\!'],
      ['Omega 3 (1000mg)', 'Omega 3 \\(1000mg\\)'],
      [
        'Medicação #1 (2.5mg) + Vit. C!',
        'Medicação \\#1 \\(2\\.5mg\\) \\+ Vit\\. C\\!'
      ]
    ])('escapar "%s" retorna "%s"', (input, expected) => {
      expect(escapeMarkdownV2(input)).toBe(expected);
    });
  });
});
