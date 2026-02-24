# Especificação: Escape de Caracteres MarkdownV2 no Bot Telegram

## 1. Contexto e Problema

### 1.1 Erro Identificado

O DLQ registrou um erro crítico nas notificações do Telegram:

```
Erro Telegram API: 400 - Bad Request: can't parse entities: Character '!' is reserved and must be escaped with the preceding '\'
```

**Dados da notificação falhada:**
- Medicine Name: "Omega 3"
- Scheduled Time: "21:20"
- Erro: Character '!' is reserved and must be escaped

### 1.2 Causa Raiz

O bot Telegram usa `parse_mode: 'MarkdownV2'` em várias mensagens, mas nem todos os textos dinâmicos (nomes de medicamentos, notas, etc.) estão sendo escapados corretamente. A função `escapeMarkdown` existe em `tasks.js` mas:

1. **Não está exportada** para uso em outros arquivos
2. **Não é usada consistentemente** em todos os locais necessários
3. **Pode ter problemas de ordem** nos replaces (caracteres especiais como `\` devem ser escapados primeiro)

---

## 2. Caracteres Reservados MarkdownV2 (Documentação Oficial)

### 2.1 Lista Completa de Caracteres Reservados

Segundo a [documentação oficial do Telegram](https://core.telegram.org/bots/api#markdownv2-style), os seguintes caracteres **DEVEM** ser escapados com `\` precedente:

| Caractere | Nome | Contexto de Uso |
|-----------|------|-----------------|
| `_` | Underscore | Itálico |
| `*` | Asterisk | Negrito |
| `[` | Left Square Bracket | Links |
| `]` | Right Square Bracket | Links |
| `(` | Left Parenthesis | Links |
| `)` | Right Parenthesis | Links |
| `~` | Tilde | Tachado |
| `` ` `` | Backtick | Monospace |
| `>` | Greater Than | Blockquote |
| `#` | Hash | Heading |
| `+` | Plus | List item |
| `-` | Minus/Hyphen | List item |
| `=` | Equals | Heading underline |
| `\|` | Vertical Bar | Table |
| `{` | Left Curly Brace | Expandable block |
| `}` | Right Curly Brace | Expandable block |
| `.` | Dot | Preformatted |
| `!` | Exclamation Mark | Expandable block |

**Total: 18 caracteres reservados**

### 2.1.1 Por Que Cada Caractere Precisa de Escape

| Caractere | Razão do Escape | Exemplo de Uso em MarkdownV2 |
|-----------|-----------------|------------------------------|
| `_` | Usado para itálico: `_texto_` | `_itálico_` → itálico |
| `*` | Usado para negrito: `*texto*` | `*negrito*` → **negrito** |
| `[` | Início de link: `[texto](url)` | `[Google](https://google.com)` |
| `]` | Fim de link: `[texto](url)` | `[Google](https://google.com)` |
| `(` | Início de URL em link: `[texto](url)` | `[Google](https://google.com)` |
| `)` | Fim de URL em link: `[texto](url)` | `[Google](https://google.com)` |
| `~` | Usado para tachado: `~texto~` | `~riscado~` → ~~riscado~~ |
| `` ` `` | Usado para código inline: `` `codigo` `` | `` `monospace` `` → `monospace` |
| `>` | Usado para blockquote: `> citação` | `> citação` → bloco de citação |
| `#` | Usado para títulos: `# Título` | `## Subtítulo` → subtítulo |
| `+` | Usado para listas: `+ item` | `+ item` → item de lista |
| `-` | Usado para listas: `- item` | `- item` → item de lista |
| `=` | Usado para sublinhado de título | `Título\n===` → título |
| `\|` | Usado para tabelas: `col1 \| col2` | Tabelas com colunas |
| `{` | Início de bloco expansível: `{texto}` | Blocos expansíveis |
| `}` | Fim de bloco expansível: `{texto}` | Blocos expansíveis |
| `.` | Usado em blocos pré-formatados | ` ``` .\ntexto\n``` ` |
| `!` | Usado para spoilers: `!texto!` | `!spoiler!` → texto oculto |

**Nota importante:** Caracteres como `?`, `$`, `%`, `@`, `&`, `;`, `:`, `,` **NÃO** são reservados e **NÃO** precisam de escape.

### 2.2 Caracteres que NÃO Precisam de Escape

Os seguintes caracteres **NÃO** precisam ser escapados em texto normal:

- Espaços em branco
- Quebras de linha (`\n`)
- Emojis (✅, 💊, ⏰, etc.)
- Caracteres alfanuméricos (A-Z, a-z, 0-9)
- Caracteres acentuados (á, é, í, ó, ú, ã, õ, ç, etc.)

### 2.3 Contextos Especiais

Em contextos específicos, regras diferentes se aplicam:

| Contexto | Caracteres Reservados Adicionais |
|----------|----------------------------------|
| Dentro de `inline code` | Apenas `` ` `` e `\` |
| Dentro de `pre code block` | Apenas `` ` `` e `\` |
| Dentro de links URL | Apenas `)` e `\` |

---

## 3. Análise do Código Atual

### 3.1 Função Existente

**Arquivo:** `server/bot/tasks.js` (linhas 44-65)

```javascript
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}
```

**Problemas identificados:**
1. ❌ Não está exportada (não pode ser usada em outros arquivos)
2. ❌ Não escapa `\` (backslash) primeiro - isso pode causar problemas
3. ✅ Escapa todos os 18 caracteres reservados

### 3.2 Locais que Usam `parse_mode: 'MarkdownV2'`

**Arquivo:** `server/bot/tasks.js`

| Linha | Função | Tipo de Mensagem | Usa escapeMarkdown? |
|-------|--------|------------------|---------------------|
| 207-209 | `sendDoseNotification` | Lembrete de dose | ✅ Parcialmente |
| 453-455 | Soft reminder | Lembrete suave | ✅ Parcialmente |
| 612 | `runUserDailyDigest` | Resumo diário | ❌ Não |
| 710 | `checkUserStockAlerts` | Alerta de estoque | ✅ Parcialmente |
| 845 | `runUserWeeklyAdherenceReport` | Relatório semanal | ❌ Não |
| 901 | `checkUserTitrationAlerts` | Alerta de titulação | ✅ Parcialmente |
| 1036 | `sendDlqDigest` | DLQ digest | ❌ Não |
| 1102 | `sendDlqDigest` | DLQ digest admin | ❌ Não |

### 3.3 Locais que Usam `parse_mode: 'Markdown'` (versão antiga)

**Arquivos identificados:**
- `server/bot/commands/historico.js` (linha 46)
- `server/bot/commands/estoque.js` (linha 70)
- `server/bot/commands/status.js` (linha 31)
- `server/bot/commands/adicionar_estoque.js` (linhas 56, 78, 136)
- `server/bot/commands/proxima.js` (linha 57)
- `server/bot/commands/hoje.js` (linha 97)
- `server/bot/commands/protocols.js` (linha 126)
- `server/bot/callbacks/doseActions.js` (múltiplas linhas)
- `server/bot/callbacks/conversational.js` (múltiplas linhas)

**Nota:** Estes arquivos usam `Markdown` (versão 1), que tem regras diferentes. A migração para `MarkdownV2` é opcional mas recomendada para consistência.

---

## 4. Solução Proposta

### 4.1 Função de Escape Corrigida

**Arquivo:** `server/utils/formatters.js` (adicionar ao final)

```javascript
/**
 * Escape special characters for Telegram MarkdownV2 format
 * According to: https://core.telegram.org/bots/api#markdownv2-style
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for MarkdownV2
 * 
 * @example
 * escapeMarkdownV2("Omega 3!") // Returns "Omega 3\\!"
 * escapeMarkdownV2("Vitamina D (1000UI)") // Returns "Vitamina D \\(1000UI\\)"
 */
