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
    // OTIMIZAÇÕES PARA MACBOOK AIR 2013 (Vitest 4+)
    // ==========================================

    // Executar apenas 1 thread para evitar sobrecarga
    pool: 'threads',
    singleThread: true,  // MUITO importante para machines antigas
    maxThreads: 1,
    minThreads: 1,

    // Não isolar testes (mais rápido, mas cuidado com estado compartilhado)
    isolate: false,

    // Limites de tempo mais generosos
    testTimeout: 30000,
    hookTimeout: 10000,

    // Excluir testes de componentes UI que são lentos
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,out,temp}/**',
      '**/src/components/**/*.test.jsx',
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
      ],
    },
  },
})
