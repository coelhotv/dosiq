import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // expõe na rede local (0.0.0.0) — acesse pelo IP da máquina no celular
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
            './src/views/redesign/HealthHistory.jsx',
            './src/features/adherence/components/AdherenceHeatmap.jsx',
            './src/features/adherence/services/adherencePatternService.js',
          ],
          'feature-stock': ['./src/views/redesign/Stock.jsx'],
          'feature-landing': ['./src/views/Landing.jsx'],

          // Base ANVISA — 819KB, carregada apenas em Medicines/autocomplete
          'feature-medicines-db': [
            './src/features/medications/data/medicineDatabase.json',
          ],
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
        name: 'Dosiq',
        short_name: 'Dosiq',
        description: 'Gerenciador de Medicamentos',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
