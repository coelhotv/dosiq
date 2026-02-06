import { defineConfig } from 'vitest/config';

/**
 * Configuração de Smoke Tests
 *
 * Suite mínima e rápida para verificar se a aplicação está funcionando.
 * Deve executar em menos de 30 segundos.
 *
 * Testes incluídos:
 * - queryCache: Validação do sistema de cache
 * - validation: Validação de schemas
 * - api.test: Testes básicos de API
 * - Button: Componente UI essencial
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',

    // Apenas testes essenciais para smoke test
    include: [
      'src/lib/__tests__/queryCache.test.js',
      'src/schemas/__tests__/validation.test.js',
      'src/services/api.test.js',
      'src/components/ui/Button.test.jsx',
    ],

    // Pool minimalista - apenas 1 thread (Vitest 4+ formato)
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,

    // Sem isolamento para máxima velocidade
    isolate: false,

    // Timeouts curtos
    testTimeout: 3000,
    hookTimeout: 3000,

    // Reporter simples
    reporters: ['dot'],

    // Sem cobertura
    coverage: {
      enabled: false,
    },
  },
});