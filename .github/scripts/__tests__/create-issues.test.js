/**
 * Testes unitários para create-issues.js
 *
 * @run node .github/scripts/__tests__/create-issues.test.js
 */

import assert from 'assert';
import {
  createIssuesFromReview,
  findSimilarIssue,
  generateIssueTitle,
  generateIssueBody,
  extractIssueFromBody,
  calculateSimilarity,
  REFACTOR_LABELS
} from '../create-issues.js';

// ==========================================
// DADOS DE TESTE
// ==========================================

const mockReviewData = {
  pr_number: 100,
  issues: [
    {
      id: 1,
      file: 'src/utils/dateUtils.js',
      line: 42,
      severity: 'MEDIUM',
      issue: 'Função duplicada entre dateUtils.js e adherenceLogic.js',
      suggestion: 'Consolidar funções em um único módulo',
      auto_fixable: false,
      category: 'refactoring',
      url: 'https://github.com/coelhotv/meus-remedios/pull/100#discussion_r1'
    },
    {
      id: 2,
      file: 'src/services/api/medicineService.js',
      line: 15,
      severity: 'MEDIUM',
      issue: 'Função muito longa com múltiplas responsabilidades',
      suggestion: 'Extrair funções menores com responsabilidade única',
      auto_fixable: false,
      category: 'logic',
      url: 'https://github.com/coelhotv/meus-remedios/pull/100#discussion_r2'
    },
    {
      id: 3,
      file: 'src/components/ui/Button.jsx',
      line: 10,
      severity: 'MEDIUM',
      issue: 'Missing semicolon at end of statement',
      suggestion: 'Add semicolon',
      auto_fixable: true, // Este deve ser ignorado
      category: 'style',
      url: 'https://github.com/coelhotv/meus-remedios/pull/100#discussion_r3'
    },
    {
      id: 4,
      file: 'src/schemas/protocolSchema.js',
      line: 25,
      severity: 'HIGH', // Este deve ser ignorado (não é MEDIUM)
      issue: 'Validação de segurança ausente',
      suggestion: 'Adicionar validação Zod',
      auto_fixable: false,
      category: 'security',
      url: 'https://github.com/coelhotv/meus-remedios/pull/100#discussion_r4'
    }
  ]
};


const mockContext = {
  repo: {
    owner: 'coelhotv',
    repo: 'meus-remedios'
  }
};

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

// Teste 1: generateIssueTitle
test('generateIssueTitle creates correct title format', () => {
  const issue = {
    file: 'src/utils/dateUtils.js',
    issue: 'Função duplicada entre módulos'
  };
  const title = generateIssueTitle(issue);

  assert.ok(title.startsWith('[Refactor]'));
  assert.ok(title.includes('dateUtils.js'));
  assert.ok(title.includes('Função duplicada'));
});

// Teste 2: generateIssueTitle truncates long issues
test('generateIssueTitle truncates long issues', () => {
  const issue = {
    file: 'src/utils/helper.js',
    issue: 'A'.repeat(100)
  };
  const title = generateIssueTitle(issue);

  // Título deve ser razoavelmente curto (menos de 100 chars incluindo prefixo)
  assert.ok(title.length <= 100, `Title length ${title.length} exceeds 100`);
  assert.ok(title.endsWith('...'), 'Title should end with ellipsis');
});

// Teste 3: generateIssueBody
test('generateIssueBody creates proper markdown structure', () => {
  const issue = mockReviewData.issues[0];
  const body = generateIssueBody(issue, 100);

  assert.ok(body.includes('## 🤖 Identificado pelo Gemini Code Assist'));
  assert.ok(body.includes('### Issue'));
  assert.ok(body.includes('### Arquivo'));
  assert.ok(body.includes('### Sugestão'));
  assert.ok(body.includes('### Contexto'));
  assert.ok(body.includes('### Checklist'));
  assert.ok(body.includes('**PR:** #100'));
  assert.ok(body.includes('**Prioridade:** MEDIUM'));
  assert.ok(body.includes('**Categoria:** refactoring'));
});

// Teste 4: generateIssueBody includes code suggestion
test('generateIssueBody includes code suggestion in code block', () => {
  const issue = mockReviewData.issues[0];
  const body = generateIssueBody(issue, 100);

  assert.ok(body.includes('```javascript'));
  assert.ok(body.includes('Consolidar funções em um único módulo'));
});

