#!/usr/bin/env node
/**
 * Script inteligente para seleção de testes baseado em git diff
 * Executa apenas os testes necessários para as mudanças atuais
 */

import { execSync } from 'child_process'

const patterns = {
  config: /\.(config|rc)\./,           // Arquivos de config
  workflow: /^\.github\//,              // CI/CD
  service: /src\/services\//,          // Services
  schema: /src\/schemas\//,            // Schemas
  hook: /src\/hooks\//,                // Hooks
  util: /src\/utils\//,                // Utils
  component: /src\/components\//,      // Componentes
  lib: /src\/lib\//,                   // Libs core
}

function detectChangeType(files) {
  if (files.some(f => patterns.config.test(f) || patterns.workflow.test(f))) {
    return 'full'  // Mudança em config = suite completa
  }
  if (files.some(f => patterns.service.test(f) || patterns.schema.test(f) || patterns.hook.test(f))) {
    return 'critical'  // Core da aplicação
  }
  if (files.some(f => patterns.util.test(f) || patterns.lib.test(f))) {
    return 'unit'  // Utils e libs
  }
  return 'related'  // Apenas testes relacionados
}

function runTests(type) {
  const commands = {
    full: 'npm run test:full',
    critical: 'npm run test:critical',
    unit: 'npm run test:unit',
    related: 'npm run test:changed',
  }
  
  console.log(`🧪 Executando: ${commands[type]}`)
  execSync(commands[type], { stdio: 'inherit' })
}

// Main
try {
  const diff = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  const files = diff.split('\n').filter(Boolean)
  
  if (files.length === 0) {
    console.log('ℹ️  Nenhuma alteração detectada. Executando test:related...')
    runTests('related')
  } else {
    const type = detectChangeType(files)
    console.log(`📁 Arquivos alterados: ${files.length}`)
    console.log(`🔍 Tipo detectado: ${type}`)
    runTests(type)
  }
} catch (error) {
  console.error('❌ Erro ao executar testes:', error.message)
  process.exit(1)
}