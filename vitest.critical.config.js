import { defineConfig } from 'vitest/config';

/**
 * Configuração de Testes Críticos
 * 
 * Esta configuração foca apenas nos testes mais importantes para validação rápida:
 * - Services (lógica de negócio)
 * - Utils (funções auxiliares)
 * - Schemas (validação de dados)
 * - Hooks (lógica reutilizável)
 * 
 * NÃO inclui componentes de UI que são mais lentos de testar.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    
    // Apenas testes críticos (excluir componentes)
    include: [
      'src/services/**/*.{test,spec}.{js,jsx}',
      'src/utils/**/*.{test,spec}.{js,jsx}',
      'src/schemas/**/*.{test,spec}.{js,jsx}',
      'src/hooks/**/*.{test,spec}.{js,jsx}',
    ],
    exclude: [
      'src/components/**/*',
      '**/*.integration.test.js',
      'node_modules/',
    ],
    
    // Pool de threads otimizado (Vitest 4+ formato)
    pool: 'threads',
    maxThreads: 2,
    minThreads: 1,
    useAtomics: true,
    
    // Desativar isolamento para mais velocidade
    isolate: false,
    
    // Timeouts agressivos
    testTimeout: 5000,
    hookTimeout: 5000,
    
    // Reporter minimalista
    reporters: ['dot'],
    
    // Cache
    cache: {
      dir: '.vitest-cache-critical',
    },
  },
});