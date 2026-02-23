import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

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

    // ==========================================
    // OTIMIZAÇÕES PARA VITEST 4+ (Testing Infrastructure Overhaul)
    // ==========================================

    // Vitest 4+ API — pool options dentro de poolOptions
    // Usar 1 thread é mais seguro que 2+ para evitar race conditions
    // Se velocidade for crítica, use: npx vitest run --threads --maxThreads=2
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1,
      },
    },

    // Limites de tempo mais rigorosos (10s suficiente para testes bem escritos)
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

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
