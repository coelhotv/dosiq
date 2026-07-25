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
        'src/**/*.test.{js,jsx,ts,tsx}',
        '../../server/**/*.test.{js,jsx,ts,tsx}',
        '../../packages/core/src/**/*.test.{js,jsx,ts,tsx}',
        // 051 T062: `api/` não tinha NENHUM teste (`find api -name '*test*'` era vazio) e por isso
        // não estava em nenhum include. O handler do kill switch de versão inaugura a superfície —
        // sem esta linha o arquivo de teste existiria e nunca seria coletado (classe AP-289: gate
        // verde que não roda o que promete proteger).
        '../../api/**/*.test.{js,jsx,ts,tsx}',
      ],

      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          'src/main.tsx',
          'src/App.tsx',
          '**/__tests__/**',
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.config.js',
        ],
      },
    },
  }),
)
