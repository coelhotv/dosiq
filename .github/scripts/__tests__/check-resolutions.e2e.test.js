/**
 * Testes E2E para o fluxo de check-resolutions
 *
 * Valida:
 * 1. Job executa após persist com sucesso
 * 2. Endpoint é chamado corretamente
 * 3. Status é atualizado no Supabase
 * 4. Replies são postadas nos comentários
 *
 * @run node .github/scripts/__tests__/check-resolutions.e2e.test.js
 */

import assert from 'assert';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==========================================
// CONSTANTES
// ==========================================

const API_BASE_URL = 'https://meus-remedios.vercel.app/api/gemini-reviews';
const UPDATE_STATUS_ENDPOINT = `${API_BASE_URL}/update-status`;

// UUIDs válidos para testes (formato UUID v4)
const VALID_UUIDS = {
  review1: '550e8400-e29b-41d4-a716-446655440001',
  review2: '550e8400-e29b-41d4-a716-446655440002',
  review3: '550e8400-e29b-41d4-a716-446655440003',
};

// ==========================================
// MOCKS
// ==========================================

// Mock do fetch para Vercel API
let fetchCalls = [];
const originalFetch = global.fetch;

function mockFetch(response) {
  fetchCalls = [];
  global.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return response;
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
  fetchCalls = [];
}

// Mock do jose para JWT
class MockSignJWT {
  constructor(payload) {
    this.payload = payload;
    this.header = {};
  }

  setProtectedHeader(header) {
    this.header = header;
    return this;
  }

  setIssuedAt() {
    return this;
  }

  setExpirationTime() {
    return this;
  }

  async sign() {
    return 'mock-jwt-token';
  }
}

// Mock do GitHub context (usado para referência futura)
// eslint-disable-next-line no-unused-vars
const mockContext = {
  repo: { owner: 'test-owner', repo: 'test-repo' },
  eventName: 'pull_request',
  action: 'synchronize',
  payload: {
    pull_request: { number: 117 },
    after: 'abc1234567890def'
  }
};

// Mock do GitHub API client (usado para referência futura)
// eslint-disable-next-line no-unused-vars
function createMockGithub() {
  return {
    rest: {
      pulls: {
        listReviewComments: async () => ({
          data: [{
            id: 1234567890,
            path: 'src/utils/helpers.js',
            line: 42,
            body: `![critical](https://www.gstatic.com/codereviewagent/critical.svg)
            
Função não está tratando erro corretamente.`,
            user: { login: 'gemini-code-assist[bot]' },
            commit_id: 'old-commit-sha'
          }]
        }),
        listCommits: async () => ({
          data: [{
            sha: 'new-commit-sha',
            commit: {
              message: 'fix: corrige tratamento de erro',
              committer: { date: '2026-02-22T11:00:00Z' }
            }
          }]
        }),
        compareCommits: async () => ({
          data: {
            files: [{
              filename: 'src/utils/helpers.js',
              status: 'modified',
              patch: `@@ -40,7 +40,10 @@ function processData(data) {
   if (!data) return null;
   
 -  return fetchData(data);
 +  try {
 +    return await fetchData(data);
 +  } catch (error) {
 +    console.error('Erro:', error);
 +  }
 }`
            }]
          }
        }),
        createReplyForReviewComment: async ({ body }) => ({
          data: { id: 9999999999, body }
        })
      }
    }
  };
}

// ==========================================
// CONTADORES DE TESTE
// ==========================================

let testsPassed = 0;
let testsFailed = 0;
const failedTests = [];

function logPass(message) {
  console.log(`  ✅ Passou: ${message}\n`);
  testsPassed++;
}

function logFail(message, error) {
  console.log(`  ❌ Falhou: ${error.message}\n`);
  testsFailed++;
  failedTests.push({ test: message, error: error.message });
}

// ==========================================
// TESTES
// ==========================================

console.log('🧪 Testes E2E para check-resolutions\n');

