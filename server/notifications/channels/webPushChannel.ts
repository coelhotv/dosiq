import webpush from 'web-push'

interface WebPushDevice {
  push_token: string
  [key: string]: unknown
}

interface NotificationPayload {
  title?: string
  body: string
  pushBody?: string
  deeplink?: string | null
}

interface DeviceRepository {
  listActiveByUser(userId: string, provider: string): Promise<WebPushDevice[]>
  deactivateByToken(token: string): Promise<void>
}

interface Repositories {
  devices: DeviceRepository
}

function mapDeeplinkToWebPath(deeplink: string | null | undefined): string {
  if (!deeplink) return '/'
  let path = deeplink.replace('dosiq://', '/')
  if (path.startsWith('/admin/dlq')) {
    path = path.replace('/admin/dlq', '/admin-dlq')
  }
  return path
}

// Inicializa a configuração VAPID para o envio de push.
function _initVapid(correlationId: string, userId: string): boolean | null {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@dosiq.app'

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[webPushChannel] Chaves VAPID ausentes no ambiente. Ignorando envio.', { correlationId, userId })
    return null
  }

  try {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
  } catch (e: any) {
    console.error('[webPushChannel] Falha ao configurar chaves VAPID:', e?.message || String(e))
  }
  return true
}

interface WebPushSendResult {
  token?: string
  success: boolean
  error?: any
}

// Executa o envio individual em paralelo com tratamento de exceções.
async function _sendIndividualWebPush(devices: WebPushDevice[], pushPayload: string, correlationId: string, userId: string): Promise<PromiseSettledResult<WebPushSendResult>[]> {
  const sendPromises = devices.map(async (device): Promise<WebPushSendResult> => {
    try {
      if (!device?.push_token) {
        throw new Error('Token de push ausente ou inválido')
      }
      const subscription = JSON.parse(device.push_token)
      await webpush.sendNotification(subscription, pushPayload)
      return { token: device.push_token, success: true }
    } catch (error: any) {
      console.error('[webPushChannel] Falha no push individual', { correlationId, userId, token: device?.push_token, error: error?.message || String(error) })
      return { token: device?.push_token, success: false, error }
    }
  })
  return await Promise.allSettled(sendPromises)
}

// Processa o resultado do envio settled de web push.
function _processSettledWebPushResults(settledResults: PromiseSettledResult<WebPushSendResult>[]) {
  let delivered = 0
  let failed = 0
  const errors: Array<{ token?: string; code?: number; message?: string }> = []
  const tokensToDeactivate: string[] = []

  for (const r of settledResults) {
    if (r.status === 'rejected') {
      failed++
      errors.push({ message: r.reason?.message || 'Unknown settled error' })
      continue
    }

    const { token, success, error } = r.value
    if (success) {
      delivered++
    } else {
      failed++
      const statusCode = error?.statusCode
      errors.push({ token, code: statusCode, message: error?.message || String(error) })

      // Se 410 (Gone), 404 (Not Found) ou erro de parse (SyntaxError), o token não é mais válido
      if (statusCode === 410 || statusCode === 404 || error instanceof SyntaxError) {
        if (token) {
          tokensToDeactivate.push(token)
        }
      }
    }
  }

  return { delivered, failed, errors, tokensToDeactivate }
}

interface SendWebPushParams {
  userId: string
  payload: NotificationPayload
  context?: { correlationId?: string }
  repositories: Repositories
}

export async function sendWebPushNotification({ userId, payload, context, repositories }: SendWebPushParams) {
  const correlationId = context?.correlationId || 'unknown'

  if (!_initVapid(correlationId, userId)) {
    return {
      channel: 'web_push',
      success: true, // Fail graceful
      attempted: 0,
      delivered: 0,
      failed: 0,
      deactivatedTokens: [],
      errors: [{ message: 'VAPID keys not configured in environment' }]
    }
  }

  const devices = await repositories.devices.listActiveByUser(userId, 'webpush')

  if (devices.length === 0) {
    console.info('[webPushChannel] sem devices ativos', { correlationId, userId })
    return {
      channel: 'web_push',
      success: true,
      attempted: 0,
      delivered: 0,
      failed: 0,
      deactivatedTokens: [],
      errors: [],
    }
  }

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.pushBody || payload.body,
    icon: '/app-icons/web/icon-512.png',
    url: mapDeeplinkToWebPath(payload.deeplink)
  })

  const settledResults = await _sendIndividualWebPush(devices, pushPayload, correlationId, userId)
  const { delivered, failed, errors, tokensToDeactivate } = _processSettledWebPushResults(settledResults)

  const deactivationResults = await Promise.allSettled(
    tokensToDeactivate.map((token) => repositories.devices.deactivateByToken(token))
  )

  const deactivatedTokens = tokensToDeactivate.filter((_, i) => {
    if (deactivationResults[i].status === 'rejected') {
      console.error('[webPushChannel] falha ao desativar token', { correlationId, userId, token: tokensToDeactivate[i], error: deactivationResults[i].reason?.message })
      return false
    }
    console.info('[webPushChannel] token desativado', { correlationId, userId, token: tokensToDeactivate[i] })
    return true
  })

  console.info('[webPushChannel] resultado', { correlationId, userId, attempted: devices.length, delivered, failed, deactivatedTokens })

  return {
    channel: 'web_push',
    success: failed === 0,
    attempted: devices.length,
    delivered,
    failed,
    deactivatedTokens,
    errors
  }
}
