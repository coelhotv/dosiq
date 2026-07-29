// nativePublicAppConfig.js — bootstrap de config para o app native
// Camada de plataforma: único lugar que lê process.env.EXPO_PUBLIC_*
// Pacotes compartilhados (packages/*) NÃO leem env diretamente — recebem via DI

import { createPublicAppConfig } from '@dosiq/config'

export const nativePublicAppConfig = createPublicAppConfig({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  // detectSessionInUrl = false: links universais não estão habilitados no native
  detectSessionInUrl: false,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
})

// Observabilidade (ADR-090 — Firebase saiu; Sentry = crash, PostHog = analytics de produto).
// Ambas são chaves PÚBLICAS de client (DSN e project API key), logo EXPO_PUBLIC_* é correto.
// R-083: fallback para o nome sem prefixo (EAS secret / CI podem expor só a forma curta).
export const sentryDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || ''

export const posthogApiKey =
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY || ''

// Host US (US-Virginia): app é brasil-only e o backbone bra/us é maior que bra/eu (ADR-090).
export const posthogHost =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || 'https://us.i.posthog.com'

// URL base da API serverless (Vercel) — usada p/ chamar `api/chatbot.js` do mobile (spec 015).
// Único lugar que lê a env (AP-242: nunca hardcodar). Fallback dev = produção.
export const nativeApiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://dosiq.app'
).replace(/\/+$/, '')
