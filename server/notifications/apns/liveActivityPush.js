// Spec 041 — Cliente APNs raw para iOS Live Activity push-to-start (ActivityKit, iOS 17.2+).
//
// Por que raw (não Expo Push): o Expo Push Service não expõe `apns-push-type: liveactivity` nem o
// pushToStartToken do ActivityKit (ADR-076). Conexão direta HTTP/2 + JWT ES256 com a chave .p8
// dedicada (segredo do bot, S-2). Server-side → não conta no budget R-090 (server/ não é entrypoint).
//
// Segurança (RC-SEC): a .p8 vem de APNS_AUTH_KEY (base64) — nunca commitada, nunca no bundle.
// O caller (disparo) é responsável pelo object-level check dose↔device (S-1) e por NÃO incluir o
// nome do medicamento no content-state em modo discreto (S-3) — este módulo só transporta.

import http2 from 'node:http2'
import jwt from 'jsonwebtoken'

const APNS_HOST_PROD = 'https://api.push.apple.com'
const APNS_HOST_SANDBOX = 'https://api.sandbox.push.apple.com'
const JWT_TTL_MS = 50 * 60 * 1000 // Apple exige token < 1h; renova aos 50min

let _jwtCache = { token: null, issuedAt: 0 }

/** Lê e valida as credenciais APNs do ambiente (R-088 — fail-closed se faltar). */
export function getApnsConfig(env = process.env) {
  const authKeyB64 = env.APNS_AUTH_KEY
  const keyId = env.APNS_KEY_ID
  const teamId = env.APNS_TEAM_ID
  const bundleId = env.APNS_BUNDLE_ID
  if (!authKeyB64 || !keyId || !teamId || !bundleId) return null
  let authKey
  try {
    authKey = Buffer.from(authKeyB64, 'base64').toString('utf8')
  } catch {
    return null
  }
  if (!authKey.includes('PRIVATE KEY')) return null // base64 inválido / não é .p8
  const useSandbox = env.APNS_USE_SANDBOX === 'true'
  return { authKey, keyId, teamId, bundleId, host: useSandbox ? APNS_HOST_SANDBOX : APNS_HOST_PROD }
}

/** Assina (e cacheia <1h) o JWT ES256 do provider APNs. @private */
function _providerToken(config, now = Date.now()) {
  if (_jwtCache.token && now - _jwtCache.issuedAt < JWT_TTL_MS) return _jwtCache.token
  const token = jwt.sign(
    { iss: config.teamId, iat: Math.floor(now / 1000) },
    config.authKey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: config.keyId } }
  )
  _jwtCache = { token, issuedAt: now }
  return token
}

/** Reseta o cache do JWT (testes). @private */
export function _resetJwtCache() {
  _jwtCache = { token: null, issuedAt: 0 }
}

/**
 * Dispara um push-to-start ActivityKit (event=start) para um device.
 * @param {object} args
 * @param {string} args.pushToStartToken - token push-to-start (hex) do device (ActivityKit)
 * @param {object} args.attributes - attributes da Live Activity (DoseActivityAttributes-compat)
 * @param {object} args.contentState - estado inicial (CON-029-compat; SEM nome se discreto — S-3)
 * @param {number} [args.staleEpochSec] - timestamp de stale (s); default +1h
 * @param {object} [args.config] - override (testes); senão getApnsConfig()
 * @param {object} [args.http2lib] - override do http2 (testes)
 * @returns {Promise<{ok:boolean, status:number, deactivate?:boolean, reason?:string}>}
 */
export async function sendLiveActivityStart({ pushToStartToken, attributes, contentState, staleEpochSec, config, http2lib = http2 }) {
  const cfg = config || getApnsConfig()
  if (!cfg) return { ok: false, status: 0, reason: 'apns_not_configured' } // fail-open: caller degrada p/ 039
  if (!pushToStartToken) return { ok: false, status: 0, reason: 'no_token' }

  const nowSec = Math.floor(Date.now() / 1000)
  const payload = {
    aps: {
      timestamp: nowSec,
      event: 'start',
      'content-state': contentState,
      'attributes-type': 'DoseActivityAttributes',
      attributes,
      'stale-date': staleEpochSec ?? nowSec + 3600,
      alert: { title: '', body: '' }, // push-to-start silencioso (a superfície é a UI; alarme cobre som)
    },
  }

  return new Promise((resolve) => {
    let client
    try {
      client = http2lib.connect(cfg.host)
    } catch (err) {
      resolve({ ok: false, status: 0, reason: `connect_failed: ${err.message}` })
      return
    }
    client.on('error', (err) => {
      resolve({ ok: false, status: 0, reason: `client_error: ${err.message}` })
      try { client.close() } catch { /* noop */ }
    })

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToStartToken}`,
      authorization: `bearer ${_providerToken(cfg)}`,
      'apns-topic': `${cfg.bundleId}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
    })

    let status = 0
    let body = ''
    req.on('response', (headers) => { status = Number(headers[':status']) || 0 })
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { client.close() } catch { /* noop */ }
      if (status === 200) { resolve({ ok: true, status }); return }
      // 410 (Unregistered) / 400 BadDeviceToken → revogar o token (S-6)
      const deactivate = status === 410 || body.includes('BadDeviceToken') || body.includes('Unregistered')
      resolve({ ok: false, status, deactivate, reason: body || `http_${status}` })
    })
    req.on('error', (err) => {
      try { client.close() } catch { /* noop */ }
      resolve({ ok: false, status: 0, reason: `request_error: ${err.message}` })
    })
    req.end(JSON.stringify(payload))
  })
}
