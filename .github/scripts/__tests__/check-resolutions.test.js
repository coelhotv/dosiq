/**
 * Testes unitários para check-resolutions.cjs
 *
 * @run node .github/scripts/__tests__/check-resolutions.test.js
 */

import assert from 'assert';
import {
  checkIfLineChanged,
  postReplyToComment,
  parseChangedLines,
  determineResolutionType,
  shouldCheckResolutions,
  COMMENT_MARKER
} from '../check-resolutions.cjs';

// ==========================================
// DADOS DE TESTE
// ==========================================

const mockGeminiComment = {
  id: 1234567890,
  path: 'src/utils/helpers.js',
  line: 42,
  original_line: 42,
  body: `![critical](https://www.gstatic.com/codereviewagent/critical.svg)

Função não está tratando erro corretamente.

\`\`\`suggestion
  try {
    result = await fetchData();
  } catch (error) {
    console.error('Erro:', error);
  }
\`\`\``,
  user: { login: 'gemini-code-assist[bot]', type: 'Bot' },
  html_url: 'https://github.com/coelhotv/meus-remedios/pull/117#discussion_r1234567890',
  created_at: '2026-02-22T10:00:00Z'
};

const mockPartialComment = {
  id: 1234567891,
  path: 'src/services/api.js',
  line: 15,
  body: `![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)

TODO: Melhorar tratamento de erro nesta função no futuro.

Considerar usar um pattern mais robusto.`,
  user: { login: 'gemini-code-assist[bot]', type: 'Bot' },
  html_url: 'https://github.com/coelhotv/meus-remedios/pull/117#discussion_r1234567891',
  created_at: '2026-02-22T10:00:00Z'
};

const mockCommit = {
  sha: 'abc1234567890def1234567890abcdef12345678',
  commit: {
    message: 'fix: corrige tratamento de erro',
    committer: { date: '2026-02-22T11:00:00Z' }
  }
};

const mockComparison = {
  files: [
    {
      filename: 'src/utils/helpers.js',
      status: 'modified',
      patch: `@@ -40,7 +40,10 @@ function processData(data) {
   if (!data) return null;
   
-  return fetchData(data);
+  try {
+    return await fetchData(data);
+  } catch (error) {
+    console.error('Erro:', error);
+    return null;
+  }
 }`
    }
  ]
};

// Mock do cliente GitHub
function createMockGithub(overrides = {}) {
  return {
    rest: {
      pulls: {
        listReviewComments: async () => ({
          data: overrides.reviewComments || [mockGeminiComment]
        }),
        listCommits: async () => ({
          data: overrides.commits || [mockCommit]
        }),
        createReplyForReviewComment: async ({ body }) => ({
          data: {
            id: 9999999999,
            body,
            html_url: 'https://github.com/coelhotv/meus-remedios/pull/117#discussion_r9999999999'
          }
        })
      },
      repos: {
        compareCommits: async () => ({
          data: overrides.comparison || mockComparison
        })
      }
    }
  };
}

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
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failed++;
  }
}

// ==========================================
// TESTES: parseChangedLines
// ==========================================

test('parseChangedLines: deve parsear patch simples corretamente', () => {
  const patch = `@@ -40,7 +40,10 @@ function processData(data) {
   if (!data) return null;
   
-  return fetchData(data);
+  try {
+    return await fetchData(data);
+  } catch (error) {
+    console.error('Erro:', error);
+    return null;
+  }
 }`;

  const ranges = parseChangedLines(patch);

  assert.strictEqual(ranges.length, 1, 'Deve ter 1 range');
  assert.strictEqual(ranges[0].start, 40, 'Range deve começar na linha 40');
  assert.ok(ranges[0].end >= 40, 'Range deve ter end >= start');
});

test('parseChangedLines: deve lidar com múltiplos hunks', () => {
  const patch = `@@ -10,5 +10,5 @@ function foo() {
   return bar;
 }
 
-// Comentário antigo
+// Comentário novo
 function baz() {
@@ -30,3 +30,5 @@ function qux() {
   return 42;
 }
+
+// Nova linha
+// Outra linha`;

  const ranges = parseChangedLines(patch);

  assert.ok(ranges.length >= 2, 'Deve ter pelo menos 2 ranges');
});

test('parseChangedLines: deve retornar array vazio para patch vazio', () => {
  const ranges = parseChangedLines('');
  assert.ok(Array.isArray(ranges), 'Deve retornar array');
  assert.strictEqual(ranges.length, 0, 'Array deve estar vazio');
});

// ==========================================
// TESTES: determineResolutionType
// ==========================================

test('determineResolutionType: deve retornar "resolved" para comentário comum', () => {
  const result = determineResolutionType(mockGeminiComment);
  assert.strictEqual(result, 'resolved', 'Deve ser resolved');
});

