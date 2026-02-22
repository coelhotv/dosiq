/**
 * Unit tests for notify-agents.cjs
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
// GLOBAL FETCH MOCK
// ==========================================

let fetchCalls = [];
let fetchMockResponse = { ok: true, status: 200 };
let fetchFailCount = 0;
let fetchCurrentFailCount = 0;

// Mock global fetch - centralized logic for test configuration
global.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  
  // Simulate network failures for configured number of calls
  if (fetchCurrentFailCount < fetchFailCount) {
    fetchCurrentFailCount++;
    throw new Error('Network error');
  }
  
  return {
    ok: fetchMockResponse.ok,
    status: fetchMockResponse.status,
    text: async () => 'OK'
  };
};

/**
 * Reset fetch mock with configurable behavior
 * @param {Object} config - Configuration object
 * @param {number} [config.failCount=0] - Number of calls to fail with network error
 * @param {Object} [config.response={ok: true, status: 200}] - Response to return
 */
function resetFetchMock(config = {}) {
  fetchCalls = [];
  fetchMockResponse = config.response || { ok: true, status: 200 };
  fetchFailCount = config.failCount || 0;
  fetchCurrentFailCount = 0;
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
// Tests for shouldNotify
// ------------------------------------------

console.log('\n📋 Tests for shouldNotify:\n');

test('should return true for CRITICAL issue in critical mode', () => {
  const result = shouldNotify(mockReviewData, 'critical');
  assert.strictEqual(result, true);
});

test('should return false when no CRITICAL issue in critical mode', () => {
  const result = shouldNotify(mockReviewDataNoCritical, 'critical');
  assert.strictEqual(result, false);
});

test('should return true for HIGH issue in high mode', () => {
  const result = shouldNotify(mockReviewDataNoCritical, 'high');
  assert.strictEqual(result, true);
});

test('should return false when no HIGH or CRITICAL in high mode', () => {
  const result = shouldNotify(mockReviewDataOnlyMedium, 'high');
  assert.strictEqual(result, false);
});

test('should return true for any issue in all mode', () => {
  const result = shouldNotify(mockReviewDataOnlyMedium, 'all');
  assert.strictEqual(result, true);
});

test('should return false when no issues in all mode', () => {
  const result = shouldNotify({ summary: { total_issues: 0 } }, 'all');
  assert.strictEqual(result, false);
});

test('should use critical mode as default', () => {
  const result = shouldNotify(mockReviewData);
  assert.strictEqual(result, true);
});

test('should return false for invalid data', () => {
  const result = shouldNotify(null);
  assert.strictEqual(result, false);
});

test('should return false for data without summary', () => {
  const result = shouldNotify({});
  assert.strictEqual(result, false);
});

// ------------------------------------------
// Tests for formatWebhookPayload
// ------------------------------------------

console.log('\n📋 Tests for formatWebhookPayload:\n');

test('should format payload correctly', () => {
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

test('should use custom base URL when provided', () => {
  const payload = formatWebhookPayload(
    mockReviewData,
    117,
    'feature/test',
    'abc123',
    'https://custom.api.com'
  );
  
  assert.ok(payload.api_endpoint.includes('custom.api.com'));
});

test('should handle missing summary data', () => {
  const payload = formatWebhookPayload({}, 117, 'feature/test', 'abc123');
  
  assert.strictEqual(payload.issue_count, 0);
  assert.strictEqual(payload.critical_count, 0);
  assert.strictEqual(payload.high_count, 0);
});

test('should use fallback for critical_count when critical is present', () => {
  const data = { summary: { critical: 2, high: 1 } };
  const payload = formatWebhookPayload(data, 117, 'feature/test', 'abc123');
  
  assert.strictEqual(payload.critical_count, 2);
  assert.strictEqual(payload.high_count, 1);
});

// ------------------------------------------
// Tests for parseWebhookUrls
// ------------------------------------------

console.log('\n📋 Tests for parseWebhookUrls:\n');

test('should parse JSON array correctly', () => {
  const urls = parseWebhookUrls('["https://webhook1.com", "https://webhook2.com"]');
  assert.strictEqual(urls.length, 2);
  assert.strictEqual(urls[0], 'https://webhook1.com');
  assert.strictEqual(urls[1], 'https://webhook2.com');
});

test('should parse comma-separated string', () => {
  const urls = parseWebhookUrls('https://webhook1.com, https://webhook2.com');
  assert.strictEqual(urls.length, 2);
  assert.strictEqual(urls[0], 'https://webhook1.com');
  assert.strictEqual(urls[1], 'https://webhook2.com');
});

test('should return empty array for empty input', () => {
  const urls = parseWebhookUrls('');
  assert.strictEqual(urls.length, 0);
});

test('should return empty array for null input', () => {
  const urls = parseWebhookUrls(null);
  assert.strictEqual(urls.length, 0);
});


test('should filter invalid URLs', () => {
  const urls = parseWebhookUrls('["https://valid.com", "not-a-url", "https://another.com"]');
  assert.strictEqual(urls.length, 2);
  assert.ok(urls.every(url => url.startsWith('http')));
});

test('should parse JSON array of objects with url property', () => {
  const urls = parseWebhookUrls('[{"name":"agent1","url":"https://webhook1.com"},{"url":"https://webhook2.com"}, {"name":"invalid"}]');
  assert.strictEqual(urls.length, 2);
  assert.strictEqual(urls[0], 'https://webhook1.com');
  assert.strictEqual(urls[1], 'https://webhook2.com');
});

// ------------------------------------------
// Tests for sendWebhookWithRetry (async)
// ------------------------------------------

console.log('\n📋 Tests for sendWebhookWithRetry:\n');

await testAsync('should send webhook successfully with HMAC signature', async () => {
  resetFetchMock({ response: { ok: true, status: 200 } });
  
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
  assert.ok(call.options.headers['X-Gemini-Signature-256']);
  assert.ok(call.options.headers['X-Gemini-Signature-256'].startsWith('sha256='));
});

await testAsync('should retry on network error and eventually succeed', async () => {
  // Configure mock to fail first 2 calls, then succeed
  resetFetchMock({ failCount: 2, response: { ok: true, status: 200 } });
  
  const result = await sendWebhookWithRetry(
    'https://webhook.example.com',
    { test: 'data' },
    'secret-token'
  );
  
  // After retry, should succeed on 3rd attempt
  assert.strictEqual(result.success, true);
  assert.strictEqual(fetchCalls.length, 3);
});

await testAsync('should return error on 4xx client error without retry', async () => {
  // Configure mock to return 404 (no retry for 4xx)
  resetFetchMock({ response: { ok: false, status: 404 } });
  
  const result = await sendWebhookWithRetry(
    'https://webhook.example.com',
    { test: 'data' },
    'secret-token'
  );
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 404);
  assert.strictEqual(fetchCalls.length, 1); // No retry for 4xx
});

await testAsync('should retry on 5xx server error', async () => {
  resetFetchMock();
  let callCount = 0;
  // Mock that fails 2 times with 503, then returns 200
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
  
  // Should succeed after retry
  assert.strictEqual(result.success, true);
  assert.ok(fetchCalls.length > 1); // Should have retried
});

// ------------------------------------------
// Tests for notifyAgents (async)
// ------------------------------------------

console.log('\n📋 Tests for notifyAgents:\n');

await testAsync('should notify multiple webhooks successfully', async () => {
  resetFetchMock({ response: { ok: true, status: 200 } });
  
  const webhooks = ['https://webhook1.com', 'https://webhook2.com'];
  const context = { prNumber: 117, branch: 'feature/test', commitSha: 'abc123' };
  
  const result = await notifyAgents(mockReviewData, webhooks, 'secret', context);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.results.length, 2);
  assert.ok(result.results.every(r => r.success));
});

await testAsync('should return success when no webhooks are configured', async () => {
  resetFetchMock();
  
  const context = { prNumber: 117, branch: 'feature/test', commitSha: 'abc123' };
  const result = await notifyAgents(mockReviewData, [], 'secret', context);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.results.length, 0);
});

