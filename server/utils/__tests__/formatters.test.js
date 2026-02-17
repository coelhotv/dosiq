import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2 } from '../formatters.js';

describe('escapeMarkdownV2', () => {
  describe('casos básicos', () => {
    it('retorna string vazia para null', () => {
      expect(escapeMarkdownV2(null)).toBe('');
    });

    it('retorna string vazia para undefined', () => {
      expect(escapeMarkdownV2(undefined)).toBe('');
    });

    it('retorna string vazia para string vazia', () => {
      expect(escapeMarkdownV2('')).toBe('');
    });

    it('não altera texto sem caracteres especiais', () => {
      expect(escapeMarkdownV2('texto simples')).toBe('texto simples');
    });

    it('não escapa espaços', () => {
      expect(escapeMarkdownV2('Texto Com Espaços')).toBe('Texto Com Espaços');
    });

    it('não escapa caracteres acentuados', () => {
      expect(escapeMarkdownV2('Açãoção')).toBe('Açãoção');
    });

    it('não escapa emojis', () => {
      expect(escapeMarkdownV2('💊 Remédio')).toBe('💊 Remédio');
    });

    it('retorna string vazia para tipos não-string', () => {
      expect(escapeMarkdownV2(123)).toBe('');
      expect(escapeMarkdownV2({})).toBe('');
      expect(escapeMarkdownV2([])).toBe('');
    });
  });

  describe('caracteres reservados únicos', () => {
    it('escapa exclamação (!)', () => {
      expect(escapeMarkdownV2('!')).toBe('\\!');
    });

    it('escapa ponto (.)', () => {
      expect(escapeMarkdownV2('.')).toBe('\\.');
    });

    it('escapa underscore (_)', () => {
      expect(escapeMarkdownV2('_')).toBe('\\_');
    });

    it('escapa asterisco (*)', () => {
      expect(escapeMarkdownV2('*')).toBe('\\*');
    });

    it('escapa colchete esquerdo ([)', () => {
      expect(escapeMarkdownV2('[')).toBe('\\[');
    });

    it('escapa colchete direito (])', () => {
      expect(escapeMarkdownV2(']')).toBe('\\]');
    });

    it('escapa parêntese esquerdo (()', () => {
      expect(escapeMarkdownV2('(')).toBe('\\(');
    });

    it('escapa parêntese direito ())', () => {
      expect(escapeMarkdownV2(')')).toBe('\\)');
    });

    it('escapa til (~)', () => {
      expect(escapeMarkdownV2('~')).toBe('\\~');
    });

    it('escapa backtick (`)', () => {
      expect(escapeMarkdownV2('`')).toBe('\\`');
    });

    it('escapa maior que (>)', () => {
      expect(escapeMarkdownV2('>')).toBe('\\>');
    });

    it('escapa hash (#)', () => {
      expect(escapeMarkdownV2('#')).toBe('\\#');
    });

    it('escapa mais (+)', () => {
      expect(escapeMarkdownV2('+')).toBe('\\+');
    });

    it('escapa menos/hífen (-)', () => {
      expect(escapeMarkdownV2('-')).toBe('\\-');
    });

    it('escapa igual (=)', () => {
      expect(escapeMarkdownV2('=')).toBe('\\=');
    });

    it('escapa barra vertical (|)', () => {
      expect(escapeMarkdownV2('|')).toBe('\\|');
    });

    it('escapa chave esquerda ({)', () => {
      expect(escapeMarkdownV2('{')).toBe('\\{');
    });

    it('escapa chave direita (})', () => {
      expect(escapeMarkdownV2('}')).toBe('\\}');
    });

    it('escapa backslash (\\) - DEVE ser primeiro', () => {
      expect(escapeMarkdownV2('\\')).toBe('\\\\');
    });
  });

  describe('números decimais', () => {
    it('escapa ponto em número decimal simples', () => {
      expect(escapeMarkdownV2('1.5')).toBe('1\\.5');
    });

    it('escapa ponto em dosagem com unidade', () => {
      expect(escapeMarkdownV2('2.5mg')).toBe('2\\.5mg');
    });

    it('escapa ponto em decimal menor que 1', () => {
      expect(escapeMarkdownV2('0.25')).toBe('0\\.25');
    });

    it('escapa ponto em decimal com centavos', () => {
      expect(escapeMarkdownV2('100.50')).toBe('100\\.50');
    });

    it('escapa ponto em frase com decimal', () => {
      expect(escapeMarkdownV2('Tomar 1.5 comprimidos')).toBe('Tomar 1\\.5 comprimidos');
    });

    it('escapa ponto em dosagem com barra', () => {
      expect(escapeMarkdownV2('Dose: 2.5mg/dia')).toBe('Dose: 2\\.5mg/dia');
    });

    it('escapa ponto em dosagem em ml', () => {
      expect(escapeMarkdownV2('0.5 ml')).toBe('0\\.5 ml');
    });
  });

  describe('abreviações com ponto', () => {
    it('escapa ponto em abreviação Dr.', () => {
      expect(escapeMarkdownV2('Dr. Silva')).toBe('Dr\\. Silva');
    });

    it('escapa ponto em abreviação Sr.', () => {
      expect(escapeMarkdownV2('Sr. João')).toBe('Sr\\. João');
    });

    it('escapa ponto em abreviação Sra.', () => {
      expect(escapeMarkdownV2('Sra. Maria')).toBe('Sra\\. Maria');
    });

    it('escapa ponto em abreviação Av.', () => {
      expect(escapeMarkdownV2('Av. Paulista')).toBe('Av\\. Paulista');
    });

    it('escapa ponto em abreviação Prof.', () => {
      expect(escapeMarkdownV2('Prof. Carlos')).toBe('Prof\\. Carlos');
    });

    it('escapa ponto em abreviação etc.', () => {
      expect(escapeMarkdownV2('etc.')).toBe('etc\\.');
    });

    it('escapa ponto em número com ponto de milhar', () => {
      expect(escapeMarkdownV2('1.500 pessoas')).toBe('1\\.500 pessoas');
    });

    it('escapa ponto final simples', () => {
      expect(escapeMarkdownV2('Fim.')).toBe('Fim\\.');
    });
  });

  describe('frases completas', () => {
    it('escapa exclamação em nome de medicamento', () => {
      expect(escapeMarkdownV2('Omega 3!')).toBe('Omega 3\\!');
    });

    it('escapa soma em nome de vitamina', () => {
      expect(escapeMarkdownV2('Vitamina D3 + K2')).toBe('Vitamina D3 \\+ K2');
    });

    it('escapa frase complexa com decimal, parênteses e ponto', () => {
      expect(escapeMarkdownV2('Tomar 2.5mg (meio comprimido).')).toBe('Tomar 2\\.5mg \\(meio comprimido\\)\\.');
    });

    it('escapa aviso com exclamação e ponto', () => {
      expect(escapeMarkdownV2('Cuidado! Não exceder a dose.')).toBe('Cuidado\\! Não exceder a dose\\.');
    });

    it('escapa colchetes em nome genérico', () => {
      expect(escapeMarkdownV2('Remédio [Genérico]')).toBe('Remédio \\[Genérico\\]');
    });

    it('escapa maior que em comparação', () => {
      expect(escapeMarkdownV2('Tomar pela manhã > noite')).toBe('Tomar pela manhã \\> noite');
    });

    it('escapa hash em referência', () => {
      expect(escapeMarkdownV2('Item #12345')).toBe('Item \\#12345');
    });

    it('escapa hífens em lista', () => {
      expect(escapeMarkdownV2('Lista: item-1, item-2')).toBe('Lista: item\\-1, item\\-2');
    });

    it('escapa igual em equação', () => {
      expect(escapeMarkdownV2('Dose = 500mg')).toBe('Dose \\= 500mg');
    });

    it('escapa barra vertical em separador', () => {
      expect(escapeMarkdownV2('Opção A | Opção B')).toBe('Opção A \\| Opção B');
    });

    it('escapa chaves em placeholder', () => {
      expect(escapeMarkdownV2('Variável {nome}')).toBe('Variável \\{nome\\}');
    });

    it('escapa backticks em código inline', () => {
      expect(escapeMarkdownV2('Pressão `alta`')).toBe('Pressão \\`alta\\`');
    });

    it('escapa til em texto tachado', () => {
      expect(escapeMarkdownV2('Texto ~riscado~')).toBe('Texto \\~riscado\\~');
    });

    it('escapa til como "aproximadamente"', () => {
      expect(escapeMarkdownV2('~5 dias restantes')).toBe('\\~5 dias restantes');
    });
  });

  describe('casos de borda', () => {
    it('escapa todos os 18 caracteres reservados de uma vez', () => {
      const input = '_*[]()~`>#+-=|{}.!';
      const expected = '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!';
      expect(escapeMarkdownV2(input)).toBe(expected);
    });

    it('escapa backslash antes de outros caracteres para evitar double-escaping', () => {
      // Se backslash não fosse escapado primeiro, \! viraria \\! incorretamente
      expect(escapeMarkdownV2('\\!')).toBe('\\\\\\!');
    });

    it('escapa múltiplos backslashes', () => {
      expect(escapeMarkdownV2('\\\\')).toBe('\\\\\\\\');
    });

    it('escapa texto com múltiplos caracteres especiais misturados', () => {
      expect(escapeMarkdownV2('Dr. Silva (CRM 12345) - Especialista!')).toBe(
        'Dr\\. Silva \\(CRM 12345\\) \\- Especialista\\!'
      );
    });

    it('mantém quebras de linha sem escape', () => {
      expect(escapeMarkdownV2('Linha 1\nLinha 2!')).toBe('Linha 1\nLinha 2\\!');
    });

    it('escapa nome de medicamento comum do app', () => {
      expect(escapeMarkdownV2('Omega 3 (1000mg)')).toBe('Omega 3 \\(1000mg\\)');
    });

    it('escapa nome com todos os tipos de caracteres', () => {
      // Caso extremo: medicamento hipotético com muitos caracteres especiais
      expect(escapeMarkdownV2('Medicação #1 (2.5mg) + Vit. C!')).toBe(
        'Medicação \\#1 \\(2\\.5mg\\) \\+ Vit\\. C\\!'
      );
    });
  });
});