test('determineResolutionType: deve retornar "partial" para comentário com TODO', () => {
  const result = determineResolutionType(mockPartialComment);
  assert.strictEqual(result, 'partial', 'Deve ser partial devido ao TODO');
});

test('determineResolutionType: deve retornar "partial" para comentário com FIXME', () => {
  const comment = {
    body: 'FIXME: corrigir esta função depois'
  };
  const result = determineResolutionType(comment);
  assert.strictEqual(result, 'partial', 'Deve ser partial devido ao FIXME');
});

test('determineResolutionType: deve retornar "partial" para comentário de refatoração', () => {
  const comment = {
    body: 'Esta função precisa de refatoração futura'
  };
  const result = determineResolutionType(comment);
  assert.strictEqual(result, 'partial', 'Deve ser partial devido à refatoração');
});

test('determineResolutionType: deve retornar "resolved" para comentário de estilo', () => {
  const comment = {
    body: '```suggestion\n// style fix\n```\nStyle issue'
  };
  const result = determineResolutionType(comment);
  assert.strictEqual(result, 'resolved', 'Deve ser resolved para style');
});

// ==========================================
// TESTES: COMMENT_MARKER
// ==========================================

test('COMMENT_MARKER: deve estar definido', () => {
  assert.ok(COMMENT_MARKER, 'COMMENT_MARKER deve estar definido');
  assert.ok(COMMENT_MARKER.includes('AUTO_REPLY'), 'Deve conter AUTO_REPLY');
});

// ==========================================
// TESTES: checkIfLineChanged (com mocks)
// ==========================================

async function testCheckIfLineChanged() {
  const mockGithub = createMockGithub();

  // Teste: linha modificada
  const result1 = await checkIfLineChanged(
    'src/utils/helpers.js',
    42,
    42,
    'base123',
    'head456',
    mockGithub,
    mockContext
  );
  assert.strictEqual(result1, true, 'Linha 42 deve estar modificada');

  // Teste: arquivo não modificado
  const mockGithubNoChange = createMockGithub({
    comparison: { files: [] }
  });
  const result2 = await checkIfLineChanged(
    'src/utils/other.js',
    10,
    10,
    'base123',
    'head456',
    mockGithubNoChange,
    mockContext
  );
  assert.strictEqual(result2, false, 'Arquivo não modificado deve retornar false');

  console.log('✅ checkIfLineChanged: todos os testes passaram');
}

// ==========================================
// TESTES: shouldCheckResolutions (com mocks)
// ==========================================

async function testShouldCheckResolutions() {
  // Teste: deve retornar true quando há novos commits
  const mockGithub = createMockGithub({
    reviewComments: [mockGeminiComment],
    commits: [mockCommit]
  });

  const result = await shouldCheckResolutions(117, mockGithub, mockContext);
  assert.strictEqual(result, true, 'Deve retornar true quando há novos commits');

  // Teste: deve retornar false quando não há comentários do Gemini
  const mockGithubNoComments = createMockGithub({
    reviewComments: []
  });

  const result2 = await shouldCheckResolutions(117, mockGithubNoComments, mockContext);
  assert.strictEqual(result2, false, 'Deve retornar false sem comentários do Gemini');

  console.log('✅ shouldCheckResolutions: todos os testes passaram');
}

// ==========================================
// TESTES: postReplyToComment (com mocks)
// ==========================================

async function testPostReplyToComment() {
  const mockGithub = createMockGithub();

  const result = await postReplyToComment(
    117,
    1234567890,
    `${COMMENT_MARKER}\n✅ Corrigido`,
    mockGithub,
    mockContext
  );

  assert.ok(result, 'Deve retornar dados da reply');
  assert.ok(result.html_url, 'Deve ter URL da reply');
  assert.ok(result.body.includes('Corrigido'), 'Mensagem deve estar no body');

  console.log('✅ postReplyToComment: todos os testes passaram');
}

// ==========================================
// EXECUTAR TESTES ASSÍNCRONOS
// ==========================================

async function runAsyncTests() {
  try {
    await testCheckIfLineChanged();
    passed++;
  } catch (error) {
    console.error(`❌ checkIfLineChanged: ${error.message}`);
    failed++;
  }

  try {
    await testShouldCheckResolutions();
    passed++;
  } catch (error) {
    console.error(`❌ shouldCheckResolutions: ${error.message}`);
    failed++;
  }

  try {
    await testPostReplyToComment();
    passed++;
  } catch (error) {
    console.error(`❌ postReplyToComment: ${error.message}`);
    failed++;
  }
}

// ==========================================
// RELATÓRIO FINAL
// ==========================================

async function main() {
  console.log('\n🧪 Testes de check-resolutions.cjs\n');

  // Executar testes assíncronos
  await runAsyncTests();

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Resultados: ${passed} passaram, ${failed} falharam`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
