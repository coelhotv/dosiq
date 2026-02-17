import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,

    // ==========================================
    // OTIMIZAÇÕES PARA VITEST 4+ (Testing Infrastructure Overhaul)
    // ==========================================

    // Executar apenas 1 thread para evitar sobrecarga
    pool: 'threads',
    singleThread: true,
    maxThreads: 1,
    minThreads: 1,

    // Limites de tempo mais generosos
    testTimeout: 30000,
    hookTimeout: 10000,

    // Incluir TODOS os testes (incluindo components/ e features/)
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],

    // Coverage mais leve
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
})
