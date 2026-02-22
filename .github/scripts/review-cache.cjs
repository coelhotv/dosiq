/**
 * Módulo de cache para reviews do Gemini Code Assist
 *
 * Armazena resultados de reviews baseado em hash de conteúdo do arquivo,
 * evitando re-análise de código não alterado e reduzindo chamadas à API Gemini.
 *
 * @module review-cache
 * @version 1.0.0
 * @created 2026-02-21
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = '.gemini-cache';
const CACHE_METADATA_FILE = 'cache-metadata.json';

/**
 * Garante que o diretório de cache existe
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Gera hash do conteúdo do arquivo
 *
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} Hash SHA-256 em hexadecimal
 */
function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    console.error(`Erro ao gerar hash para ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Gera hash a partir de uma string
 *
 * @param {string} content - Conteúdo para hash
 * @returns {string} Hash SHA-256 em hexadecimal
 */
function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Retorna o caminho do arquivo de cache para um review
 *
 * @param {string} filePath - Caminho do arquivo
 * @param {number} line - Linha do issue
 * @returns {string} Caminho do arquivo de cache
 */
function getCacheFilePath(filePath, line) {
  const fileHash = hashContent(filePath);
  const cacheKey = `${fileHash}_${line}.json`;
  return path.join(CACHE_DIR, cacheKey);
}

/**
 * Retorna o caminho do arquivo de metadados do cache
 *
 * @returns {string} Caminho do arquivo de metadados
 */
function getMetadataPath() {
  return path.join(CACHE_DIR, CACHE_METADATA_FILE);
}

/**
 * Carrega metadados do cache
 *
 * @returns {Object} Metadados do cache
 */
function loadMetadata() {
  const metadataPath = getMetadataPath();
  if (fs.existsSync(metadataPath)) {
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar metadados do cache:', error.message);
    }
  }
  return { entries: {}, lastCleanup: null };
}

/**
 * Salva metadados do cache
 *
 * @param {Object} metadata - Metadados a serem salvos
 */
function saveMetadata(metadata) {
  ensureCacheDir();
  const metadataPath = getMetadataPath();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Busca review em cache
 *
 * Verifica se existe um review cacheado para o arquivo/linha e se o hash
 * do conteúdo atual coincide com o hash quando o review foi gerado.
 *
 * @param {string} filePath - Caminho do arquivo
 * @param {number} line - Linha do issue
 * @returns {Object|null} Review cacheado ou null se não encontrado ou desatualizado
 */
function getCachedReview(filePath, line) {
  ensureCacheDir();

  const currentHash = hashFile(filePath);
  if (!currentHash) {
    return null;
  }

  const cacheFilePath = getCacheFilePath(filePath, line);

  if (!fs.existsSync(cacheFilePath)) {
    return null;
  }

  try {
    const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));

    // Verifica se o hash do conteúdo coincide
    if (cachedData.contentHash !== currentHash) {
      console.log(`Cache desatualizado para ${filePath}:${line}`);
      return null;
    }

    console.log(`Cache hit para ${filePath}:${line}`);
    return cachedData.review;
  } catch (error) {
    console.error(`Erro ao ler cache para ${filePath}:${line}:`, error.message);
    return null;
  }
}

/**
 * Salva review no cache
 *
 * @param {string} filePath - Caminho do arquivo
 * @param {number} line - Linha do issue
 * @param {Object} review - Dados do review
 */
function setCachedReview(filePath, line, review) {
  ensureCacheDir();

  const contentHash = hashFile(filePath);
  if (!contentHash) {
    return;
  }

  const cacheFilePath = getCacheFilePath(filePath, line);
  const cacheData = {
    contentHash,
    filePath,
    line,
    review,
    timestamp: new Date().toISOString()
  };

  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));

    // Atualiza metadados
    const metadata = loadMetadata();
    metadata.entries[`${filePath}:${line}`] = {
      cacheFile: path.basename(cacheFilePath),
      timestamp: cacheData.timestamp,
      contentHash
    };
    saveMetadata(metadata);

    console.log(`Cache salvo para ${filePath}:${line}`);
  } catch (error) {
    console.error(`Erro ao salvar cache para ${filePath}:${line}:`, error.message);
  }
}

/**
 * Verifica se existe um review cacheado válido para o arquivo/linha
 *
 * @param {string} filePath - Caminho do arquivo
 * @param {number} line - Linha do issue
 * @returns {boolean} True se existe cache válido
 */
function hasValidCache(filePath, line) {
  return getCachedReview(filePath, line) !== null;
}

/**
 * Invalida cache para um arquivo específico
 *
 * @param {string} filePath - Caminho do arquivo
 */
function invalidateCacheForFile(filePath) {
  const metadata = loadMetadata();
  const entriesToDelete = Object.keys(metadata.entries).filter(key =>
    key.startsWith(`${filePath}:`)
  );

  entriesToDelete.forEach(key => {
    const entry = metadata.entries[key];
    const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);

    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }

    delete metadata.entries[key];
    console.log(`Cache invalidado para ${key}`);
  });

  saveMetadata(metadata);
}

/**
 * Limpa cache expirado (mais antigo que X dias)
 *
 * @param {number} maxAgeDays - Idade máxima em dias (padrão: 30)
 * @returns {number} Número de entradas removidas
 */
function cleanExpiredCache(maxAgeDays = 30) {
  ensureCacheDir();

  const metadata = loadMetadata();
  const now = new Date();
  let removedCount = 0;

  const entriesToDelete = Object.keys(metadata.entries).filter(key => {
    const entry = metadata.entries[key];
    const entryDate = new Date(entry.timestamp);
    const ageInDays = (now - entryDate) / (1000 * 60 * 60 * 24);
    return ageInDays > maxAgeDays;
  });

  entriesToDelete.forEach(key => {
    const entry = metadata.entries[key];
    const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);

    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }

    delete metadata.entries[key];
    removedCount++;
  });

  metadata.lastCleanup = new Date().toISOString();
  saveMetadata(metadata);

  console.log(`Limpeza de cache: ${removedCount} entradas removidas`);
  return removedCount;
}

/**
 * Obtém estatísticas do cache
 *
 * @returns {Object} Estatísticas do cache
 */
function getCacheStats() {
  ensureCacheDir();

  const metadata = loadMetadata();
  const entries = Object.values(metadata.entries);

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      lastCleanup: metadata.lastCleanup,
      oldestEntry: null,
      newestEntry: null
    };
  }

  entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    totalEntries: entries.length,
    lastCleanup: metadata.lastCleanup,
    oldestEntry: entries[0].timestamp,
    newestEntry: entries[entries.length - 1].timestamp
  };
}

/**
 * Limpa todo o cache
 *
 * @returns {number} Número de arquivos removidos
 */
function clearAllCache() {
  ensureCacheDir();

  const files = fs.readdirSync(CACHE_DIR);
  let removedCount = 0;

  files.forEach(file => {
    const filePath = path.join(CACHE_DIR, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      fs.unlinkSync(filePath);
      removedCount++;
    }
  });

  // Reset metadados
  saveMetadata({ entries: {}, lastCleanup: new Date().toISOString() });

  console.log(`Cache limpo: ${removedCount} arquivos removidos`);
  return removedCount;
}

module.exports = {
  hashFile,
  hashContent,
  getCachedReview,
  setCachedReview,
  hasValidCache,
  invalidateCacheForFile,
  cleanExpiredCache,
  getCacheStats,
  clearAllCache
};
