import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.base.config.js'

/**
 * Configuração otimizada para máquinas com pouca RAM (< 8GB).
 *
 * Executar com: vitest run --config vitest.lowram.config.js
 * Ou via npm: npm run test:lowram
 *
 * Pool forks (singleFork), timeouts generosos, sem coverage.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      pool: 'forks',
      fileParallelism: false,

      testTimeout: 15000,

      include: ['src/**/*.test.{js,jsx,ts,tsx}'],

      coverage: {
        enabled: false,
      },

      reporters: ['dot'],

      cache: {
        dir: '.vitest-cache-lowram',
      },
    },
  }),
)
