/**
 * Testes unitários para notify-agents.cjs
 * 
 * @run node .github/scripts/__tests__/notify-agents.test.js
 */

import assert from 'assert';
import {
  shouldNotify,
  formatWebhookPayload,
  notifyAgents,
  sendWebhookWithRetry,
  parseWebhookUrls,
  WEBHOOK_CONFIG
} from '../notify-agents.cjs';

// ==========================================
// MOCK DE FETCH GLOBAL
// ==========================================

let fetchCalls = [];
let fetchMockResponse = { ok: true, status: 200 };
let fetchShouldFail = false;
let fetchFailCount = 0;

// Mock global fetch
global.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  
  if (fetchShouldFail) {
    fetchFailCount--;
    if (fetchFailCount <= 0) {
      fetchShouldFail = false;
    }
    throw new Error('Network error');
  }
  
  return {
    ok: fetchMockResponse.ok,
    status: fetchMockResponse.status,
    text: async () => 'OK'
  };
};

function resetFetchMock() {
  fetchCalls = [];
  fetchMockResponse = { ok: true, status: 200 };
  fetchShouldFail = false;
  fetchFailCount = 0;
}

// ==========================================
// DADOS DE TESTE
// ==========================================

const mockReviewData = {
  summary: {
    total_issues: 3,
    critical_count: 1,
    high_count: 1,
    medium_count: 1
  },
  issues: [
    { severity: 'CRITICAL' },
    { severity: 'HIGH' },
    { severity: 'MEDIUM' }
  ]
};

const mockReviewDataNoCritical = {
  summary: {
    total_issues: 2,
    critical_count: 0,
    high_count: 1,
    medium_count: 1
  }
};

