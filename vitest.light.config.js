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
    // CONFIGURAÇÃO LEVE PARA MACBOOK AIR 2013
    // ==========================================
    
    // Executar em thread única
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1,
      },
    },
    
    // Não isolar testes para maior velocidade
    isolate: false,
    
    // Limites generosos
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // APENAS testes unitários (services, utils, schemas, hooks)
    include: [
      'src/services/**/*.test.js',
      'src/utils/**/*.test.js',
      'src/schemas/**/*.test.js',
      'src/hooks/**/*.test.js',
    ],
    
    // Excluir TODOS os testes de componentes UI
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,out,temp}/**',
      '**/src/components/**/*.test.jsx',
      '**/src/components/**/*.test.js',
      '**/src/views/**/*.test.jsx',
      '**/src/views/**/*.test.js',
    ],
  },
})
