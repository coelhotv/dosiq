import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Configuração de Testes Críticos
 *
 * Esta configuração foca apenas nos testes mais importantes para validação rápida:
 * - Services (lógica de negócio)
 * - Utils (funções auxiliares)
 * - Schemas (validação de dados)
 * - Hooks (lógica reutilizável)
 * - Features (nova organização)
 *
 * NÃO inclui componentes de UI que são mais lentos de testar.
 *
 * Otimizado para CI com pool 'forks' (menos uso de memória que 'threads')
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

    // Apenas testes críticos (excluir componentes UI e smoke)
    include: [
      'src/services/**/*.test.{js,jsx}',
      'src/utils/**/*.test.{js,jsx}',
      'src/schemas/**/*.test.{js,jsx}',
      'src/shared/hooks/**/*.test.{js,jsx}',
      // Features: apenas services, utils, hooks (NÃO components)
      'src/features/**/services/**/*.test.{js,jsx}',
      'src/features/**/utils/**/*.test.{js,jsx}',
      'src/features/**/hooks/**/*.test.{js,jsx}',
    ],
    exclude: [
      '**/*.smoke.test.*',
      '**/*.integration.test.*',
      'src/components/**/*',
      'src/shared/components/**/*',
      'src/features/**/components/**/*', // Excluir UI components de features
      'node_modules/',
      // TEMPORÁRIO: Excluir testes com problemas (unhandled rejections, env issues)
      // TODO: Fixar estes testes para funcionar no CI sem env vars
      'src/shared/hooks/__tests__/useCachedQuery.test.jsx',
      'src/features/dashboard/hooks/__tests__/useDashboardContext.test.jsx',
      'src/services/__tests__/api.test.js',
    ],

    // Pool otimizado para CI - forks usa menos memória que threads
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Executar sequencialmente para evitar OOM
      },
    },

    // Timeouts generosos para execução sequencial
    testTimeout: 15000,
    hookTimeout: 10000,

    // Reporter minimalista
    reporters: ['dot'],

    // Cache separado
    cache: {
      dir: '.vitest-cache-critical',
    },
  },
})