const mockReviewDataOnlyMedium = {
  summary: {
    total_issues: 1,
    critical_count: 0,
    high_count: 0,
    medium_count: 1
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
    console.log(`   ${error.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

// ------------------------------------------
// Testes de shouldNotify
// ------------------------------------------

console.log('\n📋 Testes de shouldNotify:\n');

test('deve retornar true quando há issue CRITICAL (modo critical)', () => {
  const result = shouldNotify(mockReviewData, 'critical');
  assert.strictEqual(result, true);
});

test('deve retornar false quando não há issue CRITICAL (modo critical)', () => {
  const result = shouldNotify(mockReviewDataNoCritical, 'critical');
  assert.strictEqual(result, false);
});

test('deve retornar true quando há issue HIGH (modo high)', () => {
  const result = shouldNotify(mockReviewDataNoCritical, 'high');
  assert.strictEqual(result, true);
});

test('deve retornar false quando não há HIGH nem CRITICAL (modo high)', () => {
  const result = shouldNotify(mockReviewDataOnlyMedium, 'high');
  assert.strictEqual(result, false);
});

test('deve retornar true quando há qualquer issue (modo all)', () => {
  const result = shouldNotify(mockReviewDataOnlyMedium, 'all');
  assert.strictEqual(result, true);
});

test('deve retornar false quando não há issues (modo all)', () => {
  const result = shouldNotify({ summary: { total_issues: 0 } }, 'all');
  assert.strictEqual(result, false);
});

test('deve usar modo critical como padrão', () => {
  const result = shouldNotify(mockReviewData);
  assert.strictEqual(result, true);
});

test('deve retornar false para dados inválidos', () => {
  const result = shouldNotify(null);
  assert.strictEqual(result, false);
});

test('deve retornar false para dados sem summary', () => {
  const result = shouldNotify({});
  assert.strictEqual(result, false);
});

// ------------------------------------------
// Testes de formatWebhookPayload
// ------------------------------------------

console.log('\n📋 Testes de formatWebhookPayload:\n');

test('deve formatar payload corretamente', () => {
  const payload = formatWebhookPayload(mockReviewData, 117, 'feature/test', 'abc123');
  
  assert.strictEqual(payload.event, 'gemini_review_available');
  assert.strictEqual(payload.pr_number, 117);
  assert.strictEqual(payload.branch, 'feature/test');
  assert.strictEqual(payload.commit_sha, 'abc123');
  assert.strictEqual(payload.issue_count, 3);
  assert.strictEqual(payload.critical_count, 1);
  assert.strictEqual(payload.high_count, 1);
  assert.ok(payload.api_endpoint.includes('pr_number=117'));
  assert.ok(payload.timestamp);
  assert.ok(new Date(payload.timestamp).toISOString() === payload.timestamp);
});

test('deve usar URL base customizada quando fornecida', () => {
  const payload = formatWebhookPayload(
    mockReviewData, 
    117, 
    'feature/test', 
    'abc123',
    'https://custom.api.com'
  );
  
  assert.ok(payload.api_endpoint.includes('custom.api.com'));
});

test('deve lidar com dados de summary ausentes', () => {
  const payload = formatWebhookPayload({}, 117, 'feature/test', 'abc123');
  
  assert.strictEqual(payload.issue_count, 0);
  assert.strictEqual(payload.critical_count, 0);
  assert.strictEqual(payload.high_count, 0);
});

test('deve usar fallback para critical_count quando critical está presente', () => {
  const data = { summary: { critical: 2, high: 1 } };
  const payload = formatWebhookPayload(data, 117, 'feature/test', 'abc123');
  
  assert.strictEqual(payload.critical_count, 2);
  assert.strictEqual(payload.high_count, 1);
});

// ------------------------------------------
// Testes de parseWebhookUrls
// ------------------------------------------

console.log('\n📋 Testes de parseWebhookUrls:\n');

test('deve parsear JSON array corretamente', () => {
  const urls = parseWebhookUrls('["https://webhook1.com", "https://webhook2.com"]');
  assert.strictEqual(urls.length, 2);
  assert.strictEqual(urls[0], 'https://webhook1.com');
  assert.strictEqual(urls[1], 'https://webhook2.com');
});

test('deve parsear string separada por vírgula', () => {
  const urls = parseWebhookUrls('https://webhook1.com, https://webhook2.com');
  assert.strictEqual(urls.length, 2);
  assert.strictEqual(urls[0], 'https://webhook1.com');
  assert.strictEqual(urls[1], 'https://webhook2.com');
});

test('deve retornar array vazio para input vazio', () => {
  const urls = parseWebhookUrls('');
  assert.strictEqual(urls.length, 0);
});

test('deve retornar array vazio para input null', () => {
  const urls = parseWebhookUrls(null);
  assert.strictEqual(urls.length, 0);
});

test('deve filtrar URLs inválidas', () => {
  const urls = parseWebhookUrls('["https://valid.com", "not-a-url", "https://another.com"]');
  assert.strictEqual(urls.length, 2);
  assert.ok(urls.every(url => url.startsWith('http')));
});

// ------------------------------------------
// Testes de sendWebhookWithRetry (async)
// ------------------------------------------

console.log('\n📋 Testes de sendWebhookWithRetry:\n');

await testAsync('deve enviar webhook com sucesso', async () => {
  resetFetchMock();
  fetchMockResponse = { ok: true, status: 200 };
  
  const result = await sendWebhookWithRetry(
    'https://webhook.example.com',
    { test: 'data' },
    'secret-token'
  );
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(fetchCalls.length, 1);
  
  const call = fetchCalls[0];
  assert.strictEqual(call.options.method, 'POST');
  assert.strictEqual(call.options.headers['Content-Type'], 'application/json');
  assert.strictEqual(call.options.headers['X-Gemini-Event'], 'review_available');
  assert.strictEqual(call.options.headers['Authorization'], 'Bearer secret-token');
});

await testAsync('deve fazer retry em erro de rede e eventualmente suceder', async () => {
  resetFetchMock();
  // Falha nas 2 primeiras, depois reseta o mock global para sucesso
  global.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    if (fetchCalls.length <= 2) {
      throw new Error('Network error');
    }
    return { ok: true, status: 200, text: async () => 'OK' };
  };
  
  const result = await sendWebhookWithRetry(
    'https://webhook.example.com',
    { test: 'data' },
    'secret-token'
  );
  
  // Após retry, deve ter sucedido na 3a tentativa
  assert.strictEqual(result.success, true);
  assert.ok(fetchCalls.length === 3);
});

await testAsync('deve retornar erro em cliente 4xx sem retry', async () => {
  resetFetchMock();
  // Restaura mock padrão para este teste
  global.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return { ok: false, status: 404, text: async () => 'Not Found' };
  };
  
  const result = await sendWebhookWithRetry(
    'https://webhook.example.com',
    { test: 'data' },
    'secret-token'
  );
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 404);
  assert.strictEqual(fetchCalls.length, 1); // Sem retry para 4xx
});

await testAsync('deve fazer retry em erro 5xx', async () => {
  resetFetchMock();
  let callCount = 0;
  // Mock que falha 2 vezes com 503, depois retorna 200
  global.fetch = async (url, options) => {
    callCount++;
    fetchCalls.push({ url, options });
    if (callCount < 3) {
      return { ok: false, status: 503, text: async () => 'Service Unavailable' };
    }
    return { ok: true, status: 200, text: async () => 'OK' };
  };
  
  const result = await sendWebhookWithRetry(
    'https://webhook.example.com',
    { test: 'data' },
    'secret-token'
  );
  
  // Deve ter sucesso após retry
  assert.strictEqual(result.success, true);
  assert.ok(fetchCalls.length > 1); // Deve ter feito retry
});

// ------------------------------------------
// Testes de notifyAgents (async)
// ------------------------------------------

console.log('\n📋 Testes de notifyAgents:\n');

await testAsync('deve notificar múltiplos webhooks com sucesso', async () => {
  resetFetchMock();
  fetchMockResponse = { ok: true, status: 200 };
  
  const webhooks = ['https://webhook1.com', 'https://webhook2.com'];
  const context = { prNumber: 117, branch: 'feature/test', commitSha: 'abc123' };
  
  const result = await notifyAgents(mockReviewData, webhooks, 'secret', context);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.results.length, 2);
  assert.ok(result.results.every(r => r.success));
});

await testAsync('deve retornar sucesso quando não há webhooks configurados', async () => {
  resetFetchMock();
  
  const context = { prNumber: 117, branch: 'feature/test', commitSha: 'abc123' };
  const result = await notifyAgents(mockReviewData, [], 'secret', context);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.results.length, 0);
});

await testAsync('deve retornar erro quando contexto é inválido', async () => {
  resetFetchMock();
  
  const result = await notifyAgents(mockReviewData, ['https://webhook.com'], 'secret', null);
  
  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});

await testAsync('deve continuar mesmo se um webhook falhar permanentemente', async () => {
  resetFetchMock();
  // Simula falha permanente no primeiro webhook, sucesso no segundo
  global.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    
    if (url.includes('failing')) {
      throw new Error('Network error');
    }
    
    return {
      ok: true,
      status: 200,
      text: async () => 'OK'
    };
  };
  
  const webhooks = ['https://failing.com', 'https://success.com'];
  const context = { prNumber: 117, branch: 'feature/test', commitSha: 'abc123' };
  
  const result = await notifyAgents(mockReviewData, webhooks, 'secret', context);
  
  assert.strictEqual(result.success, false); // Nem todos tiveram sucesso
  assert.strictEqual(result.results.length, 2);
  assert.strictEqual(result.results[0].success, false);
  assert.strictEqual(result.results[1].success, true);
});

// ------------------------------------------
// Testes de WEBHOOK_CONFIG
// ------------------------------------------

console.log('\n📋 Testes de WEBHOOK_CONFIG:\n');

test('deve ter timeout de 10 segundos', () => {
  assert.strictEqual(WEBHOOK_CONFIG.TIMEOUT_MS, 10000);
});

test('deve ter max_retries de 3', () => {
  assert.strictEqual(WEBHOOK_CONFIG.MAX_RETRIES, 3);
});

test('deve ter delays exponenciais', () => {
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS.length, 3);
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS[0], 1000);
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS[1], 2000);
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS[2], 4000);
});

// ==========================================
// RELATÓRIO FINAL
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Resultados: ${passed} passaram, ${failed} falharam`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