// Teste 5: extractIssueFromBody
test('extractIssueFromBody extracts issue text from body', () => {
  const body = `## 🤖 Identificado pelo Gemini Code Assist

### Issue
Função duplicada precisa ser consolidada

### Arquivo
src/utils/dateUtils.js`;

  const result = extractIssueFromBody(body);
  assert.strictEqual(result, 'Função duplicada precisa ser consolidada');
});

// Teste 6: extractIssueFromBody returns null for invalid body
test('extractIssueFromBody returns null for invalid body', () => {
  const result = extractIssueFromBody(null);
  assert.strictEqual(result, null);
});

// Teste 7: calculateSimilarity
test('calculateSimilarity calculates similarity between strings', () => {
  const sim1 = calculateSimilarity('função duplicada', 'função duplicada');
  assert.strictEqual(sim1, 1.0);

  const sim2 = calculateSimilarity('função duplicada', 'método repetido');
  assert.ok(sim2 < 0.5);
});

// Teste 8: calculateSimilarity handles empty strings
test('calculateSimilarity handles empty strings', () => {
  const sim = calculateSimilarity('', 'test');
  assert.strictEqual(sim, 0);
});

// Teste 9: REFACTOR_LABELS constants
test('REFACTOR_LABELS contains correct labels', () => {
  assert.strictEqual(REFACTOR_LABELS.GEMINI_REFACTOR, '🤖 gemini-refactor');
  assert.strictEqual(REFACTOR_LABELS.REFACTORING, 'refactoring');
  assert.strictEqual(REFACTOR_LABELS.TECH_DEBT, 'tech-debt');
});

// Teste 10: findSimilarIssue returns null when no similar issue exists
// (async test - needs to be handled differently)

// Teste 11: createIssuesFromReview filters correctly
// Este é um teste async, vamos verificar a lógica de filtragem

test('createIssuesFromReview filters only MEDIUM non-auto-fixable issues', async () => {
  // Criar mock que captura as chamadas
  const createdIssues = [];
  const mockGithubWithCapture = {
    rest: {
      issues: {
        create: async ({ title }) => {
          createdIssues.push(title);
          return { data: { number: 101 + createdIssues.length } };
        },
        listForRepo: async () => ({ data: [] })
      }
    }
  };

  const result = await createIssuesFromReview(
    mockReviewData,
    100,
    mockGithubWithCapture,
    mockContext
  );

  // Deve criar apenas 2 issues (os MEDIUM não-auto-fixable)
  // - dateUtils.js (MEDIUM, não auto-fixable)
  // - medicineService.js (MEDIUM, não auto-fixable)
  // - Button.jsx (MEDIUM, mas é auto-fixable - ignorado)
  // - protocolSchema.js (HIGH - ignorado)
  assert.strictEqual(result.length, 2);
});

// Teste 12: findSimilarIssue detects similar issues by file and line
test('findSimilarIssue detects similar issues by file and line', async () => {
  const mockGithubWithExisting = {
    rest: {
      issues: {
        listForRepo: async () => ({
          data: [
            {
              number: 50,
              title: '[Refactor] dateUtils.js: Função duplicada',
              body: '### Issue\nFunção duplicada entre módulos\n### Arquivo\nsrc/utils/dateUtils.js (linha 42)'
            }
          ]
        })
      }
    }
  };

  const issue = {
    file: 'src/utils/dateUtils.js',
    line: 43, // Mesma linha (dentro do threshold de 5)
    issue: 'Função duplicada'
  };

  const result = await findSimilarIssue(issue, mockGithubWithExisting, mockContext);
  assert.ok(result);
  assert.strictEqual(result.number, 50);
});

// Teste 13: findSimilarIssue returns null for different files
test('findSimilarIssue returns null for different files', async () => {
  const mockGithubWithExisting = {
    rest: {
      issues: {
        listForRepo: async () => ({
          data: [
            {
              number: 50,
              title: '[Refactor] otherFile.js: Algum issue',
              body: '### Issue\nAlgum issue\n### Arquivo\nsrc/otherFile.js (linha 42)'
            }
          ]
        })
      }
    }
  };

  const issue = {
    file: 'src/utils/dateUtils.js',
    line: 42,
    issue: 'Função duplicada'
  };

  const result = await findSimilarIssue(issue, mockGithubWithExisting, mockContext);
  assert.strictEqual(result, null);
});

// ==========================================
// RESUMO
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
