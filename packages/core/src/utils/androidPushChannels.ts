import { compareSemver } from './semver'

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
   * Criado pelo app a partir de `MIN_APP_VERSION_FOR_CRITICAL_PUSH_CHANNEL` ("Avisos de dose
   * essencial", HIGH, `alarm_dose`, USAGE_ALARM — 062 F3-B). Versões anteriores NÃO o têm: o
   * servidor só o referencia via `resolveAndroidPushChannel` (por `app_version`).
   */
  CRITICAL: 'dosiq-critical-v1',
} as const)

export type AndroidPushChannelId = (typeof ANDROID_PUSH_CHANNEL)[keyof typeof ANDROID_PUSH_CHANNEL]

/**
 * Primeira versão NATIVA do app que cria `ANDROID_PUSH_CHANNEL.CRITICAL` (062 F3-B, decisão 3 do PO:
 * build de smoke que embarca D-10). Compara com `notification_devices.app_version`
 * (`nativeApplicationVersion` — OTA não altera, coerente com R-314).
 */
export const MIN_APP_VERSION_FOR_CRITICAL_PUSH_CHANNEL = '0.33.10'

/**
 * Canal Android do push para UM aparelho (062 F3-B, FR-017). CRITICAL só quando o aparelho
 * provadamente roda uma versão que cria o canal; versão anterior, ausente ou ilegível ⇒ DEFAULT
 * (AP-303: indeterminado ⇒ o canal que existe). Sempre `compareSemver` — por string
 * `'0.33.10' < '0.33.9'`.
 */
export function resolveAndroidPushChannel(
  device: { app_version?: unknown },
  isCriticalDose: boolean,
): AndroidPushChannelId {
  if (isCriticalDose !== true) return ANDROID_PUSH_CHANNEL.DEFAULT
  const version = typeof device?.app_version === 'string' ? device.app_version : null
  const cmp = compareSemver(version, MIN_APP_VERSION_FOR_CRITICAL_PUSH_CHANNEL)
  return cmp !== null && cmp >= 0 ? ANDROID_PUSH_CHANNEL.CRITICAL : ANDROID_PUSH_CHANNEL.DEFAULT
}
