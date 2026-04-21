/**
 * Testes unitários para parse-gemini-comments.js
 * 
 * Formato real do Gemini (validado em PR #25):
 * - Prioridade via image badges: ![critical](...critical.svg)
 * - Sugestões em bloco ```suggestion
 * 
 * @run node .github/scripts/__tests__/parse-gemini-comments.test.js
 */

import assert from 'assert';
import {
  parseGeminiComment,
  categorizeIssues,
  normalizePriority,
  isAutoFixable,
  isSecurityIssue,
  generateStructuredOutput
} from '../parse-gemini-comments.cjs';

// ==========================================
// DADOS DE TESTE (Formato real do Gemini PR #25)
// ==========================================

const mockComments = [
  // Comentário CRITICAL priority (formato real do PR #25)
  {
    id: 2810440263,
    path: 'server/utils/telegramFormatter.js',
    line: 15,
    body: `![critical](https://www.gstatic.com/codereviewagent/critical.svg)

A função \`escapeMarkdownV2\` não está escapando os caracteres \`(\` e \`)\`. De acordo com a documentação do Telegram para o modo \`MarkdownV2\`, esses caracteres são reservados e precisam ser escapados. A falta de escape para parênteses causará falhas na API do Telegram ao tentar enviar mensagens que contenham links formatados em Markdown, como \`[texto](url)\`.

\`\`\`suggestion
  const specialChars = /[*_[\\].()\`~>#+\\-=|{}.!]/g
  return text.replace(specialChars, '\\\\$&')
\`\`\``,
    user: { login: 'gemini-code-assist[bot]', type: 'Bot' },
    html_url: 'https://github.com/coelhotv/dosiq/pull/25#discussion_r2810440263'
  },
  
  // Comentário HIGH priority (formato real do PR #25)
  {
    id: 2810635778,
    path: 'server/utils/telegramFormatter.js',
    line: 146,
    body: `![high](https://www.gstatic.com/codereviewagent/high-priority.svg)

O ponto final \`.\` é um caractere reservado no MarkdownV2 e deve ser escapado como \`\\\\.\` quando usado como texto comum.

\`\`\`suggestion
    message += \`\\n📅 Planeje seu próximo repostamento\\\\.\`
\`\`\``,
    user: { login: 'gemini-code-assist[bot]', type: 'Bot' },
    html_url: 'https://github.com/coelhotv/dosiq/pull/25#discussion_r2810635778'
  },
  
  // Comentário MEDIUM priority (formato real do PR #25)
  {
    id: 2810635780,
    path: 'server/utils/telegramFormatter.js',
    line: 31,
    body: `![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)

A função \`escapeMarkdownSafe\` é atualmente idêntica à \`escapeMarkdownV2\`. Se a intenção é manter parênteses legíveis, a \`escapeMarkdownV2\` deveria ser corrigida para incluir parênteses (como sugerido acima) e esta função deveria ser a versão que os omite. Caso contrário, trata-se de código redundante que deve ser removido para melhorar a manutenibilidade.`,
    user: { login: 'gemini-code-assist[bot]', type: 'Bot' },
    html_url: 'https://github.com/coelhotv/dosiq/pull/25#discussion_r2810635780'
  },
  
  // Comentário MEDIUM (auto-fixable - formatting)
  {
    id: 2810635781,
    path: 'server/utils/telegramFormatter.js',
    line: 49,
    body: `![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)

O uso de \`new RegExp\` com chaves de objeto não escapadas pode causar erros se as chaves contiverem caracteres especiais de regex (como \`.\`). Além disso, para substituições simples de strings globais, o uso de \`split/join\` é mais seguro e evita a sobrecarga de compilação de regex em um loop.

\`\`\`suggestion
    message = message.split(\`{{\${key}}}\`).join(escapedValue)
\`\`\``,
    user: { login: 'gemini-code-assist[bot]', type: 'Bot' },
    html_url: 'https://github.com/coelhotv/dosiq/pull/25#discussion_r2810635781'
  }
];

// ==========================================
// TESTES
// ==========================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

// Teste 1: parseGeminiComment - CRITICAL priority (formato real PR #25)
test('parseGeminiComment extracts CRITICAL priority from image badge', () => {
  const result = parseGeminiComment(mockComments[0]);
  assert.strictEqual(result.priority, 'CRITICAL');
  assert.strictEqual(result.file, 'server/utils/telegramFormatter.js');
  assert.strictEqual(result.line, 15);
  assert.ok(result.issue.includes('escapeMarkdownV2'));
  assert.ok(result.suggestion.includes('specialChars'));
});

