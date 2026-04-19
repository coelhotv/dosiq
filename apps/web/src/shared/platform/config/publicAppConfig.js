/**
 * publicAppConfig — Config publica da web
 *
 * Unico local na web onde import.meta.env e lido para config Supabase.
 * packages/config NAO le import.meta.env — apenas este arquivo de bootstrap.
 * O objeto validado e exportado para uso no restante da app web.
 */
import { createPublicAppConfig } from '@meus-remedios/config'

export const publicAppConfig = createPublicAppConfig({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  detectSessionInUrl: true,
  appEnv: import.meta.env.MODE,
})
