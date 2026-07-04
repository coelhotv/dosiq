// Declarações ambientes mínimas para dependências sem @types (server/notifications, F3.2 nível A).
// Cobrem só a superfície realmente usada neste domínio.

declare module 'jsonwebtoken' {
  export interface SignOptions {
    algorithm?: string
    header?: Record<string, unknown>
    [key: string]: unknown
  }
  export function sign(payload: Record<string, unknown>, secretOrPrivateKey: string, options?: SignOptions): string
}

declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(subscription: PushSubscription, payload?: string): Promise<unknown>
}
