/**
 * Sentry para o backend (`server/` + `api/`) — ADR-101.
 *
 * Até esta spec o Sentry só cobria o app mobile (ADR-090); `server/` e `api/` — dispatcher de
 * notificações, crons de lembrete, webhook do bot — não emitiam nada. Consequência medida: um mês
 * de dose crítica falhando em silêncio enquanto o painel mostrava "tudo ok" (spec 082, AP-325).
 *
 * **Lightweight mode** (`@sentry/node-core/light`): sem OpenTelemetry, portanto sem
 * `--import` / `NODE_OPTIONS` — flags que o runtime Node da Vercel não expõe e que o Sentry
 * padrão exige em ESM puro (nós somos `"type": "module"`). Mantém `captureException`, contexto e
 * `flush`; abre mão de tracing/APM automático, que o backend não usa.
 * Spike: `plans/specs/082-critical-dose-delivery-truth/spike-sentry-backend.md`.
 *
 * 🔴 **Constituição I — o scrub de dado de saúde é obrigatório, não preferência.** Nome de
 * medicamento, dose, horário e identificador de paciente (Telegram `chat_id`/`from.id`, e-mail,
 * telefone) NÃO saem do nosso perímetro. O evento carrega apenas `user_id` (nosso id interno) e
 * `correlationId`. Ver `scrubEvent`.
 */
import * as Sentry from '@sentry/node-core/light'

/** Chaves de `extra`/`tags` que podem sair — tudo o mais é descartado (allowlist, não denylist). */
const EXTRA_ALLOWLIST = new Set([
  'correlationId',
  'job',
  'jobType',
  'kind',
  'channel',
  'statusCode',
  'attempted',
  'reason',
  'count',
  'environment',
  // 082 Slice B — apuração diária de entrega crítica. Só CONTAGENS e IDs opacos (`user_id`,
  // `protocol_id`, instante agendado): nome de medicamento, de protocolo e de plano NUNCA entram,
  // por Constituição I. Quem recebe o alerta resolve os nomes no banco, com o id em mãos.
  'window',
  'criticalNoDelivery',
  'noChannelPatients',
  'residualSilence',
  'noChannelAllTypes',
  'items',
  // 082 T060a — lista de pacientes sem canal, içada para o topo do `extra` porque aninhada ela era
  // achatada em `"[Object]"` pelo `normalizeDepth` do SDK. Mesmo conteúdo de sempre: `user_id`
  // opaco + o motivo (`sem_aparelho_sem_telegram` × `so_telegram_sem_aparelho`). Sem nome de
  // medicamento, protocolo ou plano — quem recebe resolve no banco, com o id em mãos.
  'noChannelItems',
  'logRate',
])

/** Contextos padrão do SDK que são seguros; qualquer contexto custom é removido. */
const CONTEXT_ALLOWLIST = new Set(['runtime', 'os', 'trace', 'app', 'device', 'culture'])

const MAX_TEXT = 2000

/** Redige e-mail, telefone/`chat_id` (sequências longas de dígitos) e token de bot do Telegram. */
export function redactText(input: string): string {
  return input
    .slice(0, MAX_TEXT)
    .replace(/\d{6,10}:[A-Za-z0-9_-]{30,}/g, '[tg-token]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b\d{7,}\b/g, '[num]')
}

/** Forma mínima de um evento Sentry — só os campos que o scrub inspeciona. */
export interface SentryEventLike {
  message?: string
  request?: unknown
  user?: { id?: string | number } & Record<string, unknown> | null
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  tags?: Record<string, unknown>
  breadcrumbs?: unknown
  exception?: { values?: Array<StackFrameHolder & { value?: string } & Record<string, unknown>> }
  stacktrace?: StackFrameHolder
  threads?: { values?: Array<StackFrameHolder & Record<string, unknown>> }
  [k: string]: unknown
}

interface StackFrameHolder {
  stacktrace?: { frames?: Array<Record<string, unknown>> }
  frames?: Array<Record<string, unknown>>
}

/** Remove código-fonte e variáveis locais dos frames — podem carregar domínio próximo ao throw. */
function stripFrameSource(holder: StackFrameHolder | undefined): void {
  const frames = holder?.frames ?? holder?.stacktrace?.frames
  if (!frames) return
  for (const f of frames) {
    delete f.pre_context
    delete f.context_line
    delete f.post_context
    delete f.vars
  }
}

/**
 * Remove dado clínico e PII de um evento ANTES do envio. Muta e devolve o mesmo objeto.
 * Pura (sem dependência do SDK) para ser exercitável em teste — é o guard do Princípio I.
 */
export function scrubEvent<T extends SentryEventLike | null | undefined>(event: T): T {
  if (!event) return event

  // `request` carrega headers (Authorization), cookies, query e body — no webhook do bot o body
  // é a mensagem do paciente. Nada disso pode sair.
  delete event.request

  // `user`: só o nosso id interno.
  if (event.user && event.user.id != null) {
    event.user = { id: String(event.user.id) }
  } else {
    delete event.user
  }

  // `extra` e `tags`: allowlist estrita.
  if (event.extra) event.extra = pickAllowed(event.extra, EXTRA_ALLOWLIST)
  if (event.tags) event.tags = pickAllowed(event.tags, EXTRA_ALLOWLIST)

  // `contexts`: mantém só os padrão do SDK; contexto custom pode ter sido populado com domínio.
  if (event.contexts) event.contexts = pickAllowed(event.contexts, CONTEXT_ALLOWLIST)

  // Breadcrumbs (console/log/http) carregam strings arbitrárias — fora por completo.
  delete event.breadcrumbs

  // Texto livre autoral (mensagem de erro, stack): redige PII residual e trunca.
  if (typeof event.message === 'string') event.message = redactText(event.message)
  if (event.exception?.values) {
    for (const v of event.exception.values) {
      if (typeof v.value === 'string') v.value = redactText(v.value)
      stripFrameSource(v)
    }
  }
  stripFrameSource(event.stacktrace)
  if (event.threads?.values) for (const t of event.threads.values) stripFrameSource(t)

  return event
}

function pickAllowed(obj: Record<string, unknown>, allow: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    if (allow.has(key)) out[key] = obj[key]
  }
  return out
}

