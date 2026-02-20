import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Configuração de CI/CD com Coverage
 *
 * Esta configuração é usada no pipeline CI/CD para executar
 * a suite completa de testes com relatório de cobertura.
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
    setupFiles: './src/test/setup.js',
    
    // Incluir todos os testes
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    
    // Pool otimizado para CI
    pool: 'threads',
    maxThreads: 2,
    minThreads: 1,
    
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // Coverage habilitado
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/',
        'src/main.jsx',
        'src/App.jsx',
        '**/__tests__/**',
        '**/*.test.{js,jsx}',
        '**/*.config.js',
        '**/node_modules/**',
      ],
      
      // Thresholds (Fase 1: 40%, Fase 2: 55%)
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
      },
    },
  },
})
