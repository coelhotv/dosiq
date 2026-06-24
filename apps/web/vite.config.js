import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega .env* (inclui EXPO_PUBLIC_*) só no processo do Vite — NÃO expõe ao client.
  // Permite smoke do chat IA em dev apontando /api/* para o backend serverless de prod
  // (api/chatbot.js inalterado; proxy server-side evita CORS de localhost→dosiq.app).
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const apiBase = (env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')

  return {
  server: {
    host: true, // expõe na rede local (0.0.0.0) — acesse pelo IP da máquina no celular
    // Proxy /api → backend remoto quando EXPO_PUBLIC_API_BASE_URL setado (dev-only).
    ...(apiBase
      ? { proxy: { '/api': { target: apiBase, changeOrigin: true, secure: true } } }
      : {}),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@services': path.resolve(__dirname, './src/services'),
      '@dashboard': path.resolve(__dirname, './src/features/dashboard'),
      '@medications': path.resolve(__dirname, './src/features/medications'),
      '@protocols': path.resolve(__dirname, './src/features/protocols'),
      '@stock': path.resolve(__dirname, './src/features/stock'),
      '@adherence': path.resolve(__dirname, './src/features/adherence'),
      '@calendar': path.resolve(__dirname, './src/features/calendar'),
      '@emergency': path.resolve(__dirname, './src/features/emergency'),
      '@prescriptions': path.resolve(__dirname, './src/features/prescriptions'),
      '@settings': path.resolve(__dirname, './src/views/settings'),
      '@schemas': path.resolve(__dirname, './src/schemas'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@design-tokens': path.resolve(__dirname, '../../packages/design-tokens/src'),
      '@dosiq/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendors grandes — isolados para cache duradouro
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-virtuoso': ['react-virtuoso'],
          'vendor-pdf': ['jspdf', 'html2canvas'],

          // Feature chunks — carregados apenas quando a view é acessada
          'feature-history': [
            './src/views/HealthHistory.jsx',
            './src/features/adherence/components/AdherenceHeatmap.jsx',
            './src/features/adherence/services/adherencePatternService.js',
          ],
          'feature-stock': ['./src/views/Stock.jsx'],
          'feature-landing': ['./src/views/landing/Landing.jsx'],

          // Base ANVISA (037): movida p/ on-demand via @dosiq/core + Cache Storage.
          // JSON não entra mais no bundle — manualChunk removido.
        },
      },
    },
    sourcemap: 'hidden',
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'dosiq',
        short_name: 'dosiq',
        description: 'inteligência em doses',
        theme_color: '#006a5e',
        background_color: '#F0FDFB',
        display: 'standalone',
        icons: [
          {
            src: 'app-icons/web/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'app-icons/web/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'app-icons/web/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
  }
})
