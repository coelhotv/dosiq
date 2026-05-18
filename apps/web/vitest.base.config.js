import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Base config compartilhado entre TODOS os vitest configs do workspace web.
 *
 * Por que existe: AP-170 (RETRO Fase 2) — aliases adicionados em vitest.config.js
 * não propagavam para configs secundários (critical, ci, lowram, smoke). Resultado:
 * tests passavam local (config.js) mas `validate:agent` quebrava (critical.config.js)
 * com `is not a function` em imports de @dosiq/core.
 *
 * Pattern: cada config secundário faz `mergeConfig(baseConfig, defineConfig({...override...}))`
 * para herdar aliases + plugins + test base e sobrescrever apenas o que precisa.
 *
 * IMPORTANTE: alias novos vão SEMPRE aqui (fonte única). Configs filhos só sobrescrevem
 * quando precisam de path divergente (ex: critical aponta @schemas pra @dosiq/core).
 */
export const baseConfig = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@dashboard': path.resolve(__dirname, './src/features/dashboard'),
      '@medications': path.resolve(__dirname, './src/features/medications'),
      '@protocols': path.resolve(__dirname, './src/features/protocols'),
      '@stock': path.resolve(__dirname, './src/features/stock'),
      '@adherence': path.resolve(__dirname, './src/features/adherence'),
      '@calendar': path.resolve(__dirname, './src/features/calendar'),
      '@emergency': path.resolve(__dirname, './src/features/emergency'),
      '@prescriptions': path.resolve(__dirname, './src/features/prescriptions'),
      '@consultation': path.resolve(__dirname, './src/features/consultation'),
      '@reports': path.resolve(__dirname, './src/features/reports'),
      '@export': path.resolve(__dirname, './src/features/export'),
      '@costs': path.resolve(__dirname, './src/features/costs'),
      '@interactions': path.resolve(__dirname, './src/features/interactions'),
      '@dosiq/core': path.resolve(__dirname, '../../packages/core/src'),
      '@schemas': path.resolve(__dirname, './src/schemas'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
})

export default baseConfig
