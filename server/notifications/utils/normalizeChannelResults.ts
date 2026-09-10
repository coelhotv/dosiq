// Consolida resultados de múltiplos canais em objeto único
// Cada canal retorna { channel, success, attempted, delivered, failed, deactivatedTokens, errors }

/**
 * Por que um canal não entregou nada (ADR-100).
 *
 * O canal INFORMA o motivo; quem o converte em `notification_log.status` é o dispatcher
 * (`determineOverallStatus`) — o canal nunca decide o status (R-200). Antes disto a supressão
 * do alarme nativo morria dentro do `expoPushChannel` como `console.info` e o dispatcher só
 * enxergava `attempted: 0`, indistinguível de "não havia canal": daí 145 supressões rotuladas
 * `falhou` e 930 ausências de canal rotuladas `enviada` (medido em 30 dias até 2026-09-10).
 *
 * ⚠️ `success` NÃO muda de semântica: continua `true` quando o canal não lançou exceção. Fazer
 * `attempted: 0 ⇒ success: false` pareceria mais honesto e quebraria a dedup do alerta de
 * receita, que grava sua âncora sob `if (result?.success)` (`prescriptionAlerts.ts:116`) — o
 * alerta passaria a repetir todo dia justamente para o paciente sem canal (AP-340). A verdade
 * nova viaja no `reason`, não no `success`.
 */
export type ChannelResultReason =
  | 'native_alarm'    // dose crítica coberta pelo alarme local do aparelho (ADR-056)
  | 'no_devices'      // o usuário não tem nenhum aparelho ativo neste canal
  | 'no_chat'         // o usuário não vinculou o Telegram
  | 'not_configured'  // o canal não está operacional no ambiente (ex.: VAPID ausente)

export interface ChannelResult {
  channel: string
  success: boolean
  /** Preenchido só quando nada foi entregue. Ver `ChannelResultReason`. */
  reason?: ChannelResultReason
  attempted?: number
  delivered?: number
  failed?: number
  deactivatedTokens?: string[]
  errors?: Array<{ message?: string; code?: string | number; token?: string }>
  messageId?: string
  tickets?: Array<{ id?: string; status: string }>
  providerMetadata?: Record<string, unknown>
}

interface NormalizedChannelResults {
  success: boolean
  channels: ChannelResult[]
  totalDelivered: number
  totalFailed: number
}

export function normalizeChannelResults(results: ChannelResult[] | undefined | null): NormalizedChannelResults {
  if (!results || results.length === 0) {
    return { success: true, channels: [], totalDelivered: 0, totalFailed: 0 }
  }

  const totalDelivered = results.reduce((sum: number, r) => sum + (r.delivered ?? 0), 0)
  const totalFailed = results.reduce((sum: number, r) => sum + (r.failed ?? 0), 0)

  return {
    success: results.every((r) => r.success),
    channels: results,
    totalDelivered,
    totalFailed,
  }
}
