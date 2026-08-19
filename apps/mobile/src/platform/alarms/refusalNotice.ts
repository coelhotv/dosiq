// refusalNotice.ts — a recusa do BANCO chega à paciente também pelo caminho da NOTIFICAÇÃO
// (spec 067 Slice B / FR-013 · Constituição, Princípio IX).
//
// Por que existe: a recusa do servidor tem DOIS caminhos de chegada e só um tinha voz.
//   • AlarmFullScreen → `Alert.alert` (a tela está aberta, dá pra falar com quem está olhando).
//   • Ação da NOTIFICAÇÃO ("Pular"/"Tomei" no shade) → o handler do Notifee roda headless, não há
//     tela para exibir Alert, e o retorno de `registerSkip` morria em silêncio. Ou seja: o alarme
//     sumia, nada era gravado, e a paciente ficava achando que registrou. É exatamente o
//     "nada aconteceu" que esta spec existe para eliminar.
//
// Espelha o `outOfWindowNotice` de propósito (mesmo canal silencioso, sem ações, autoCancel):
// não é a dose tocando de novo, é uma informação sobre algo que NÃO foi gravado. Qualquer CTA aqui
// reabriria o caminho de registro que a guarda acabou de fechar.

import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native'
import { ensureSurfaceChannel, DOSE_ACTIVITY_CHANNEL_ID } from '@platform/doseActivity/doseActivitySurfaceService'

/** Marca do payload — permite distinguir o aviso da dose em qualquer predicado por CONTEÚDO (R-309 §2). */
export const REFUSAL_NOTICE_FLAG = '__refusalNotice'

/** Id derivado da dose: uma recusa por dose substitui a anterior em vez de empilhar. */
export function refusalNoticeId(doseInstanceId: string): string {
  return `${doseInstanceId}:refusal`
}

/**
 * Exibe a recusa como notificação informativa. Best-effort e fail-open: falhar aqui NUNCA
 * pode derrubar o handler do alarme (o registro já foi recusado; perder o aviso é ruim, travar
 * o handler é pior).
 *
 * @param {object} params
 * @param {string} params.doseInstanceId
 * @param {string} params.message - texto já em português, vindo do serviço/RPC (FR-013)
 */
export async function showRefusalNotice({
  doseInstanceId,
  message,
}: {
  doseInstanceId: string
  message: string
}): Promise<{ notified: boolean }> {
  if (!doseInstanceId || !message) return { notified: false }
  try {
    await ensureSurfaceChannel()
    await notifee.displayNotification({
      id: refusalNoticeId(doseInstanceId),
      title: 'Dose não registrada',
      body: message,
      data: { doseInstanceId, [REFUSAL_NOTICE_FLAG]: 'true' },
      android: {
        channelId: DOSE_ACTIVITY_CHANNEL_ID,
        importance: AndroidImportance.DEFAULT, // sem takeover — o evento não é a dose
        visibility: AndroidVisibility.PRIVATE,
        smallIcon: 'ic_dosiq_mark',
        ongoing: false,
        autoCancel: true,
        onlyAlertOnce: true,
      },
    })
    return { notified: true }
  } catch {
    return { notified: false }
  }
}

export default showRefusalNotice
