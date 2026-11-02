// deviceProbe.ts — sondagem única do estado do aparelho (spec 082 D2 · E-14 · 068 X-1)
//
// Devolve só FATOS CRUS do SO, cada um fail-safe (`null` = leitura falhou ou não se aplica à
// plataforma). A INTERPRETAÇÃO fica em cada consumidor: `deriveCapability()` aqui (082, boletim de
// capacidade do alarme crítico) e a leitura de bateria da 068. Nenhum fato carrega dado de saúde.
//
// 🔴 Bateria (`batteryOptimized`/`powerManagerActivity`) é coletada para a 068 e NUNCA entra na
// capacidade (E-14: ≈100 % da base tem otimização ligada — virar negativo silenciaria a prova de todos).

import { Platform } from 'react-native'
import notifee, { AndroidImportance, AndroidNotificationSetting, IOSNotificationSetting } from '@notifee/react-native'
import {
  ALARM_CRITICAL_CHANNEL_ID,
  LEGACY_CRITICAL_CHANNEL_ID,
  isPushUsable,
} from '@platform/alarms/alarmService'

export interface DeviceFacts {
  /** O alarme pode aparecer: push utilizável, ou (iOS) alerta crítico autorizado (054 C-11). */
  notificationsAllowed: boolean | null
  /** Android: canal real do alarme crítico com importância NONE. iOS: null. */
  alarmChannelBlocked: boolean | null
  /** Android 12+: permissão de alarme exato (`settings.android.alarm`). <12 ⇒ true. iOS: null. */
  exactAlarmAllowed: boolean | null
  /** Ids de trigger pendentes no SO (`getTriggerNotificationIds`). */
  criticalArmedIds: string[] | null
  /** Android: otimização de bateria ligada (só 068 — nunca capacidade). iOS: null. */
  batteryOptimized: boolean | null
  /** Android: o OEM expõe tela de gerenciamento de energia (só 068). iOS: null. */
  powerManagerActivity: string | null
}

/** Executa a leitura; erro ⇒ `null` (fail-safe). @private */
async function _safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

/** Canal REAL do alarme (`-v3`, senão `-v2`), como `getCriticalAlarmDeviceStatus` (C-25). @private */
async function _alarmChannelBlocked(): Promise<boolean> {
  const channel = (await notifee.getChannel(ALARM_CRITICAL_CHANNEL_ID)) ?? (await notifee.getChannel(LEGACY_CRITICAL_CHANNEL_ID))
  // Canal ainda não criado = nasce HIGH no próximo agendamento ⇒ não é bloqueio.
  return channel?.importance === AndroidImportance.NONE
}

function _notificationsAllowed(settings): boolean {
  if (isPushUsable(settings)) return true
  return Platform.OS === 'ios' && settings?.ios?.criticalAlert === IOSNotificationSetting.ENABLED
}

function _exactAlarmAllowed(settings): boolean | null {
  const alarm = settings?.android?.alarm
  if (alarm === AndroidNotificationSetting.DISABLED) return false
  if (alarm === AndroidNotificationSetting.ENABLED || alarm === AndroidNotificationSetting.NOT_SUPPORTED) return true
  return null // leitura sem o campo ⇒ desconhecido, nunca negativo
}

/** Lê os fatos do aparelho. Nunca lança. */
export async function probeDevice(): Promise<DeviceFacts> {
  const isAndroid = Platform.OS === 'android'
  const settings = await _safe(() => notifee.getNotificationSettings())
  const ids = await _safe(() => notifee.getTriggerNotificationIds())
  return {
    notificationsAllowed: settings ? _notificationsAllowed(settings) : null,
    alarmChannelBlocked: isAndroid ? await _safe(_alarmChannelBlocked) : null,
    exactAlarmAllowed: isAndroid && settings ? _exactAlarmAllowed(settings) : null,
    criticalArmedIds: Array.isArray(ids) ? ids.map(String) : null,
    batteryOptimized: isAndroid ? await _safe(() => notifee.isBatteryOptimizationEnabled()) : null,
    powerManagerActivity: isAndroid ? ((await _safe(() => notifee.getPowerManagerInfo()))?.activity ?? null) : null,
  }
}

export interface CapabilityVerdict {
  capable: boolean
  criticalExpected: number
  criticalArmed: number
}

/**
 * Capacidade do alarme crítico (082 D2). `null` = não emitir boletim: sem dose crítica no horizonte
 * ou algum fato necessário desconhecido (desconhecido ≠ negativo — F7).
 * Importância MIN/LOW/DEFAULT do canal continua capaz (atributo, não fato — E-10). Bateria ignorada.
 * @param facts - saída de `probeDevice()`
 * @param expectedIds - ids de trigger que o sync acabou de agendar para doses críticas
 */
export function deriveCapability(facts: DeviceFacts, expectedIds: string[]): CapabilityVerdict | null {
  const criticalExpected = Array.isArray(expectedIds) ? expectedIds.length : 0
  if (criticalExpected === 0) return null
  if (facts.notificationsAllowed === null || facts.criticalArmedIds === null) return null
  const isAndroid = Platform.OS === 'android'
  if (isAndroid && (facts.alarmChannelBlocked === null || facts.exactAlarmAllowed === null)) return null
  const armed = new Set(facts.criticalArmedIds)
  const criticalArmed = expectedIds.filter((id) => armed.has(String(id))).length
  const capable =
    facts.notificationsAllowed &&
    facts.alarmChannelBlocked !== true &&
    facts.exactAlarmAllowed !== false &&
    criticalArmed > 0
  return { capable, criticalExpected, criticalArmed }
}
