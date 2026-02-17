import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Configuração de Testes Críticos
 *
 * Esta configuração foca apenas nos testes mais importantes para validação rápida:
 * - Services (lógica de negócio)
 * - Utils (funções auxiliares)
 * - Schemas (validação de dados)
 * - Hooks (lógica reutilizável)
 * - Features (nova organização)
 *
 * NÃO inclui componentes de UI que são mais lentos de testar.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',

    // Apenas testes críticos (excluir componentes UI e smoke)
    include: [
      'src/services/**/*.test.{js,jsx}',
      'src/utils/**/*.test.{js,jsx}',
      'src/schemas/**/*.test.{js,jsx}',
      'src/hooks/**/*.test.{js,jsx}',
      'src/features/**/*.test.{js,jsx}',
    ],
    exclude: [
      '**/*.smoke.test.*',
      '**/*.integration.test.*',
      'src/components/**/*',
      'src/shared/components/**/*',
      'node_modules/',
    ],

    // Pool otimizado para CI (Vitest 4+)
    pool: 'threads',
    maxThreads: 2,
    minThreads: 1,

    // Timeouts agressivos
    testTimeout: 10000,
    hookTimeout: 5000,

    // Reporter minimalista
    reporters: ['dot'],

    // Cache separado
    cache: {
      dir: '.vitest-cache-critical',
    },
  },
})
