import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.base.config.js'

/**
 * Configuração de CI/CD com Coverage.
 *
 * Suite completa de testes + cobertura. Pool threads (max 2) e timeout maior.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: './src/test/setup.js',

      include: ['src/**/*.test.{js,jsx}'],

      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 2,
          minThreads: 1,
        },
      },

      testTimeout: 15000,

      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'lcov', 'html', 'json'],

        include: ['src/**/*.{js,jsx}'],
        exclude: [
          'src/test/',
          'src/main.jsx',
          'src/App.jsx',
          '**/__tests__/**',
          '**/*.test.{js,jsx}',
          '**/*.config.js',
          '**/node_modules/**',
        ],

        thresholds: {
          lines: 40,
          functions: 40,
          branches: 40,
          statements: 40,
        },
      },
    },
  }),
)
