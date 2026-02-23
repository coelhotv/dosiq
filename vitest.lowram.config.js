import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Configuração otimizada para máquinas com pouca RAM (< 8GB)
 *
 * Executar com: vitest run --config vitest.lowram.config.js
 * Ou via npm: npm run test:lowram
 *
 * Mudanças vs config padrão:
 * - maxThreads: 1 (evita overhead de múltiplas threads)
 * - testTimeout: 15000 (mais generoso para máquinas lentas)
 * - Sem coverage por padrão (economiza memória)
 * - Isolate: false (mais eficiente em memória)
 */
export default defineConfig({
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

    // Otimizações para baixa RAM
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Executar sequencialmente
      },
    },

    // Timeouts mais generosos (máquinas lentas)
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    // Todos os testes (incluindo os anteriormente excluídos por OOM — agora corrigidos na refatoração)
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],

    // Coverage desabilitado por padrão
    coverage: {
      enabled: false,
    },

    // Reporter minimalista para economizar output
    reporters: ['dot'],

    // Cache com nome diferente
    cache: {
      dir: '.vitest-cache-lowram',
    },
  },
})
