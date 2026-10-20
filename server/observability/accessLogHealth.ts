/**
 * Spec 106 FR-004 — saúde da guarda dos registros de acesso (Marco Civil, art. 15).
 *
 * Toda a regra mora no SQL (`public.access_log_health()`, migração 20261020): a função devolve uma
 * linha por problema e lista vazia quando a coleta está íntegra. Aqui só se chama a RPC e, havendo
 * problema, emite UM evento ao Sentry do backend. O evento leva só o nome da checagem e o detalhe
 * (contagens e horários) — nunca ip ou user_id (RC-SEC S-2): o objeto é remontado campo a campo, então
 * um campo novo que a RPC passe a devolver não vaza por arrasto.
 */
import { captureServerEvent } from './sentry.js'

interface SupabaseLike {
  rpc(fn: string): PromiseLike<{ data: unknown; error: unknown }>
}

interface LoggerLike {
  info(message: string, meta?: Record<string, unknown>): void
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void
}

export interface AccessLogProblem {
  check_name: string
  detail: string
}

function toProblems(data: unknown): AccessLogProblem[] {
  if (!Array.isArray(data)) return []
  return data.map((row: { check_name?: unknown; detail?: unknown }) => ({
    check_name: String(row?.check_name ?? ''),
    detail: String(row?.detail ?? ''),
  }))
}

/**
 * Lança em erro da RPC — o `runJob` de `api/notify.ts` isola a falha e a captura (não propaga para os
 * demais jobs, e não fica invisível).
 */
export async function runAccessLogHealth(params: {
  supabase: SupabaseLike
  logger: LoggerLike
  correlationId?: string
}): Promise<AccessLogProblem[]> {
  const { supabase, logger, correlationId } = params

  const { data, error } = await supabase.rpc('access_log_health')
  if (error) {
    const message = (error as { message?: string }).message ?? String(error)
    throw new Error(`access_log_health falhou: ${message}`)
  }

  const problems = toProblems(data)
  if (problems.length === 0) {
    logger.info('Registro de acesso (Marco Civil): coleta íntegra', { correlationId })
    return problems
  }

  captureServerEvent('Registro de acesso (Marco Civil) com problema', {
    level: 'error',
    correlationId,
    job: 'access_log_health',
    extras: { count: problems.length, items: problems },
  })
  return problems
}
