// Regras de supressão de notificações por modo e quiet hours (Wave N2)

/**
 * Determina se uma notificação realtime deve ser enviada agora.
 * @param {{ mode: string, quietHoursStart: string|null, quietHoursEnd: string|null, currentHHMM: string }} params
 * @returns {boolean}
 */
export function shouldSendNow({ mode, quietHoursStart, quietHoursEnd, currentHHMM }) {
  if (mode === 'silent') return false
  if (mode === 'digest_morning') return false
  if (isInQuietHours(currentHHMM, quietHoursStart, quietHoursEnd)) return false
  return true
}

/**
 * Verifica se horário atual está dentro do período de quiet hours.
 * Trata janelas que cruzam meia-noite (ex: 22:00 → 07:00).
 * @param {string} current - HH:MM atual
 * @param {string|null} start - HH:MM início
 * @param {string|null} end   - HH:MM fim
 * @returns {boolean}
 */
export function isInQuietHours(current, start, end) {
  if (!start || !end) return false
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
  const cur = toMin(current)
  const s   = toMin(start)
  const e   = toMin(end)
  if (s <= e) return cur >= s && cur < e   // janela normal
  return cur >= s || cur < e               // cross-midnight
}