export function escapeMarkdownV2(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Order matters: escape backslash FIRST to avoid double-escaping
  // Then escape all other reserved characters
  return text
    .replace(/\\/g, '\\\\')  // Must be first!
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}
```

### 4.2 Mudanças na Função

| Mudança | Justificativa |
|---------|---------------|
| Adicionar escape de `\` primeiro | Evita double-escaping (ex: `\!` viraria `\\!` incorretamente) |
| Exportar função | Permite uso em outros arquivos |
| Adicionar validação de tipo | Evita erros com valores null/undefined |
| Adicionar JSDoc | Documentação clara para desenvolvedores |

### 4.3 Locais de Aplicação

#### 4.3.1 Prioridade P0 (Crítico - Já usa MarkdownV2)

**Arquivo:** `server/bot/tasks.js`

1. **Atualizar import:**
```javascript
import { calculateDaysRemaining, escapeMarkdownV2 } from '../utils/formatters.js';
```

2. **Remover função local `escapeMarkdown`** (linhas 44-65)

3. **Atualizar funções de formatação:**

```javascript
// formatDoseReminderMessage (linha 75)
function formatDoseReminderMessage(protocol, scheduledTime) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  const dosage = escapeMarkdownV2(String(protocol.dosage_per_intake ?? 1));
  const unit = escapeMarkdownV2(medicine.dosage_unit || 'unidades');
  const notes = protocol.notes ? escapeMarkdownV2(protocol.notes) : null;
  // ... resto da função
}

