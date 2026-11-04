// pushTray.ts — tira da bandeja o push de lembrete de dose já registrada (spec 082 D2 · smoke T101)
//
// O push do servidor é exibido pelo SO/expo-notifications; o registro in-app cancelava só o que o
// próprio app criou (alarme, superfície) e o aviso "Hora de tomar … — 16:05" ficava na bandeja com a
// dose já `taken`. O servidor manda `doseInstanceIds` no data do push; aqui o push sai quando TODAS as
// ocorrências que ele avisa estão resolvidas neste aparelho (bloco de plano: registrar uma dose não
// apaga o aviso das outras). Push antigo, sem o campo, fica como antes. Best-effort: nunca lança.

import * as Notifications from 'expo-notifications'
import { isDoseResolved } from '@platform/doseActivity/resolvedDoseStore'

function _doseIds(data: unknown): string[] {
  const ids = (data as { doseInstanceIds?: unknown } | null | undefined)?.doseInstanceIds
  return Array.isArray(ids) ? ids.map(String).filter(Boolean) : []
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
      const ids = _doseIds(notification?.request?.content?.data)
      if (!ids.some((id) => resolved.has(id))) continue
      const flags = await Promise.all(ids.map((id) => (resolved.has(id) ? true : isDoseResolved(id))))
      if (!flags.every(Boolean)) continue
      await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {})
    }
  } catch {
    // best-effort: sem a leitura, o aviso fica na bandeja (comportamento anterior)
  }
}
