/**
 * Ids dos canais Android do push remoto (expo-notifications) — fonte ÚNICA para o servidor
 * (`server/notifications/channels/expoPushChannel.ts`) e para o app
 * (`apps/mobile/src/platform/notifications/ensurePushChannel.ts`). Spec 062 F3 (FR-014).
 *
 * Push com `channelId` que o app não criou cai no `fcm_fallback_notification_channel`
 * ("Miscellaneous", importância 3, som do sistema) — foi o que aconteceu com o push crítico
 * entre 2026-06 e 2026-10 (AP-251). Canal é imutável após criado: trocar config exige id novo (R-261).
 */
export const ANDROID_PUSH_CHANNEL = Object.freeze({
  /** Criado pelo app em `ensurePushChannel` ("Lembretes e avisos", HIGH, `push_chime`). */
  DEFAULT: 'dosiq-default-v1',
  /**
   * ⚠️ Nenhuma versão do app cria este canal ainda (062 F3-B). Não referenciar no envio até o
   * roteamento por `app_version` existir — o push cairia no canal de fallback do FCM.
   */
  CRITICAL: 'dosiq-critical-v1',
} as const)

export type AndroidPushChannelId = (typeof ANDROID_PUSH_CHANNEL)[keyof typeof ANDROID_PUSH_CHANNEL]
