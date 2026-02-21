/**
 * Testes unitários para review-cache.cjs
 *
 * @run node .github/scripts/__tests__/review-cache.test.cjs
 */

const fs = require('fs');
const path = require('path');
const {
  hashFile,
  hashContent,
  getCachedReview,
  setCachedReview,
  hasValidCache,
  invalidateCacheForFile,
  cleanExpiredCache,
  getCacheStats,
  clearAllCache
} = require('../review-cache.cjs');

// ==========================================
// CONFIGURAÇÃO DE TESTE
// ==========================================

const TEST_CACHE_DIR = '.gemini-cache';
const TEST_FILE = path.join(TEST_CACHE_DIR, 'test-file.js');

// Setup e teardown
function setup() {
  // Limpa cache antes de cada teste
  clearAllCache();

  // Cria arquivo de teste
  if (!fs.existsSync(TEST_CACHE_DIR)) {
    fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(TEST_FILE, '// Test file content\nconst x = 1;\n');
}

function teardown() {
  // Limpa após testes
  clearAllCache();
  if (fs.existsSync(TEST_FILE)) {
    fs.unlinkSync(TEST_FILE);
  }
}

// ==========================================
// UTILITÁRIOS DE TESTE
// ==========================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  } finally {
    teardown();
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ==========================================
// TESTES
// ==========================================

// Teste 1: hashFile gera hash SHA-256 válido
test('hashFile gera hash SHA-256 válido', () => {
  const hash = hashFile(TEST_FILE);
  assert(hash !== null, 'Hash não deve ser null');
  assert(hash.length === 64, 'Hash SHA-256 deve ter 64 caracteres hexadecimais');
  assert(/^[a-f0-9]{64}$/.test(hash), 'Hash deve ser hexadecimal válido');
});

// Teste 2: hashContent gera hash consistente
test('hashContent gera hash consistente para mesmo conteúdo', () => {
  const content = 'test content';
  const hash1 = hashContent(content);
  const hash2 = hashContent(content);

  assert(hash1 === hash2, 'Hash do mesmo conteúdo deve ser idêntico');
  assert(hash1.length === 64, 'Hash deve ter 64 caracteres');
});

// Teste 3: hashContent gera hashes diferentes para conteúdos diferentes
test('hashContent gera hashes diferentes para conteúdos diferentes', () => {
  const hash1 = hashContent('content A');
  const hash2 = hashContent('content B');

  assert(hash1 !== hash2, 'Hashes de conteúdos diferentes devem ser diferentes');
});

// Teste 4: hashFile retorna null para arquivo inexistente
test('hashFile retorna null para arquivo inexistente', () => {
  const hash = hashFile('/caminho/inexistente/arquivo.js');
  assert(hash === null, 'Hash de arquivo inexistente deve ser null');
});

// Teste 5: setCachedReview salva review no cache
test('setCachedReview salva review no cache', () => {
  const review = {
    id: 123,
    file: 'test.js',
    line: 10,
    issue: 'Test issue',
    priority: 'MEDIUM'
  };

  setCachedReview(TEST_FILE, 10, review);

  const cached = getCachedReview(TEST_FILE, 10);
  assert(cached !== null, 'Review deve estar no cache');
  assert(cached.id === 123, 'ID do review deve corresponder');
  assert(cached.issue === 'Test issue', 'Issue deve corresponder');
});

// Teste 6: getCachedReview retorna null para cache inexistente
test('getCachedReview retorna null para cache inexistente', () => {
  const cached = getCachedReview(TEST_FILE, 999);
  assert(cached === null, 'Cache inexistente deve retornar null');
});

// Teste 7: getCachedReview retorna null quando arquivo é modificado
test('getCachedReview retorna null quando arquivo é modificado', () => {
  const review = { id: 456, issue: 'Original issue' };

  // Salva review no cache
  setCachedReview(TEST_FILE, 20, review);

  // Verifica que está no cache
  let cached = getCachedReview(TEST_FILE, 20);
  assert(cached !== null, 'Review deve estar no cache inicialmente');

  // Modifica o arquivo
  fs.writeFileSync(TEST_FILE, '// Modified content\nconst y = 2;\n');

  // Agora o cache deve estar invalidado
  cached = getCachedReview(TEST_FILE, 20);
  assert(cached === null, 'Cache deve ser invalidado após modificação do arquivo');
});

// Teste 8: hasValidCache retorna true para cache válido
test('hasValidCache retorna true para cache válido', () => {
  setCachedReview(TEST_FILE, 30, { id: 789, issue: 'Test' });

  const valid = hasValidCache(TEST_FILE, 30);
  assert(valid === true, 'hasValidCache deve retornar true para cache válido');
});

// Teste 9: hasValidCache retorna false para cache inexistente
test('hasValidCache retorna false para cache inexistente', () => {
  const valid = hasValidCache(TEST_FILE, 999);
  assert(valid === false, 'hasValidCache deve retornar false para cache inexistente');
});

// Teste 10: invalidateCacheForFile remove todos os caches do arquivo
test('invalidateCacheForFile remove todos os caches do arquivo', () => {
  // Cria múltiplos caches para o mesmo arquivo
  setCachedReview(TEST_FILE, 1, { id: 1 });
  setCachedReview(TEST_FILE, 2, { id: 2 });
  setCachedReview(TEST_FILE, 3, { id: 3 });

  // Verifica que existem
  assert(hasValidCache(TEST_FILE, 1), 'Cache linha 1 deve existir');
  assert(hasValidCache(TEST_FILE, 2), 'Cache linha 2 deve existir');
  assert(hasValidCache(TEST_FILE, 3), 'Cache linha 3 deve existir');

  // Invalida
  invalidateCacheForFile(TEST_FILE);

  // Verifica que foram removidos
  assert(!hasValidCache(TEST_FILE, 1), 'Cache linha 1 deve ser removido');
  assert(!hasValidCache(TEST_FILE, 2), 'Cache linha 2 deve ser removido');
  assert(!hasValidCache(TEST_FILE, 3), 'Cache linha 3 deve ser removido');
});

// Teste 11: cleanExpiredCache remove entradas antigas
test('cleanExpiredCache remove entradas antigas', () => {
  // Cria cache
  setCachedReview(TEST_FILE, 40, { id: 100 });

  // Modifica metadados para simular entrada antiga (31 dias)
  const metadataPath = path.join(TEST_CACHE_DIR, 'cache-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 31);
  metadata.entries[`${TEST_FILE}:40`].timestamp = oldDate.toISOString();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Limpa cache com maxAgeDays = 30
  const removed = cleanExpiredCache(30);

  assert(removed === 1, 'Deve remover 1 entrada expirada');
  assert(!hasValidCache(TEST_FILE, 40), 'Cache expirado não deve mais existir');
});

// Teste 12: cleanExpiredCache mantém entradas recentes
test('cleanExpiredCache mantém entradas recentes', () => {
  setCachedReview(TEST_FILE, 50, { id: 200 });

  // Limpa com maxAgeDays = 30 (entrada tem 0 dias)
  const removed = cleanExpiredCache(30);

  assert(removed === 0, 'Não deve remover entradas recentes');
  assert(hasValidCache(TEST_FILE, 50), 'Cache recente deve ser mantido');
});

// Teste 13: getCacheStats retorna estatísticas corretas
test('getCacheStats retorna estatísticas corretas', () => {
  // Limpa e cria caches conhecidos
  clearAllCache();
  setup();

  setCachedReview(TEST_FILE, 60, { id: 300 });
  setCachedReview(TEST_FILE, 61, { id: 301 });

  const stats = getCacheStats();

  assert(stats.totalEntries === 2, 'Deve haver 2 entradas no cache');
  assert(stats.oldestEntry !== null, 'Deve ter data da entrada mais antiga');
  assert(stats.newestEntry !== null, 'Deve ter data da entrada mais nova');
});

// Teste 14: clearAllCache remove todas as entradas
test('clearAllCache remove todas as entradas', () => {
  setCachedReview(TEST_FILE, 70, { id: 400 });
  setCachedReview(TEST_FILE, 71, { id: 401 });
  setCachedReview(TEST_FILE, 72, { id: 402 });

  assert(getCacheStats().totalEntries === 3, 'Deve haver 3 entradas');

  const removed = clearAllCache();

  assert(removed >= 3, 'Deve remover pelo menos 3 arquivos');
  assert(getCacheStats().totalEntries === 0, 'Cache deve estar vazio');
});

// Teste 15: Cache persiste entre chamadas
test('Cache persiste entre chamadas', () => {
  const review = { id: 500, issue: 'Persistent issue' };

  // Primeira chamada - salva
  setCachedReview(TEST_FILE, 80, review);

  // Simula nova "sessão" lendo do disco
  const cached = getCachedReview(TEST_FILE, 80);

  assert(cached !== null, 'Cache deve persistir no disco');
  assert(cached.id === 500, 'Dados do review devem ser preservados');
  assert(cached.issue === 'Persistent issue', 'Issue deve ser preservada');
});

// Teste 16: Múltiplos arquivos podem ser cacheados independentemente
test('Múltiplos arquivos podem ser cacheados independentemente', () => {
  const testFile2 = path.join(TEST_CACHE_DIR, 'test-file-2.js');
  fs.writeFileSync(testFile2, '// Second test file');

  setCachedReview(TEST_FILE, 90, { id: 600, file: 'file1' });
  setCachedReview(testFile2, 90, { id: 601, file: 'file2' });

  const cached1 = getCachedReview(TEST_FILE, 90);
  const cached2 = getCachedReview(testFile2, 90);

  assert(cached1.file === 'file1', 'Primeiro arquivo deve ter dados corretos');
  assert(cached2.file === 'file2', 'Segundo arquivo deve ter dados corretos');

  // Limpa
  fs.unlinkSync(testFile2);
});

// Teste 17: Múltiplas linhas do mesmo arquivo podem ser cacheadas
test('Múltiplas linhas do mesmo arquivo podem ser cacheadas', () => {
  setCachedReview(TEST_FILE, 100, { id: 700, line: 100 });
  setCachedReview(TEST_FILE, 101, { id: 701, line: 101 });
  setCachedReview(TEST_FILE, 102, { id: 702, line: 102 });

  const cached100 = getCachedReview(TEST_FILE, 100);
  const cached101 = getCachedReview(TEST_FILE, 101);
  const cached102 = getCachedReview(TEST_FILE, 102);

  assert(cached100.line === 100, 'Linha 100 deve estar cacheada');
  assert(cached101.line === 101, 'Linha 101 deve estar cacheada');
  assert(cached102.line === 102, 'Linha 102 deve estar cacheada');
});

// ==========================================
// RESUMO
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
