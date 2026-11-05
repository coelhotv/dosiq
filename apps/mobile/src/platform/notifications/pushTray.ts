// pushTray.ts — tira da bandeja o push de lembrete de dose já registrada (spec 082 D2 · smoke T101)
//
// O push do servidor é exibido pelo SO/expo-notifications; o registro in-app cancelava só o que o
// próprio app criou (alarme, superfície) e o aviso "Hora de tomar … — 16:05" ficava na bandeja com a
// dose já `taken`. O servidor manda `doseInstanceIds` no data do push; aqui o push sai quando TODAS as
// ocorrências que ele avisa estão resolvidas neste aparelho (bloco de plano: registrar uma dose não
// apaga o aviso das outras). Push antigo, sem o campo, fica como antes. Best-effort: nunca lança.
//
// 🔴 Android com o app fechado: quem exibe o push é o FCM, e o `data` fica preso no contentIntent —
// `getPresentedNotificationsAsync` devolve a notificação "estrangeira" SEM data (dumpsys do smoke
// T101). O que sobra é a TAG, que o expo põe no identificador (`…?tag=<tag>&id=0`,
// ExpoPresentationDelegate.getInternalIdentifierKey). Por isso o servidor manda `tag: dose:<ids>`.

import * as Notifications from 'expo-notifications'
import { isDoseResolved } from '@platform/doseActivity/resolvedDoseStore'

export const DOSE_PUSH_TAG_PREFIX = 'dose:'

function _idsFromTag(identifier: unknown): string[] {
  if (typeof identifier !== 'string') return []
  const m = identifier.match(/[?&]tag=([^&]+)/)
  if (!m) return []
  let tag: string
  try {
    tag = decodeURIComponent(m[1])
  } catch {
    return []
  }
  if (!tag.startsWith(DOSE_PUSH_TAG_PREFIX)) return []
  return tag.slice(DOSE_PUSH_TAG_PREFIX.length).split(',').filter(Boolean)
}

function _doseIds(notification: Notifications.Notification): string[] {
  const ids = (notification?.request?.content?.data as { doseInstanceIds?: unknown } | null | undefined)?.doseInstanceIds
  if (Array.isArray(ids) && ids.length > 0) return ids.map(String).filter(Boolean)
  return _idsFromTag(notification?.request?.identifier)
}

/**
 * Dispensa os pushes exibidos que avisam alguma das ocorrências recém-resolvidas e não têm
 * nenhuma outra ainda pendente. Chamar DEPOIS de `markDosesResolved`.
 */
export async function dismissPushForResolvedDoses(resolvedIds: string[]): Promise<void> {
  const resolved = new Set(resolvedIds.filter(Boolean).map(String))
  if (resolved.size === 0) return
  try {
    const presented = await Notifications.getPresentedNotificationsAsync()
    for (const notification of presented) {
      const ids = _doseIds(notification)
      if (!ids.some((id) => resolved.has(id))) continue
      const flags = await Promise.all(ids.map((id) => (resolved.has(id) ? true : isDoseResolved(id))))
      if (!flags.every(Boolean)) continue
      await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {})
    }
  } catch {
    // best-effort: sem a leitura, o aviso fica na bandeja (comportamento anterior)
  }
}
