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
    
    // Limitar threads para não travar máquina (Vitest 4+ formato)
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    useAtomics: true,
    
    // Desativar isolamento para mais velocidade (cuidado com estado)
    isolate: false,
    
    // Cache de transformação
    cache: {
      dir: '.vitest-cache',
    },
    
    // Timeouts mais agressivos
    testTimeout: 10000,
    hookTimeout: 10000,
    
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
        'public/',
      ],
    },
  },
})
