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
        'src/services/**/*.test.{js,jsx,ts,tsx}',
        'src/utils/**/*.test.{js,jsx,ts,tsx}',
        'src/schemas/**/*.test.{js,jsx,ts,tsx}',
        'src/shared/hooks/**/*.test.{js,jsx,ts,tsx}',
        'src/features/**/services/**/*.test.{js,jsx,ts,tsx}',
        'src/features/**/utils/**/*.test.{js,jsx,ts,tsx}',
        'src/features/**/hooks/**/*.test.{js,jsx,ts,tsx}',
        // Helpers canônicos compartilhados (Fase 2.5+) — críticos pra paridade web↔mobile
        '../../packages/core/src/**/*.test.{js,jsx,ts,tsx}',
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
      fileParallelism: false,

      reporters: ['dot'],

      cache: {
        dir: '.vitest-cache-critical',
      },
    },
  }),
)
