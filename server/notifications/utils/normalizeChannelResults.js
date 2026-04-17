// Consolida resultados de múltiplos canais em objeto único
// Cada canal retorna { channel, success, attempted, delivered, failed, deactivatedTokens, errors }

export function normalizeChannelResults(results) {
  if (!results || results.length === 0) {
    return { success: true, channels: [], totalDelivered: 0, totalFailed: 0 }
  }

  const totalDelivered = results.reduce((sum, r) => sum + (r.delivered ?? 0), 0)
  const totalFailed = results.reduce((sum, r) => sum + (r.failed ?? 0), 0)

  return {
    success: results.every((r) => r.success),
    channels: results,
    totalDelivered,
    totalFailed,
  }
}