let initialized = false

/** Inicializa o Sentry do backend. Idempotente. Sem DSN, vira no-op silencioso. */
export function initSentry(): void {
  if (initialized) return
  initialized = true

  const dsn = process.env.SENTRY_SERVER_DSN
  if (!dsn) {
    if ((process.env.VERCEL_ENV || process.env.NODE_ENV) === 'production') {
      console.warn('[sentry] SENTRY_SERVER_DSN ausente em produção — captura do backend desativada')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    // Volume real do backend é baixo (spike §4: 1 erro em 14 dias) — captura tudo, sem APM.
    sampleRate: 1,
    // 🔴 ContextLines (linhas de código-fonte) e LocalVariables (variáveis locais no frame do
    // throw) são vetor de vazamento de dado clínico — uma var `medicationName` perto de um erro
    // iria junto. O backend quer alerta, não depuração por fonte. Fora na origem; o scrub ainda
    // varre os frames como segunda barreira.
    integrations: (defaults) =>
      defaults.filter((i) => i.name !== 'ContextLines' && i.name !== 'LocalVariables'),
    beforeSend(event) {
      return scrubEvent(event as unknown as SentryEventLike) as unknown as typeof event
    },
    // Defense in depth com o scrub: nenhum breadcrumb sai do backend.
    beforeBreadcrumb() {
      return null
    },
  })
}

interface CaptureContext {
  correlationId?: string
  /** Nosso id interno de usuário — nunca id de plataforma externa (Telegram, e-mail). */
  userId?: string | null
  job?: string
  kind?: string
}

/** Captura uma exceção com contexto operacional mínimo. No-op sem DSN. */
export function captureServerException(error: unknown, context: CaptureContext = {}): void {
  if (!process.env.SENTRY_SERVER_DSN) return
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: String(context.userId) })
    const extra: Record<string, string> = {}
    if (context.correlationId) extra.correlationId = context.correlationId
    if (context.job) extra.job = context.job
    if (context.kind) extra.kind = context.kind
    scope.setExtras(extra)
    Sentry.captureException(error)
  })
}

type ServerEventLevel = 'info' | 'warning' | 'error'

interface CaptureEventContext extends CaptureContext {
  level?: ServerEventLevel
  /** Só chaves da `EXTRA_ALLOWLIST` sobrevivem ao scrub — o resto é descartado em silêncio. */
  extras?: Record<string, unknown>
}

/**
 * Captura um evento de MENSAGEM (não-excepcional). No-op sem DSN.
 *
 * Alerta operacional não é exceção: `captureException(new Error(...))` produziria um stacktrace
 * do próprio emissor — ruído — e agruparia os eventos pela linha que os criou, não pelo assunto.
 * `captureMessage` agrupa pela mensagem, que é o que o operador lê.
 */
export function captureServerEvent(message: string, context: CaptureEventContext = {}): void {
  if (!process.env.SENTRY_SERVER_DSN) return
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: String(context.userId) })
    const extra: Record<string, unknown> = { ...(context.extras ?? {}) }
    if (context.correlationId) extra.correlationId = context.correlationId
    if (context.job) extra.job = context.job
    if (context.kind) extra.kind = context.kind
    scope.setExtras(extra)
    Sentry.captureMessage(message, context.level ?? 'warning')
  })
}

/**
 * Aguarda o envio dos eventos pendentes. OBRIGATÓRIO antes de o handler serverless retornar —
 * sem isto a função congela e o evento morre (spike §3). Nunca lança (`maxDuration: 60` acomoda).
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!process.env.SENTRY_SERVER_DSN) return
  try {
    await Sentry.flush(timeoutMs)
  } catch {
    // flush não pode derrubar o handler
  }
}

/**
 * Isola o escopo por invocação. Necessário porque a Fluid Compute reaproveita instâncias entre
 * requisições concorrentes — sem isolamento, o contexto de um paciente vazaria para o evento de
 * outro (o Node 22+ já isola automático; este wrapper é a garantia explícita no ponto de entrada).
 */
export function withServerIsolation<T>(fn: () => Promise<T>): Promise<T> {
  return Sentry.withIsolationScope(() => fn())
}
