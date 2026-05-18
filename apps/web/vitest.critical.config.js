import { defineConfig, mergeConfig } from 'vitest/config'
import path from 'path'
import baseConfig from './vitest.base.config.js'

/**
 * Configuração de Testes Críticos (CI kill switch — validate:agent).
 *
 * Foca apenas nos testes mais importantes para validação rápida:
 * - Services (lógica de negócio)
 * - Utils (funções auxiliares)
 * - Schemas (validação de dados)
 * - Hooks (lógica reutilizável)
 * - Features: services/utils/hooks (NÃO components)
 *
 * Pool 'forks' (menos memória que threads). Bail 1 (fail fast).
 *
 * Override: @schemas aponta para `packages/core/src/schemas` (canonical).
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@schemas': path.resolve(__dirname, '../../packages/core/src/schemas'),
      },
    },
    test: {
      setupFiles: './src/test/setup.js',
      bail: 1,

      include: [
        'src/services/**/*.test.{js,jsx}',
        'src/utils/**/*.test.{js,jsx}',
        'src/schemas/**/*.test.{js,jsx}',
        'src/shared/hooks/**/*.test.{js,jsx}',
        'src/features/**/services/**/*.test.{js,jsx}',
        'src/features/**/utils/**/*.test.{js,jsx}',
        'src/features/**/hooks/**/*.test.{js,jsx}',
      ],
      exclude: [
        '**/*.smoke.test.*',
        '**/*.integration.test.*',
        'src/components/**/*',
        'src/shared/components/**/*',
        'src/features/**/components/**/*',
        'node_modules/',
      ],

      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },

      reporters: ['dot'],

      cache: {
        dir: '.vitest-cache-critical',
      },
    },
  }),
)
