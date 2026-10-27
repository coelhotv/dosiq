import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

import fs from 'fs'

/**
 * Plugin de desenvolvimento local: espelha o comportamento cleanUrls do vercel.json
 * resolvendo rotas limpas (/x) para seus arquivos HTML (/x.html) em public/.
 */
function staticHtmlRewritesPlugin() {
  const publicDir = path.resolve(__dirname, 'public')

  const handler = (req, res, next) => {
    const rawUrl = req.url || ''
    const pathname = rawUrl.split('?')[0]
    if (pathname && pathname !== '/' && !path.extname(pathname)) {
      const relPath = pathname.replace(/^\//, '')
      const candidate = path.join(publicDir, relPath + '.html')
      if (fs.existsSync(candidate)) {
        const query = rawUrl.includes('?') ? '?' + rawUrl.split('?')[1] : ''
        req.url = '/' + relPath + '.html' + query
      }
    }
    next()
  }

  return {
    name: 'static-html-rewrites',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega .env* (inclui EXPO_PUBLIC_*) só no processo do Vite — NÃO expõe ao client.
  // Permite smoke do chat IA em dev apontando /api/* para o backend serverless de prod
  // (api/chatbot.js inalterado; proxy server-side evita CORS de localhost→dosiq.app).
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const apiBase = (env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')
  // Deployments de preview (branch, não produção) exigem SSO do Vercel (Deployment Protection) —
  // sem isso o proxy recebe redirect pra vercel.com/sso-api e o browser bloqueia por CORS. O
  // Protection Bypass for Automation é a saída oficial: header aceito só em requisição
  // server-to-server (o proxy do Vite roda no processo Node, nunca chega ao browser).
  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET || ''

  return {
  server: {
    host: true, // expõe na rede local (0.0.0.0) — acesse pelo IP da máquina no celular
    // Proxy /api → backend remoto quando EXPO_PUBLIC_API_BASE_URL setado (dev-only).
    ...(apiBase
      ? {
          proxy: {
            '/api': {
              target: apiBase,
              changeOrigin: true,
              secure: true,
              ...(bypassSecret
                ? {
                    headers: {
                      // Só o header, a cada requisição. `x-vercel-set-bypass-cookie` faria a Vercel
                      // responder 307 + cookie `Secure`, que o navegador rejeita fora de localhost
                      // (celular via IP da rede) → loop de redirect e fetch falha (smoke 097 A2).
                      'x-vercel-protection-bypass': bypassSecret,
                    },
                  }
                : {}),
            },
          },
        }
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
      '@dosiq/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              /[\\/]node_modules[\\/]react[\\/]/.test(id) ||
              /[\\/]node_modules[\\/]react-dom[\\/]/.test(id) ||
              /[\\/]node_modules[\\/]scheduler[\\/]/.test(id)
            ) {
              return 'vendor-react'
            }
            if (id.includes('framer-motion')) return 'vendor-framer'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('react-virtuoso')) return 'vendor-virtuoso'
          }
        },
      },
    },
    sourcemap: 'hidden',
  },
  plugins: [
    react(),
    staticHtmlRewritesPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globIgnores: [
          '**/spike-097/**',
          '**/*Admin*',
          '**/guia/**',
          '**/glp-1.html',
          '**/insulina-e-glicemia.html',
          '**/injecao-mensal.html',
          '**/politica-de-privacidade.html',
          '**/termos-de-uso.html',
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    })
  ]
  }
})
