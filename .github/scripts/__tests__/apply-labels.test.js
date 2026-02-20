/**
 * Testes unitários para apply-labels.js
 * 
 * Testa a lógica de aplicação de labels baseada nos issues do Gemini.
 * Usa test runner simples com assert (padrão do projeto).
 * 
 * @run node .github/scripts/__tests__/apply-labels.test.js
 */

import assert from 'assert';
import {
  applyLabels,
  applyLabelsWithReplace,
  removeOldLabels,
  LABELS
} from '../apply-labels.js';

// ==========================================
// TEST RUNNER SIMPLES
// ==========================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

console.log('Running apply-labels tests...\n');

// ==========================================
// TESTES PRINCIPAIS
// ==========================================

await testAsync('deve sempre adicionar gemini-reviewed', async () => {
  const reviewData = {
    summary: { total_issues: 0, auto_fixable: 0, critical: 0, needs_agent: 0 },
    issues: []
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.GEMINI_REVIEWED), 
    'Label gemini-reviewed deve sempre ser adicionada');
});

await testAsync('deve adicionar auto-fix-applied quando há issues auto-fixable', async () => {
  const reviewData = {
    summary: { total_issues: 3, auto_fixable: 2, critical: 0, needs_agent: 1 },
    issues: [
      { severity: 'MEDIUM', category: 'style', auto_fixable: true },
      { severity: 'MEDIUM', category: 'style', auto_fixable: true }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.AUTO_FIX_APPLIED),
    'Label auto-fix-applied deve ser adicionada quando há issues auto-fixable');
});

await testAsync('deve adicionar needs-human-review quando há issues críticos', async () => {
  const reviewData = {
    summary: { total_issues: 2, auto_fixable: 0, critical: 1, needs_agent: 1 },
    issues: [
      { severity: 'CRITICAL', category: 'security' }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.NEEDS_HUMAN_REVIEW),
    'Label needs-human-review deve ser adicionada quando há issues críticos');
});

await testAsync('deve adicionar needs-human-review quando há issues HIGH priority', async () => {
  const reviewData = {
    summary: { total_issues: 1, auto_fixable: 0, critical: 0, needs_agent: 1 },
    issues: [
      { severity: 'HIGH', category: 'general' }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.NEEDS_HUMAN_REVIEW),
    'Label needs-human-review deve ser adicionada quando há issues HIGH');
});

await testAsync('deve adicionar security-issue quando há issues de segurança', async () => {
  const reviewData = {
    summary: { total_issues: 1, auto_fixable: 0, critical: 0, needs_agent: 1 },
    issues: [
      { severity: 'MEDIUM', category: 'security', issue: 'Potential XSS vulnerability' }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.SECURITY_ISSUE),
    'Label security-issue deve ser adicionada para issues de segurança');
});

await testAsync('deve adicionar performance-issue quando há issues de performance', async () => {
  const reviewData = {
    summary: { total_issues: 1, auto_fixable: 0, critical: 0, needs_agent: 1 },
    issues: [
      { severity: 'MEDIUM', category: 'performance', issue: 'Performance optimization needed' }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.PERFORMANCE_ISSUE),
    'Label performance-issue deve ser adicionada para issues de performance');
});

await testAsync('deve adicionar needs-docs-update quando há issues de documentação', async () => {
  const reviewData = {
    summary: { total_issues: 1, auto_fixable: 0, critical: 0, needs_agent: 1 },
    issues: [
      { severity: 'LOW', category: 'documentation', issue: 'Documentation outdated' }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  assert(labels.includes(LABELS.NEEDS_DOCS_UPDATE),
    'Label needs-docs-update deve ser adicionada para issues de documentação');
});

await testAsync('deve aplicar múltiplas labels quando aplicável', async () => {
  const reviewData = {
    summary: { total_issues: 3, auto_fixable: 1, critical: 1, needs_agent: 2 },
    issues: [
      { severity: 'CRITICAL', category: 'security' },
      { severity: 'MEDIUM', category: 'style', auto_fixable: true },
      { severity: 'HIGH', category: 'general' }
    ]
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  // Deve ter gemini-reviewed (sempre)
  assert(labels.includes(LABELS.GEMINI_REVIEWED));
  // Deve ter auto-fix-applied (auto_fixable > 0)
  assert(labels.includes(LABELS.AUTO_FIX_APPLIED));
  // Deve ter needs-human-review (critical > 0)
  assert(labels.includes(LABELS.NEEDS_HUMAN_REVIEW));
  // Deve ter security-issue (category === 'security')
  assert(labels.includes(LABELS.SECURITY_ISSUE));
  
  // Total de 4 labels
  assert.strictEqual(labels.length, 4);
});

await testAsync('deve funcionar com dados mínimos (sem issues)', async () => {
  const reviewData = {
    summary: { total_issues: 0, auto_fixable: 0, critical: 0, needs_agent: 0 },
    issues: []
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  // Apenas gemini-reviewed
  assert.strictEqual(labels.length, 1);
  assert.strictEqual(labels[0], LABELS.GEMINI_REVIEWED);
});

await testAsync('deve lidar com reviewData sem campo issues', async () => {
  const reviewData = {
    summary: { total_issues: 0, auto_fixable: 0, critical: 0, needs_agent: 0 }
    // sem campo issues
  };
  
  const labels = await applyLabels(reviewData, 1);
  
  // Ainda deve ter gemini-reviewed
  assert(labels.includes(LABELS.GEMINI_REVIEWED));
  assert.strictEqual(labels.length, 1);
});

// ==========================================
// TESTES DE LABELS
// ==========================================

test('LABELS deve ter todas as labels definidas', () => {
  assert.strictEqual(LABELS.GEMINI_REVIEWED, '🤖 gemini-reviewed');
  assert.strictEqual(LABELS.AUTO_FIX_APPLIED, '🔧 auto-fix-applied');
  assert.strictEqual(LABELS.NEEDS_HUMAN_REVIEW, '👀 needs-human-review');
  assert.strictEqual(LABELS.SECURITY_ISSUE, '🔒 security-issue');
  assert.strictEqual(LABELS.PERFORMANCE_ISSUE, '⚡ performance-issue');
  assert.strictEqual(LABELS.NEEDS_DOCS_UPDATE, '📚 needs-docs-update');
});

// ==========================================
// SMOKE TESTS
// ==========================================

test('módulo deve exportar todas as funções', () => {
  assert(typeof applyLabels === 'function');
  assert(typeof applyLabelsWithReplace === 'function');
  assert(typeof removeOldLabels === 'function');
  assert(typeof LABELS === 'object');
});

await testAsync('applyLabels deve retornar array de strings', async () => {
  const reviewData = {
    summary: { total_issues: 0, auto_fixable: 0, critical: 0, needs_agent: 0 },
    issues: []
  };
  
  const result = await applyLabels(reviewData, 1);
  
  assert(Array.isArray(result));
  assert(result.every(label => typeof label === 'string'));
});

// ==========================================
// RESUMO
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
