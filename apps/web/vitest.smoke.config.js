import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.base.config.js'

/**
 * Configuração de Smoke Tests — apenas arquivos *.smoke.test.{js,jsx,ts,tsx}.
 *
 * Pool threads single. Timeout curto (5s).
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: './src/test/setup.js',
      include: ['src/**/*.smoke.test.{js,jsx,ts,tsx}'],

      pool: 'threads',
      fileParallelism: false,
      maxWorkers: 1,
      minWorkers: 1,

      testTimeout: 5000,

      reporters: ['dot'],
    },
  }),
)
