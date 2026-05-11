// remoteDebugLog.js — log remoto temporário para debug de produção TestFlight
// REMOVER antes do lançamento público ao App Store/Play Store
// Logs visíveis em: Vercel Dashboard → dosiq → Functions → debug-log

const DEBUG_LOG_URL = 'https://dosiq.vercel.app/api/debug-log'

export function remoteDebugLog(event, data = {}) {
  fetch(DEBUG_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data }),
  }).catch(() => {
    // silencioso — log de debug não pode quebrar o app
  })
}
