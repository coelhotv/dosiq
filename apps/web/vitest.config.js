import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.base.config.js'

/**
 * Config padrão (dev local) — herda baseConfig + override para incluir
 * tests do monorepo (server + packages/core).
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      pool: 'threads',
      singleThread: true,
      maxThreads: 1,
      minThreads: 1,

      include: [
        'src/**/*.test.{js,jsx}',
        '../../server/**/*.test.{js,jsx}',
        '../../packages/core/src/**/*.test.{js,jsx}',
      ],

      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          'src/main.jsx',
          'src/App.jsx',
          '**/__tests__/**',
          '**/*.test.{js,jsx}',
          '**/*.config.js',
        ],
      },
    },
  }),
)
