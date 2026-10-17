// Links das lojas, compartilhados pelo VersionGate e pelo scanner (066 D1: "Abrir a loja" no E10).

/**
 * Lojas por plataforma — fallback COMPILADO quando `store_url` remoto está ausente ou fora da
 * allowlist (S-8). Prefixos batem `STORE_URL_ALLOWLIST` (`@dosiq/core`).
 * ⚠️ Android é o link direto e funcional (`androidPackage` — app.config.js). iOS aponta para a
 * busca até o app publicar e o PO preencher o Apple App ID real aqui.
 */
export const STORE_FALLBACK_URLS = {
  ios: 'https://apps.apple.com/br/app/dosiq-inteligencia-em-doses/id6762740948',
  android: 'https://play.google.com/store/apps/details?id=com.coelhotv.dosiq',
} as const