await testAsync('should return error when context is invalid', async () => {
  resetFetchMock();
  
  const result = await notifyAgents(mockReviewData, ['https://webhook.com'], 'secret', null);
  
  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});

await testAsync('should continue even if one webhook fails permanently', async () => {
  resetFetchMock(); // Reset state before custom mock
  // Custom mock: first webhook fails, second succeeds
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
  
  assert.strictEqual(result.success, false); // Not all succeeded
  assert.strictEqual(result.results.length, 2);
  assert.strictEqual(result.results[0].success, false);
  assert.strictEqual(result.results[1].success, true);
});

// ------------------------------------------
// Tests for WEBHOOK_CONFIG
// ------------------------------------------

console.log('\n📋 Tests for WEBHOOK_CONFIG:\n');

test('should have 10 second timeout', () => {
  assert.strictEqual(WEBHOOK_CONFIG.TIMEOUT_MS, 10000);
});

test('should have max_retries of 3', () => {
  assert.strictEqual(WEBHOOK_CONFIG.MAX_RETRIES, 3);
});

test('should have exponential delays', () => {
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS.length, 3);
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS[0], 1000);
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS[1], 2000);
  assert.strictEqual(WEBHOOK_CONFIG.RETRY_DELAYS[2], 4000);
});

// ==========================================
// FINAL REPORT
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