// Teste 2: parseGeminiComment - HIGH priority (formato real PR #25)
test('parseGeminiComment extracts HIGH priority from image badge', () => {
  const result = parseGeminiComment(mockComments[1]);
  assert.strictEqual(result.priority, 'HIGH');
  assert.strictEqual(result.file, 'server/utils/telegramFormatter.js');
  assert.strictEqual(result.line, 146);
  assert.ok(result.issue.includes('ponto final'));
});

// Teste 3: parseGeminiComment - MEDIUM priority (formato real PR #25)
test('parseGeminiComment extracts MEDIUM priority from image badge', () => {
  const result = parseGeminiComment(mockComments[2]);
  assert.strictEqual(result.priority, 'MEDIUM');
  assert.ok(result.issue.includes('escapeMarkdownSafe'));
});

// Teste 4: normalizePriority
test('normalizePriority normalizes correctly', () => {
  assert.strictEqual(normalizePriority('critical'), 'CRITICAL');
  assert.strictEqual(normalizePriority('high'), 'HIGH');
  assert.strictEqual(normalizePriority('medium'), 'MEDIUM');
  assert.strictEqual(normalizePriority('low'), 'LOW');
  assert.strictEqual(normalizePriority('unknown'), 'MEDIUM'); // default
});

// Teste 5: isAutoFixable
test('isAutoFixable identifies formatting issues', () => {
  const formattingIssue = { issue: 'Missing semicolon at end of statement' };
  const logicIssue = { issue: 'Complex logic in render function' };
  
  assert.strictEqual(isAutoFixable(formattingIssue), true);
  assert.strictEqual(isAutoFixable(logicIssue), false);
});

// Teste 6: isSecurityIssue
test('isSecurityIssue identifies security issues', () => {
  const securityIssue = { issue: 'Potential SQL injection vulnerability' };
  const normalIssue = { issue: 'Missing semicolon' };
  
  assert.strictEqual(isSecurityIssue(securityIssue), true);
  assert.strictEqual(isSecurityIssue(normalIssue), false);
});

// Teste 7: categorizeIssues
test('categorizeIssues categorizes correctly', () => {
  const parsed = mockComments.map(parseGeminiComment);
  const categorized = categorizeIssues(parsed);
  
  // Verifica contagens
  assert.strictEqual(categorized.critical.length, 1); // escapeMarkdownV2 critical
  assert.strictEqual(categorized.needsAgent.length, 3); // HIGH + 2 MEDIUM não-auto-fixable
  assert.strictEqual(categorized.autoFixable.length, 0); // Nenhum é auto-fixable
});

// Teste 8: generateStructuredOutput
test('generateStructuredOutput generates correct structure', () => {
  const parsed = mockComments.map(parseGeminiComment);
  const output = generateStructuredOutput(25, 'review-3806353890', parsed);
  
  assert.strictEqual(output.pr_number, 25);
  assert.strictEqual(output.review_id, 'review-3806353890');
  assert.ok(output.timestamp);
  assert.strictEqual(output.summary.total_issues, 4);
  assert.strictEqual(output.summary.critical, 1);
  assert.strictEqual(output.critical_requires_human, true);
  assert.ok(Array.isArray(output.issues));
  assert.ok(Array.isArray(output.auto_fix_commands));
});

// Teste 9: parseGeminiComment with missing fields
test('parseGeminiComment handles missing fields gracefully', () => {
  const minimalComment = {
    id: 999,
    body: 'Some generic comment without structured format',
    user: { login: 'gemini-code-assist[bot]', type: 'Bot' }
  };
  
  const result = parseGeminiComment(minimalComment);
  assert.strictEqual(result.priority, 'MEDIUM'); // default
  assert.strictEqual(result.file, undefined);
  assert.strictEqual(result.line, null);
  assert.ok(result.issue); // Should have extracted something
});

// Teste 10: parseGeminiComment with code suggestion (```suggestion)
test('parseGeminiComment extracts code suggestion from ```suggestion block', () => {
  const result = parseGeminiComment(mockComments[0]);
  assert.ok(result.suggestion);
  assert.ok(result.suggestion.includes('specialChars'));
  assert.ok(result.suggestion.includes('return text.replace'));
});

// Teste 11: parseGeminiComment extracts URL
test('parseGeminiComment extracts URL correctly', () => {
  const result = parseGeminiComment(mockComments[0]);
  assert.ok(result.url);
  assert.ok(result.url.includes('github.com'));
  assert.ok(result.url.includes('discussion'));
});

// ==========================================
// RESUMO
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
