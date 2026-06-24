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

// URL base da API serverless (Vercel) — usada p/ chamar `api/chatbot.js` do mobile (spec 015).
// Único lugar que lê a env (AP-242: nunca hardcodar). Fallback dev = produção.
export const nativeApiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://dosiq.app'
).replace(/\/+$/, '')