// formatSoftReminderMessage (linha 107)
function formatSoftReminderMessage(protocol) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  const dosage = escapeMarkdownV2(String(protocol.dosage_per_intake ?? 1));
  const unit = escapeMarkdownV2(medicine.dosage_unit || 'unidades');
  // ... resto da função
}

// formatStockAlertMessage (linha 126)
function formatStockAlertMessage(zeroStock, lowStock) {
  // ... 
  zeroStock.forEach(m => {
    message += `❌ **${escapeMarkdownV2(m.name)}**\n`;
  });
  // ...
  lowStock.forEach(m => {
    // NOTA: Todos os caracteres reservados DEVEM ser escapados!
    // O ~ aqui é usado como "aproximadamente" (~5 dias), não como formatação
    // Portanto, deve ser escapado como \\~ para ser exibido literalmente
    const days = m.days <= 0 ? 'estoque zerado' : `\\~${m.days} dia\\(s\\) restante\\(s\\)`;
    message += `📦 **${escapeMarkdownV2(m.name)}**\n   └ ${days}\n`;
  });
  // ...
}

// formatTitrationAlertMessage (linha 156)
function formatTitrationAlertMessage(protocol) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  // ... resto da função
}
```

4. **Adicionar escape em mensagens estáticas com caracteres reservados:**

```javascript
// Linha 609 - Cuidado! Você está atrasado nas doses.
// O "!" precisa ser escapado
message += '🚨 *Cuidado\\! Você está atrasado nas doses.*';
```

5. **Atualizar relatórios periódicos:**

```javascript
// runUserDailyDigest (linha 612)
async function runUserDailyDigest(userId, chatId) {
  // ...
  // Escapar nomes de medicamentos e textos dinâmicos
  const escapedName = escapeMarkdownV2(medicine.name);
  const escapedNotes = protocol.notes ? escapeMarkdownV2(protocol.notes) : null;
  // ...
}

// runUserWeeklyAdherenceReport (linha 845)
async function runUserWeeklyAdherenceReport(userId, chatId) {
  // ...
  // Escapar textos do relatório
  const reportTitle = '📊 *Relatório Semanal de Adesão*';
  const adherenceText = escapeMarkdownV2(`Adesão: ${adherence}%`);
  // ...
}

// sendDlqDigest (linha 1036)
async function sendDlqDigest(adminChatId) {
  // ...
  // Escapar informações de erro
  const escapedError = escapeMarkdownV2(notification.error_message);
  const escapedMedicine = escapeMarkdownV2(notification.medicine_name);
  // ...
}
```

#### 4.3.2 Prioridade P1 (Recomendado - Usa Markdown v1)

**Arquivos a atualizar:**
- `server/bot/commands/historico.js`
- `server/bot/commands/estoque.js`
- `server/bot/commands/status.js`
- `server/bot/commands/adicionar_estoque.js`
- `server/bot/commands/proxima.js`
- `server/bot/commands/hoje.js`
- `server/bot/commands/protocols.js`
- `server/bot/callbacks/doseActions.js`
- `server/bot/callbacks/conversational.js`

**Ação recomendada:**
1. Importar `escapeMarkdownV2` de `formatters.js`
2. Aplicar em todos os textos dinâmicos (nomes de medicamentos, dosagens, etc.)
3. Considerar migração de `Markdown` para `MarkdownV2` para consistência

---

## 5. Testes Necessários

### 5.1 Testes Unitários

**Arquivo:** `server/utils/formatters.test.js` (criar)

```javascript
import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2 } from './formatters.js';