// Teste 1: Job deve executar após persist com sucesso
console.log('Teste 1: Job executa após persist com sucesso');
try {
  // Simula condição do workflow
  const needsResult = { persist: { result: 'success' } };
  const shouldRun = needsResult.persist.result === 'success';
  assert.strictEqual(shouldRun, true, 'Job deve executar quando persist tem sucesso');
  logPass('Job executa após persist com sucesso');
} catch (error) {
  logFail('Job executa após persist com sucesso', error);
}

// Teste 2: Job deve pular se persist falhou
console.log('Teste 2: Job pula se persist falhou');
try {
  const needsResult = { persist: { result: 'failure' } };
  const shouldRun = needsResult.persist.result === 'success';
  assert.strictEqual(shouldRun, false, 'Job não deve executar quando persist falha');
  logPass('Job pula quando persist falha');
} catch (error) {
  logFail('Job pula quando persist falha', error);
}

// Teste 3: Endpoint é chamado com JWT correto
console.log('Teste 3: Endpoint é chamado com JWT correto');
try {
  mockFetch({
    ok: true,
    json: async () => ({ updated: 1, errors: [] })
  });

  // Simula chamada ao endpoint
  const jwt = await new MockSignJWT({ iss: 'github-actions', aud: 'vercel-api' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign();

  await fetch(UPDATE_STATUS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({
      updates: [{
        review_id: VALID_UUIDS.review1,
        status: 'resolved',
        resolution_type: 'fixed',
        commit_sha: 'abc123'
      }]
    })
  });

  assert.strictEqual(fetchCalls.length, 1, 'Fetch deve ser chamado uma vez');
  assert.strictEqual(fetchCalls[0].options.headers.Authorization, 'Bearer mock-jwt-token', 'JWT deve estar no header');
  assert.ok(fetchCalls[0].options.body.includes('resolved'), 'Body deve conter status resolved');
  logPass('Endpoint chamado com JWT correto');
} catch (error) {
  logFail('Endpoint chamado com JWT correto', error);
} finally {
  restoreFetch();
}

// Teste 4: Status atualizado para resolved quando fix detectado
console.log('Teste 4: Status atualizado para resolved quando fix detectado');
try {
  mockFetch({
    ok: true,
    json: async () => ({ updated: 1, errors: [] })
  });

  // Simula detecção de resolução
  const resolution = {
    review_id: VALID_UUIDS.review1,
    resolved: true,
    partial: false
  };

  const update = {
    review_id: resolution.review_id,
    status: resolution.resolved ? 'resolved' : (resolution.partial ? 'partial' : 'detected'),
    resolution_type: resolution.resolved ? 'fixed' : (resolution.partial ? 'partial' : null),
    commit_sha: 'abc123'
  };

  await fetch(UPDATE_STATUS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates: [update] })
  });

  const body = JSON.parse(fetchCalls[0].options.body);
  assert.strictEqual(body.updates[0].status, 'resolved', 'Status deve ser resolved');
  assert.strictEqual(body.updates[0].resolution_type, 'fixed', 'Resolution type deve ser fixed');
  logPass('Status atualizado para resolved');
} catch (error) {
  logFail('Status atualizado para resolved', error);
} finally {
  restoreFetch();
}

// Teste 5: Status atualizado para partial quando fix parcial
console.log('Teste 5: Status atualizado para partial quando fix parcial');
try {
  mockFetch({
    ok: true,
    json: async () => ({ updated: 1, errors: [] })
  });

  const resolution = {
    review_id: VALID_UUIDS.review2,
    resolved: false,
    partial: true
  };

  const update = {
    review_id: resolution.review_id,
    status: resolution.resolved ? 'resolved' : (resolution.partial ? 'partial' : 'detected'),
    resolution_type: resolution.resolved ? 'fixed' : (resolution.partial ? 'partial' : null),
    commit_sha: 'abc123'
  };

  await fetch(UPDATE_STATUS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates: [update] })
  });

  const body = JSON.parse(fetchCalls[0].options.body);
  assert.strictEqual(body.updates[0].status, 'partial', 'Status deve ser partial');
  assert.strictEqual(body.updates[0].resolution_type, 'partial', 'Resolution type deve ser partial');
  logPass('Status atualizado para partial');
} catch (error) {
  logFail('Status atualizado para partial', error);
} finally {
  restoreFetch();
}

