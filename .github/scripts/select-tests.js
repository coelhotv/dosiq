#!/usr/bin/env node
/**
 * Script de Seleção Inteligente de Testes
 * 
 * Este script analisa os arquivos modificados no git e mapeia para os
 * testes correspondentes que precisam ser executados.
 * 
 * Uso:
 *   node .github/scripts/select-tests.js
 *   node .github/scripts/select-tests.js | xargs vitest run
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Obtém lista de arquivos modificados no git
 */
function getChangedFiles() {
  try {
    // Tentar obter arquivos do último commit
    const output = execSync('git diff --name-only HEAD~1', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // Se falhar (ex: primeiro commit), tentar staged files
    try {
      const staged = execSync('git diff --name-only --staged', { encoding: 'utf-8' });
      return staged.trim().split('\n').filter(Boolean);
    } catch (e2) {
      console.error('⚠️  Não foi possível obter arquivos modificados:', e2.message);
      return [];
    }
  }
}

/**
 * Obtém arquivos modificados que ainda não estão commitados (staged + unstaged)
 */
function getUncommittedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    const staged = execSync('git diff --name-only --staged', { encoding: 'utf-8' });
    const all = new Set([
      ...output.trim().split('\n').filter(Boolean),
      ...staged.trim().split('\n').filter(Boolean)
    ]);
    return Array.from(all);
  } catch {
    return [];
  }
}

/**
 * Verifica se um arquivo de teste existe
 */
function testFileExists(testPath) {
  return fs.existsSync(testPath);
}

/**
 * Mapeia arquivos modificados para seus testes correspondentes
 */
function mapToTestFiles(changedFiles) {
  const testFiles = new Set();
  
  changedFiles.forEach(file => {
    // Ignorar arquivos que não são do src
    if (!file.startsWith('src/')) {
      return;
    }
    
    // Se já é um arquivo de teste, incluí-lo
    if (file.includes('.test.') || file.includes('.spec.')) {
      testFiles.add(file);
      return;
    }
    
    const ext = path.extname(file);
    const dir = path.dirname(file);
    const baseName = path.basename(file, ext);
    
    // Padrão 1: Teste no mesmo diretório (Component.test.jsx)
    const sameDirTest = path.join(dir, `${baseName}.test${ext}`);
    if (testFileExists(sameDirTest)) {
      testFiles.add(sameDirTest);
    }
    
    // Padrão 2: Teste em __tests__/ subdirectory
    const testsDir = path.join(dir, '__tests__', `${baseName}.test${ext}`);
    if (testFileExists(testsDir)) {
      testFiles.add(testsDir);
    }
    
    // Para services: também incluir teste na pasta __tests__ de api/
    if (file.includes('/services/')) {
      const serviceTest = path.join('src/services/api/__tests__', `${baseName}.test${ext}`);
      if (testFileExists(serviceTest)) {
        testFiles.add(serviceTest);
      }
    }
    
    // Para utils: procurar em utils/__tests__/
    if (file.includes('/utils/')) {
      const utilTest = path.join('src/utils/__tests__', `${baseName}.test${ext}`);
      if (testFileExists(utilTest)) {
        testFiles.add(utilTest);
      }
    }
    
    // Para schemas: procurar em schemas/__tests__/
    if (file.includes('/schemas/')) {
      const schemaTest = path.join('src/schemas/__tests__', `${baseName}.test${ext}`);
      if (testFileExists(schemaTest)) {
        testFiles.add(schemaTest);
      }
    }
    
    // Para lib: procurar em lib/__tests__/
    if (file.includes('/lib/')) {
      const libTest = path.join('src/lib/__tests__', `${baseName}.test${ext}`);
      if (testFileExists(libTest)) {
        testFiles.add(libTest);
      }
    }
  });
  
  return Array.from(testFiles);
}

/**
 * Função principal
 */
function main() {
  // Verificar se há argumento --uncommitted
  const args = process.argv.slice(2);
  const useUncommitted = args.includes('--uncommitted');
  
  // Obter arquivos modificados
  const changedFiles = useUncommitted ? getUncommittedFiles() : getChangedFiles();
  
  if (changedFiles.length === 0) {
    console.log('ℹ️  Nenhum arquivo modificado encontrado. Rodando smoke tests...');
    process.exit(0);
  }
  
  console.error(`📁 Arquivos modificados (${changedFiles.length}):`);
  changedFiles.forEach(f => console.error(`   - ${f}`));
  
  // Mapear para testes
  const testFiles = mapToTestFiles(changedFiles);
  
  if (testFiles.length === 0) {
    console.error('\n⚠️  Nenhum teste encontrado para os arquivos modificados.');
    console.error('   Rodando smoke tests como fallback...');
    process.exit(0);
  }
  
  console.error(`\n🧪 Testes selecionados (${testFiles.length}):`);
  testFiles.forEach(t => console.error(`   - ${t}`));
  
  // Output apenas os caminhos dos testes (para pipe com xargs)
  console.log(testFiles.join(' '));
}

// Executar
main();