describe('escapeMarkdownV2', () => {
  it('should escape exclamation mark', () => {
    expect(escapeMarkdownV2('Omega 3!')).toBe('Omega 3\\!');
  });

  it('should escape all reserved characters', () => {
    const input = '_*[]()~`>#+-=|{}.!';
    const expected = '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!';
    expect(escapeMarkdownV2(input)).toBe(expected);
  });

  it('should escape backslash first', () => {
    expect(escapeMarkdownV2('test\\value')).toBe('test\\\\value');
  });

  it('should handle empty string', () => {
    expect(escapeMarkdownV2('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(escapeMarkdownV2(null)).toBe('');
    expect(escapeMarkdownV2(undefined)).toBe('');
  });

  it('should not escape emojis', () => {
    expect(escapeMarkdownV2('💊 Remédio!')).toBe('💊 Remédio\\!');
  });

  it('should not escape accented characters', () => {
    expect(escapeMarkdownV2('Vitamina D (1000UI)')).toBe('Vitamina D \\(1000UI\\)');
  });

  it('should handle complex medicine names', () => {
    expect(escapeMarkdownV2('Omega 3 (1000mg)')).toBe('Omega 3 \\(1000mg\\)');
    expect(escapeMarkdownV2('Vitamina D3 + K2')).toBe('Vitamina D3 \\+ K2');
    expect(escapeMarkdownV2('Ácido Fólico 5mg!')).toBe('Ácido Fólico 5mg\\!');
  });
});
```

### 5.2 Testes de Integração

**Cenários a testar:**

1. **Notificação de dose com nome contendo `!`:**
   - Medicine: "Omega 3!"
   - Esperado: Mensagem enviada sem erro

2. **Notificação de dose com nome contendo parênteses:**
   - Medicine: "Vitamina D (1000UI)"
   - Esperado: Mensagem enviada sem erro

3. **Alerta de estoque com nome contendo `+`:**
   - Medicine: "Vitamina C + Zinco"
   - Esperado: Mensagem enviada sem erro

4. **Notas de protocolo com caracteres especiais:**
   - Notes: "Tomar com água! Não esquecer."
   - Esperado: Mensagem enviada sem erro

---

## 5.3 Casos de Teste Unitário Abrangentes

### 5.3.1 Testes Básicos

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `null` | `''` | Null retorna string vazia |
| `undefined` | `''` | Undefined retorna string vazia |
| `''` | `''` | String vazia permanece vazia |
| `'texto simples'` | `'texto simples'` | Texto sem caracteres especiais |
| `'Texto Com Espaços'` | `'Texto Com Espaços'` | Espaços não são escapados |
| `'Açãoção'` | `'Açãoção'` | Caracteres acentuados não são escapados |
| `'💊 Remédio'` | `'💊 Remédio'` | Emojis não são escapados |

### 5.3.2 Testes de Caracteres Únicos

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'!'` | `'\\!'` | Exclamação |
| `'.'` | `'\\.'` | Ponto |
| `'_'` | `'\\_'` | Underscore |
| `'*'` | `'\\*'` | Asterisco |
| `'['` | `'\\['` | Colchete esquerdo |
| `']'` | `'\\]'` | Colchete direito |
| `'('` | `'\\('` | Parêntese esquerdo |
| `')'` | `'\\)'` | Parêntese direito |
| `'~'` | `'\\~'` | Til |
| `` '`' `` | `` '\\`' `` | Backtick |
| `'>'` | `'\\>'` | Maior que |
| `'#'` | `'\\#'` | Hash |
| `'+'` | `'\\+'` | Mais |
| `'-'` | `'\\-'` | Menos/Hífen |
| `'='` | `'\\='` | Igual |
| `'|'` | `'\\|'` | Barra vertical |
| `'{'` | `'\\{'` | Chave esquerda |
| `'}'` | `'\\}'` | Chave direita |
| `'\\'` | `'\\\\'` | Backslash (deve ser escapado primeiro) |

### 5.3.3 Testes de Números Decimais

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'1.5'` | `'1\\.5'` | Número decimal simples |
| `'2.5mg'` | `'2\\.5mg'` | Dosagem com unidade |
| `'0.25'` | `'0\\.25'` | Decimal menor que 1 |
| `'100.50'` | `'100\\.50'` | Decimal com centavos |
| `'Tomar 1.5 comprimidos'` | `'Tomar 1\\.5 comprimidos'` | Frase com decimal |
| `'Dose: 2.5mg/dia'` | `'Dose: 2\\.5mg/dia'` | Dosagem com barra |
| `'0.5 ml'` | `'0\\.5 ml'` | Dosagem em ml |

### 5.3.4 Testes de Pontos Finais e Abreviações

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'Fim.'` | `'Fim\\.'` | Ponto final simples |
| `'Dr. Silva'` | `'Dr\\. Silva'` | Abreviação Dr. |
| `'Sr. João'` | `'Sr\\. João'` | Abreviação Sr. |
| `'Sra. Maria'` | `'Sra\\. Maria'` | Abreviação Sra. |
| `'Av. Paulista'` | `'Av\\. Paulista'` | Abreviação Av. |
| `'Prof. Carlos'` | `'Prof\\. Carlos'` | Abreviação Prof. |
| `'etc.'` | `'etc\\.'` | Abreviação etc. |
| `'1.500 pessoas'` | `'1\\.500 pessoas'` | Número com ponto de milhar |
| `'Página 10.5'` | `'Página 10\\.5'` | Referência de página |

### 5.3.5 Testes de Frases Completas

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'Omega 3!'` | `'Omega 3\\!'` | Nome com exclamação |
| `'Dr. Silva'` | `'Dr\\. Silva'` | Nome com abreviação |
| `'Tomar 2.5mg (meio comprimido).'` | `'Tomar 2\\.5mg \\(meio comprimido\\)\\.'` | Frase complexa |
| `'Cuidado! Não exceder a dose.'` | `'Cuidado\\! Não exceder a dose\\.'` | Aviso com exclamação |
| `'Vitamina D3 + K2'` | `'Vitamina D3 \\+ K2'` | Nome com símbolo de soma |
| `'Remédio [Genérico]'` | `'Remédio \\[Genérico\\]'` | Nome com colchetes |
| `'Tomar pela manhã > noite'` | `'Tomar pela manhã \\> noite'` | Comparação |
| `'Item #12345'` | `'Item \\#12345'` | Referência com hash |
| `'Lista: item-1, item-2'` | `'Lista: item\\-1, item\\-2'` | Lista com hífens |
| `'Dose = 500mg'` | `'Dose \\= 500mg'` | Igualdade |
| `'Opção A | Opção B'` | `'Opção A \\| Opção B'` | Separador |
| `'Variável {nome}'` | `'Variável \\{nome\\}'` | Placeholder |
| `'Pressão `alta`'` | `'Pressão \\`alta\\`'` | Código inline |
| `'Texto ~riscado~'` | `'Texto \\~riscado\\~'` | Texto tachado |
| `'~5 dias restantes'` | `'\\~5 dias restantes'` | Til como "aproximadamente" |

### 5.3.6 Testes de Múltiplos Caracteres Especiais

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'Hello! How are you?'` | `'Hello\\! How are you?'` | Exclamação escapada, `?` não é reservado |
| `'Price: $10.50 (20% off!)'` | `'Price: $10\\.50 \\(20% off\\!\\)'` | Frase comercial |
| `'_*[]()~`>#+-=|{}.!'` | `'\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!'` | Todos os 18 caracteres |
| `'a_b*c[d]e(f)g~h`i>j#k+l-m=n|o{p}q.r!s'` | `'a\\_b\\*c\\[d\\]e\\(f\\)g\\~h\\`i\\>j\\#k\\+l\\-m\\=n\\|o\\{p\\}q\\.r\\!s'` | Caracteres intercalados |
| `'Teste \\! (com backslash)'` | `'Teste \\\\\\! \\(com backslash\\)'` | Backslash + outros |
| `'A.B.C.D'` | `'A\\.B\\.C\\.D'` | Múltiplos pontos |
| `'!!!'` | `'\\!\\!\\!'` | Múltiplas exclamações |
| `'___'` | `'\\_\\_\\_'` | Múltiplos underscores |
| `'***'` | `'\\*\\*\\*'` | Múltiplos asteriscos |

### 5.3.7 Testes de Casos Especiais

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'\\'` | `'\\\\'` | Apenas backslash |
| `'\\\\'` | `'\\\\\\\\'` | Dois backslashes |
| `'a\\b'` | `'a\\\\b'` | Backslash no meio |
| `'path\\to\\file'` | `'path\\\\to\\\\file'` | Caminho de arquivo |
| `'C:\\Users\\Test'` | `'C:\\\\Users\\\\Test'` | Caminho Windows |
| `'https://site.com'` | `'https://site\\.com'` | URL (pontos escapados) |
| `'email@test.com'` | `'email@test\\.com'` | Email (pontos escapados) |
| `'123'` | `'123'` | Apenas números |
| `'abc'` | `'abc'` | Apenas letras |
| `'ABC123'` | `'ABC123'` | Alfanumérico |
| `'   '` | `'   '` | Apenas espaços |
| `'\n'` | `'\n'` | Quebra de linha |
| `'Linha 1\nLinha 2'` | `'Linha 1\nLinha 2'` | Múltiplas linhas |
| `'Tab\ttab'` | `'Tab\ttab'` | Tabulação |

### 5.3.8 Testes de Nomes de Medicamentos Reais

| Input | Output Esperado | Descrição |
|-------|-----------------|-----------|
| `'Omega 3'` | `'Omega 3'` | Nome simples |
| `'Omega 3!'` | `'Omega 3\\!'` | Nome com exclamação |
| `'Vitamina D (1000UI)'` | `'Vitamina D \\(1000UI\\)'` | Com dosagem |
| `'Vitamina C + Zinco'` | `'Vitamina C \\+ Zinco'` | Com símbolo + |
| `'Ácido Fólico 5mg'` | `'Ácido Fólico 5mg'` | Com acento |
| `'Dipirona 500mg'` | `'Dipirona 500mg'` | Nome com dosagem |
| `'Paracetamol 750mg'` | `'Paracetamol 750mg'` | Nome com dosagem |
| `'Ibuprofeno 600mg'` | `'Ibuprofeno 600mg'` | Nome com dosagem |
| `'Omeprazol 20mg'` | `'Omeprazol 20mg'` | Nome com dosagem |
| `'Losartana 50mg'` | `'Losartana 50mg'` | Nome com dosagem |
| `'Metformina 850mg'` | `'Metformina 850mg'` | Nome com dosagem |
| `'AAS 100mg (infantil)'` | `'AAS 100mg \\(infantil\\)'` | Com parênteses |
| `'Clonazepam 0.5mg'` | `'Clonazepam 0\\.5mg'` | Decimal na dosagem |
| `'Rivotril 2.5mg/ml'` | `'Rivotril 2\\.5mg/ml'` | Dosagem complexa |
| `'Novalgina Gotas 500mg/ml'` | `'Novalgina Gotas 500mg/ml'` | Solução oral |

---

## 5.4 Adaptação de Testes Existentes

### 5.4.1 Arquivos de Teste a Atualizar

Os seguintes arquivos de teste podem precisar de atualização:

1. **`server/bot/tasks.test.js`** (se existir)
   - Atualizar mocks de mensagens para incluir escapes
   - Verificar se funções de formatação retornam texto escapado

2. **`server/bot/commands/*.test.js`** (se existirem)
   - Atualizar expected messages com escapes
   - Verificar se comandos que usam MarkdownV2 estão escapados

3. **`server/bot/callbacks/*.test.js`** (se existirem)
   - Atualizar expected messages com escapes
   - Verificar se callbacks que usam MarkdownV2 estão escapados

### 5.4.2 Instruções para Atualização

#### Passo 1: Buscar arquivos de teste existentes

```bash
# Encontrar todos os arquivos de teste no servidor
find server -name "*.test.js" -o -name "*.spec.js"

# Encontrar arquivos que usam MarkdownV2
grep -r "MarkdownV2" server --include="*.js" -l
```

#### Passo 2: Para cada arquivo de teste

1. **Identificar testes que verificam mensagens Telegram**
   ```bash
   # Buscar por testes que verificam mensagens
   grep -n "expect.*message" server/bot/tasks.test.js
   grep -n "expect.*sendMessage" server/bot/tasks.test.js
   ```

2. **Atualizar expected values para incluir escapes**
   ```javascript
   // ANTES
   expect(message).toBe('Lembrete: Omega 3 às 21:20!')
   
   // DEPOIS
   expect(message).toBe('Lembrete: Omega 3 às 21:20\\!')
   ```

3. **Adicionar novos casos de teste para caracteres especiais**
   ```javascript
   describe('escapeMarkdownV2 in notifications', () => {
     it('should escape exclamation mark in medicine name', () => {
       const medicine = { name: 'Omega 3!' };
       const message = formatDoseReminderMessage(medicine, '21:20');
       expect(message).toContain('Omega 3\\!');
     });
     
     it('should escape parentheses in medicine name', () => {
       const medicine = { name: 'Vitamina D (1000UI)' };
       const message = formatDoseReminderMessage(medicine, '21:20');
       expect(message).toContain('Vitamina D \\(1000UI\\)');
     });
     
     it('should escape plus sign in medicine name', () => {
       const medicine = { name: 'Vitamina C + Zinco' };
       const message = formatDoseReminderMessage(medicine, '21:20');
       expect(message).toContain('Vitamina C \\+ Zinco');
     });
     
     it('should escape decimal point in dosage', () => {
       const medicine = { name: 'Clonazepam' };
       const protocol = { dosage_per_intake: 0.5 };
       const message = formatDoseReminderMessage(protocol, '21:20');
       expect(message).toContain('0\\.5');
     });
   });
   ```

#### Passo 3: Exemplos de atualização por arquivo

**`server/bot/tasks.test.js`:**
```javascript
// ANTES
describe('sendDoseNotification', () => {
  it('should send notification with medicine name', async () => {
    const protocol = { medicine: { name: 'Omega 3!' } };
    await sendDoseNotification(bot, chatId, protocol, '21:20');
    expect(bot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Omega 3!'),
      { parse_mode: 'MarkdownV2' }
    );
  });
});

// DEPOIS
describe('sendDoseNotification', () => {
  it('should send notification with escaped medicine name', async () => {
    const protocol = { medicine: { name: 'Omega 3!' } };
    await sendDoseNotification(bot, chatId, protocol, '21:20');
    expect(bot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Omega 3\\!'),
      { parse_mode: 'MarkdownV2' }
    );
  });
});
```

**`server/bot/commands/hoje.test.js`:**
```javascript
// ANTES
it('should return list of today medicines', () => {
  const result = formatTodayMessage(medicines);
  expect(result).toContain('Omega 3!');
});

// DEPOIS
it('should return list of today medicines with escaped names', () => {
  const result = formatTodayMessage(medicines);
  expect(result).toContain('Omega 3\\!');
});
```

### 5.4.3 Checklist de Atualização de Testes

- [ ] Identificar todos os arquivos de teste que verificam mensagens
- [ ] Atualizar expected values para incluir escapes
- [ ] Adicionar novos casos de teste para caracteres especiais
- [ ] Adicionar testes para números decimais
- [ ] Adicionar testes para abreviações
- [ ] Adicionar testes para múltiplos caracteres especiais
- [ ] Executar todos os testes e verificar se passam
- [ ] Atualizar snapshots se necessário

### 5.4.4 Comandos Úteis para Atualização

```bash
# Executar testes do servidor
npm run test -- --config vitest.config.js server

# Executar apenas testes de formatters
npm run test -- server/utils/formatters.test.js

# Verificar cobertura de testes
npm run test -- --coverage server/utils/formatters.test.js

# Executar testes em modo watch
npm run test:watch -- server/utils/formatters.test.js
```

---

## 6. Exemplos de Uso

### 6.1 Antes (com erro)

```javascript
// Código que causa erro
const name = medicine.name || 'Medicamento'; // "Omega 3!"
let message = `💊 *Hora do seu remédio!*\n\n`;
message += `🩹 **${name}**\n`; // Erro: "!" não escapado
```

**Resultado:** `400 Bad Request: can't parse entities: Character '!' is reserved`

### 6.2 Depois (corrigido)

```javascript
// Código corrigido
import { escapeMarkdownV2 } from '../utils/formatters.js';

const name = escapeMarkdownV2(medicine.name || 'Medicamento'); // "Omega 3\!"
let message = `💊 *Hora do seu remédio\\!*\n\n`;
message += `🩹 **${name}**\n`; // OK: "!" escapado
```

**Resultado:** Mensagem enviada com sucesso

### 6.3 Exemplos de Transformação

| Input | Output |
|-------|--------|
| `Omega 3!` | `Omega 3\!` |
| `Vitamina D (1000UI)` | `Vitamina D \(1000UI\)` |
| `Vitamina C + Zinco` | `Vitamina C \+ Zinco` |
| `Ácido Fólico 5mg!` | `Ácido Fólico 5mg\!` |
| `Remédio [Genérico]` | `Remédio \[Genérico\]` |
| `Teste {abc}` | `Teste \{abc\}` |
| `Cuidado!` | `Cuidado\!` |
| `path\to\file` | `path\\to\\file` |
| `~5 dias restantes` | `\~5 dias restantes` |

---

## 7. Plano de Implementação

### 7.1 Fase 1: Correção Crítica (P0)

**Tempo estimado:** 1-2 horas

1. ✅ Criar função `escapeMarkdownV2` em `server/utils/formatters.js`
2. ✅ Criar testes unitários para a função
3. ✅ Atualizar `server/bot/tasks.js`:
   - Remover função local `escapeMarkdown`
   - Importar `escapeMarkdownV2`
   - Atualizar todas as funções de formatação
   - Escapar caracteres em mensagens estáticas
4. ✅ Testar notificações em ambiente de desenvolvimento
5. ✅ Fazer deploy para produção

### 7.2 Fase 2: Consolidação (P1)

**Tempo estimado:** 2-3 horas

1. ⏳ Atualizar arquivos de comandos (`commands/*.js`)
2. ⏳ Atualizar arquivos de callbacks (`callbacks/*.js`)
3. ⏳ Considerar migração de `Markdown` para `MarkdownV2`
4. ⏳ Testar todos os comandos do bot

### 7.3 Validação

Após implementação, validar:

1. **DLQ vazio:** Não deve haver novos erros de `BUTTON_DATA_INVALID` ou `can't parse entities`
2. **Notificações funcionando:** Testar pelo menos 3 notificações de dose
3. **Alertas funcionando:** Testar alertas de estoque e titulação
4. **Relatórios periódicos funcionando:**
   - Testar resumo diário (`runUserDailyDigest`)
   - Testar relatório semanal de adesão (`runUserWeeklyAdherenceReport`)
   - Testar DLQ digest para admin (`sendDlqDigest`)
5. **Comandos funcionando:** Testar `/hoje`, `/status`, `/estoque`

---

## 8. Checklist de Implementação

### 8.1 Código

- [ ] Criar `escapeMarkdownV2` em `server/utils/formatters.js`
- [ ] Criar testes unitários em `server/utils/formatters.test.js`
- [ ] Atualizar `server/bot/tasks.js`:
  - [ ] Remover função local `escapeMarkdown`
  - [ ] Importar `escapeMarkdownV2`
  - [ ] Atualizar `formatDoseReminderMessage`
  - [ ] Atualizar `formatSoftReminderMessage`
  - [ ] Atualizar `formatStockAlertMessage`
  - [ ] Atualizar `formatTitrationAlertMessage`
  - [ ] Escapar mensagens estáticas com `!`
- [ ] Atualizar relatórios periódicos em `server/bot/tasks.js`:
  - [ ] Atualizar `runUserDailyDigest` (resumo diário)
  - [ ] Atualizar `runUserWeeklyAdherenceReport` (relatório semanal de adesão)
  - [ ] Atualizar `sendDlqDigest` (DLQ digest para admin)
- [ ] Atualizar `server/bot/commands/*.js` (P1)
- [ ] Atualizar `server/bot/callbacks/*.js` (P1)

### 8.2 Testes

- [ ] Testes unitários passando
- [ ] Teste de notificação de dose
- [ ] Teste de alerta de estoque
- [ ] Teste de alerta de titulação
- [ ] Teste de resumo diário (`runUserDailyDigest`)
- [ ] Teste de relatório semanal de adesão (`runUserWeeklyAdherenceReport`)
- [ ] Teste de DLQ digest (`sendDlqDigest`)

### 8.3 Deploy

- [ ] Commit com mensagem semântica: `fix(bot): corrigir escape de caracteres MarkdownV2`
- [ ] Push para branch de feature
- [ ] PR criado e revisado
- [ ] Merge para main
- [ ] Deploy em produção
- [ ] Monitorar DLQ por 24h

---

## 9. Referências

- [Telegram Bot API - MarkdownV2 Style](https://core.telegram.org/bots/api#markdownv2-style)
- [Telegram Bot API - Formatting Options](https://core.telegram.org/bots/api#formatting-options)
- [Issue relacionado no DLQ](api/dlq.js)

---

**Documento criado em:** 2026-02-17
**Autor:** Arquiteto de Software
**Status:** Pronto para implementação