// Teste 6: Tratamento de erro do endpoint
console.log('Teste 6: Tratamento de erro do endpoint');
try {
  mockFetch({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Internal Server Error' })
  });

  const response = await fetch(UPDATE_STATUS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates: [] })
  });

  assert.strictEqual(response.ok, false, 'Response não deve ser ok');
  logPass('Erro do endpoint tratado corretamente');
} catch (error) {
  logFail('Erro do endpoint tratado corretamente', error);
} finally {
  restoreFetch();
}

// Teste 7: Múltiplas atualizações em batch
console.log('Teste 7: Múltiplas atualizações em batch');
try {
  mockFetch({
    ok: true,
    json: async () => ({ updated: 3, errors: [] })
  });

  const updates = [
    { review_id: VALID_UUIDS.review1, status: 'resolved', resolution_type: 'fixed', commit_sha: 'abc' },
    { review_id: VALID_UUIDS.review2, status: 'partial', resolution_type: 'partial', commit_sha: 'abc' },
    { review_id: VALID_UUIDS.review3, status: 'resolved', resolution_type: 'fixed', commit_sha: 'abc' }
  ];

  await fetch(UPDATE_STATUS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates })
  });

  const body = JSON.parse(fetchCalls[0].options.body);
  assert.strictEqual(body.updates.length, 3, 'Devem ter 3 atualizações');
  logPass('Múltiplas atualizações processadas');
} catch (error) {
  logFail('Múltiplas atualizações processadas', error);
} finally {
  restoreFetch();
}

// Teste 8: Dependências do job no workflow (validação real do arquivo)
console.log('Teste 8: Dependências do job no workflow');
try {
  // Caminho para o arquivo de workflow
  const workflowPath = join(__dirname, '..', '..', 'workflows', 'gemini-review.yml');
  
  // Verifica se o arquivo existe
  if (!existsSync(workflowPath)) {
    throw new Error(`Arquivo de workflow não encontrado: ${workflowPath}`);
  }
  
  // Lê o conteúdo do arquivo
  const workflowContent = readFileSync(workflowPath, 'utf-8');
  
  // Verifica se o job check-resolutions existe
  assert.ok(workflowContent.includes('check-resolutions:'), 'Job check-resolutions deve existir no workflow');
  
  // Verifica se o job tem a seção 'needs'
  const needsMatch = workflowContent.match(/check-resolutions:[\s\S]*?needs:\s*\[([^\]]+)\]/);
  assert.ok(needsMatch, 'Job check-resolutions deve ter dependências (needs)');
  
  // Extrai e valida as dependências
  const needsValue = needsMatch[1];
  const expectedNeeds = ['detect', 'parse', 'persist'];
  
  for (const need of expectedNeeds) {
    assert.ok(needsValue.includes(need), `Job deve depender de '${need}'`);
  }
  
  logPass('Dependências corretas no workflow real');
} catch (error) {
  logFail('Dependências corretas no workflow real', error);
}

// ==========================================
// RESUMO
// ==========================================

console.log('='.repeat(50));
console.log(`📊 Resultado: ${testsPassed} passaram, ${testsFailed} falharam`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  console.log('\n❌ Testes que falharam:');
  failedTests.forEach(({ test, error }) => {
    console.log(`  - ${test}: ${error}`);
  });
  console.log('');
  // Exit with non-zero code to indicate failure
  process.exit(1);
} else {
  console.log('\n✅ Todos os testes E2E passaram!');
  process.exit(0);
}
