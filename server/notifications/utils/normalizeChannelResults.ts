// Consolida resultados de múltiplos canais em objeto único
// Cada canal retorna { channel, success, attempted, delivered, failed, deactivatedTokens, errors }

export interface ChannelResult {
  channel: string
  success: boolean
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
