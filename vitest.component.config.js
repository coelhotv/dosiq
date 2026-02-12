import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,

    // Configuração para testes de componentes
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,

    isolate: false,

    testTimeout: 30000,
    hookTimeout: 10000,

    // Incluir APENAS testes de componentes de dashboard
    include: [
      'src/components/dashboard/__tests__/*.test.jsx'
    ],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,out,temp}/**',
    ],

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
