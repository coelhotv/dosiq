import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    
    // === Otimizações Fase 1: Quick Wins ===
    
    // Pool de threads configurado corretamente (Vitest 4+)
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 2,         // Limitar para não travar máquina local
        minThreads: 1,
        isolate: false,        // Mais rápido, mas cuidado com estado compartilhado
      },
    },
    
    // Cache de transformação
    cache: {
      dir: '.vitest-cache',
    },
    
    // Timeouts mais agressivos
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    
    // Reporters otimizados
    reporters: ['verbose'],
    
    // Cobertura apenas quando solicitada
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.jsx',
        '**/*.test.js',
        '**/*.config.js',
        'server/',
        'api/',
        'docs/',
        'plans/',      
        'public/',
      ],
    },
  },
})
