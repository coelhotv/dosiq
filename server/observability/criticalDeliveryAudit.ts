/**
 * Apuração diária da entrega de dose crítica — 082 Slice B (FR-007..FR-010b).
 *
 * O incidente que abriu a spec durou um mês porque ninguém tinha como perguntar "quantas doses
 * críticas não foram entregues ontem?". Este módulo responde essa pergunta todo dia e manda a
 * resposta ao Sentry do backend (PR 0, ADR-101).
 *
 * 🔴 **Granularidade (FR-007a, decisão do PO de 2026-09-10 — opção (a+)):** `notification_log`
 * NÃO tem `dose_instance_id` e o R-191 grava **uma linha por BLOCO** de N doses. O casamento é
 * aproximado: `user_id` + protocolo + janela de tempo. O protocolo do bloco nem sempre está na
 * coluna — blocos `by_plan` e `misc` gravam `protocol_id` NULL e carregam os protocolos em
 * `provider_metadata.protocolIds`. Ignorar isso acusaria esses blocos de não-entrega todo dia
 * (falso-positivo diário, contra o FR-010).
 *
 * 🔴 **Constituição I:** o evento leva CONTAGENS e IDs opacos (`user_id`, `protocol_id`,
 * instante agendado). Nome de medicamento, de protocolo ou de plano NUNCA sai — quem recebe o
 * alerta resolve os nomes no banco.
 */
import { getRawNow, parseTimestamp } from '../utils/dateUtils.js'
import { captureServerEvent } from './sentry.js'

/** Janela de casamento entre a dose agendada e a linha de log do bloco que a cobriu. */
export const MATCH_WINDOW_BEFORE_MS = 10 * 60 * 1000
export const MATCH_WINDOW_AFTER_MS = 30 * 60 * 1000

/** Teto de itens enumerados no evento — o número total vai sempre completo. */
export const MAX_ITEMS = 50

/**
 * Teto EXPLÍCITO por leitura. O PostgREST trunca em 1000 sem avisar (AP-186): uma apuração que
 * cresce além disso passaria a medir um pedaço da base e a reportar o pedaço como se fosse o todo
 * — exatamente a classe de erro que esta spec existe para matar. Pedir o teto+1 e comparar torna o
 * truncamento VISÍVEL.
 */
export const ROW_LIMIT = 1000

/** FR-007: entrega comprovada é só esta. `suprimida_alarme` é dose COBERTA, não falha. */
const STATUS_ENTREGUE = 'enviada'
const STATUS_COBERTA = 'suprimida_alarme'
const STATUS_SILENCIADA = 'silenciada'
/**
 * FR-012b — supressão por AMBIGUIDADE. Escrito pelo gate do Slice C quando não há prova de alarme
 * para a dose E o usuário não é capaz de produzi-la. Ninguém avisou a paciente: é não-entrega, e
 * jamais `coberta`. Mapeá-lo junto de `suprimida_alarme` devolveria a spec ao defeito que a abriu.
 */
const STATUS_SEM_PROVA = 'suprimida_sem_prova'

export type DoseOutcome =
  | 'entregue'
  | 'coberta'
  | 'silenciada'
  | 'sem_canal'
  | 'falhou'
  | 'sem_registro'
  /** Silêncio residual do D1 (FR-012a/SC-002a): suprimida sem prova de alarme. */
  | 'nao_avisada'

/** Desfechos que entram na lista de não-entrega (FR-007). */
const OUTCOMES_NAO_ENTREGA: DoseOutcome[] = ['sem_canal', 'falhou', 'sem_registro', 'nao_avisada']

export interface CriticalDose {
  id: string
  user_id: string
  protocol_id: string
  scheduled_for: string
}

export interface DeliveryLogRow {
  user_id: string
  protocol_id: string | null
  status: string | null
  created_at: string
  notification_type: string
  provider_metadata: Record<string, unknown> | null
}

/**
 * A linha de log é de dose CRÍTICA? A marca vive em `provider_metadata.critical_alarm`, gravado
 * pelo dispatcher em toda linha `dose_reminder*` (verificado em prod). Linha antiga, anterior à
 * marca, não casa — e não casar é o lado conservador: a dose entra na lista em vez de sumir dela.
 */
export function isCriticalLogRow(row: DeliveryLogRow): boolean {
  return row.provider_metadata?.critical_alarm === true
}

/**
 * A linha de log ancora este protocolo? Coluna para o bloco de dose única; `protocolIds` do
 * `provider_metadata` para os blocos `by_plan`/`misc`, cuja coluna é NULL.
 */
export function logAnchorsProtocol(row: DeliveryLogRow, protocolId: string): boolean {
  if (row.protocol_id === protocolId) return true
  const meta = row.provider_metadata
  if (!meta) return false
  if (meta.protocolId === protocolId) return true
  const ids = meta.protocolIds
  return Array.isArray(ids) && ids.includes(protocolId)
}

/** A linha caiu na janela de casamento da dose? */
export function logInWindow(row: DeliveryLogRow, scheduledForMs: number): boolean {
  const t = Date.parse(row.created_at)
  if (Number.isNaN(t)) return false
  return t >= scheduledForMs - MATCH_WINDOW_BEFORE_MS && t <= scheduledForMs + MATCH_WINDOW_AFTER_MS
}

/**
 * 🔴 O CHECK do banco AINDA aceita o vocabulário legado (`sucesso`, `entregue`, `falha`,
 * `pendente`) — o Slice A ampliou o domínio, não o estreitou, e o D2 decidiu NÃO reclassificar o
 * histórico. Sem mapear os sinônimos de sucesso, uma linha legada cairia no `default` e viraria
 * `falhou`: alerta de não-entrega para dose que FOI entregue. `pendente` é entrega em curso, não
 * falha — vai para bucket próprio (`sem_registro`) em vez de acusar o paciente.
 */
function statusToOutcome(status: string | null): DoseOutcome {
  if (status === STATUS_ENTREGUE || status === 'sucesso' || status === 'entregue') return 'entregue'
  if (status === STATUS_COBERTA) return 'coberta'
  if (status === STATUS_SEM_PROVA) return 'nao_avisada'
  if (status === STATUS_SILENCIADA) return 'silenciada'
  if (status === 'sem_canal') return 'sem_canal'
  if (status === 'pendente' || status === null) return 'sem_registro'
  return 'falhou'
}

/**
 * Desfecho de uma dose crítica. Havendo mais de uma linha na janela (retry, bloco repetido),
 * vence a MELHOR: uma entrega comprovada não é apagada por uma falha vizinha.
 */
export function classifyDose(dose: CriticalDose, logs: DeliveryLogRow[]): DoseOutcome {
  const scheduledMs = Date.parse(dose.scheduled_for)
  if (Number.isNaN(scheduledMs)) return 'sem_registro'

  const matches = logs.filter(
    (row) =>
      row.user_id === dose.user_id &&
      isCriticalLogRow(row) &&
      logAnchorsProtocol(row, dose.protocol_id) &&
      logInWindow(row, scheduledMs)
  )
  if (matches.length === 0) return 'sem_registro'

  const outcomes = matches.map((m) => statusToOutcome(m.status))
  if (outcomes.includes('entregue')) return 'entregue'
  if (outcomes.includes('coberta')) return 'coberta'
  if (outcomes.includes('silenciada')) return 'silenciada'
  if (outcomes.includes('sem_canal')) return 'sem_canal'
  if (outcomes.includes('falhou')) return 'falhou'
  // Pior que `falhou` na ordem de preferência de LEITURA porque é o desfecho mais silencioso:
  // nem tentativa houve. Só vence `sem_registro`, que é ausência de linha.
  if (outcomes.includes('nao_avisada')) return 'nao_avisada'
  // Só sobram linhas `pendente`/sem status: entrega em curso, não desfecho. Fica em bucket próprio.
  return 'sem_registro'
}

export interface NoDeliveryItem {
  userId: string
  protocolId: string
  scheduledFor: string
  outcome: DoseOutcome
}

export type NoChannelReason = 'sem_aparelho_sem_telegram' | 'so_telegram_sem_aparelho'

export interface NoChannelItem {
  userId: string
  reason: NoChannelReason
}

export interface CriticalDeliveryReport {
  window: { start: string; end: string }
  totals: Record<DoseOutcome, number>
  consentRevokedSkipped: number
  criticalNoDelivery: { total: number; items: NoDeliveryItem[] }
  noChannelPatients: { total: number; soTelegram: number; items: NoChannelItem[] }
  /** Contexto (decisão do PO): pacientes SEM canal físico em qualquer tipo de notificação. */
  noChannelAllTypes: number
  /** Leituras truncadas pelo teto do PostgREST — não-vazio invalida os números deste run. */
  truncatedReads: string[]
  /**
   * FR-010a/FR-012c/SC-002a — silêncio residual do D1: doses críticas suprimidas por AMBIGUIDADE
   * (sem prova de alarme, usuário incapaz de produzi-la). Derivado de
   * `status = 'suprimida_sem_prova'` na janela — NUNCA inferido por ausência de linha (FR-010b),
   * nunca misturado com `suprimida_alarme`, que é dose COBERTA.
   *
   * Nasceu literal `0` no Slice B, como baseline declarado, porque a supressão que ele conta só
   * passou a existir no Slice C. Religado aqui (T039c): um número que nasce constante e nunca é
   * religado é gate que reporta sucesso sem executar (AP-325).
   */
  residualSilence: number
}

export function buildReport(params: {
  windowStart: Date
  windowEnd: Date
  doses: CriticalDose[]
  logs: DeliveryLogRow[]
  revokedUserIds: Set<string>
  noChannel: NoChannelItem[]
  noChannelAllTypes: number
  truncatedReads?: string[]
}): CriticalDeliveryReport {
  const totals: Record<DoseOutcome, number> = {
    entregue: 0,
    coberta: 0,
    silenciada: 0,
    sem_canal: 0,
    falhou: 0,
    sem_registro: 0,
    nao_avisada: 0,
  }
  const items: NoDeliveryItem[] = []
  let consentRevokedSkipped = 0

  for (const dose of params.doses) {
    // FR-010b: consentimento revogado retorna ANTES do log — não existe linha, e ausência de
    // linha aqui não é não-entrega, é ausência deliberada de notificação.
    if (params.revokedUserIds.has(dose.user_id)) {
      consentRevokedSkipped += 1
      continue
    }
    const outcome = classifyDose(dose, params.logs)
    totals[outcome] += 1
    if (OUTCOMES_NAO_ENTREGA.includes(outcome)) {
      items.push({
        userId: dose.user_id,
        protocolId: dose.protocol_id,
        scheduledFor: dose.scheduled_for,
        outcome,
      })
    }
  }

  return {
    window: { start: params.windowStart.toISOString(), end: params.windowEnd.toISOString() },
    totals,
    consentRevokedSkipped,
    criticalNoDelivery: { total: items.length, items: items.slice(0, MAX_ITEMS) },
    noChannelPatients: {
      total: params.noChannel.filter((p) => p.reason === 'sem_aparelho_sem_telegram').length,
      soTelegram: params.noChannel.filter((p) => p.reason === 'so_telegram_sem_aparelho').length,
      items: params.noChannel.slice(0, MAX_ITEMS),
    },
    noChannelAllTypes: params.noChannelAllTypes,
    truncatedReads: params.truncatedReads ?? [],
    residualSilence: totals.nao_avisada,
  }
}

/** FR-010 — dia saudável não emite evento. Sem isso o alerta vira ruído diário e ninguém lê. */
export function shouldAlert(report: CriticalDeliveryReport): boolean {
  return (
    report.criticalNoDelivery.total > 0 ||
    report.noChannelPatients.total > 0 ||
    report.truncatedReads.length > 0
  )
}

interface SupabaseLike {
  from(table: string): any
}

interface LoggerLike {
  info(message: string, meta?: Record<string, unknown>): void
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void
}

async function fetchOrThrow<T>(query: any, what: string): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`${what}: ${error.message ?? String(error)}`)
  const rows = (data ?? []) as T[]
  if (rows.length >= ROW_LIMIT) {
    // Não lança: uma apuração parcial ainda vale mais que nenhuma. Mas o número reportado deixa de
    // ser confiável, e isso tem de aparecer, não ser deduzido.
    truncatedReads.push(what)
  }
  return rows
}

/** Leituras que bateram no teto nesta execução — esvaziada a cada run. */
let truncatedReads: string[] = []

interface UserSettingsRow {
  user_id: string
  telegram_chat_id: string | null
  consent_revoked_at: string | null
}

/** Todas as leituras da apuração, num lugar só. Qualquer erro de banco vira exceção (fail-loud). */
async function fetchAuditInputs(supabase: SupabaseLike, windowStart: Date, windowEnd: Date) {
  const doses = await fetchOrThrow<CriticalDose>(
    supabase
      .from('dose_instances')
      .select('id, user_id, protocol_id, scheduled_for')
      .eq('critical_alarm', true)
      .gte('scheduled_for', windowStart.toISOString())
      .lte('scheduled_for', windowEnd.toISOString())
      .limit(ROW_LIMIT),
    'dose_instances'
  )

  // A janela do log é mais larga que a das doses: um bloco pode ser gravado até 30 min depois do
  // horário agendado (e até 10 min antes).
  const logs = await fetchOrThrow<DeliveryLogRow>(
    supabase
      .from('notification_log')
      .select('user_id, protocol_id, status, created_at, notification_type, provider_metadata')
      .like('notification_type', 'dose_reminder%')
      .gte('created_at', parseTimestamp(windowStart.getTime() - MATCH_WINDOW_BEFORE_MS).toISOString())
      .lte('created_at', parseTimestamp(windowEnd.getTime() + MATCH_WINDOW_AFTER_MS).toISOString())
      .limit(ROW_LIMIT),
    'notification_log'
  )

  const criticalProtocols = await fetchOrThrow<{ user_id: string }>(
    supabase
      .from('protocols')
      .select('user_id')
      .eq('critical_alarm', true)
      .eq('active', true)
      .limit(ROW_LIMIT),
    'protocols'
  )

  const settings = await fetchOrThrow<UserSettingsRow>(
    supabase
      .from('user_settings')
      .select('user_id, telegram_chat_id, consent_revoked_at')
      .limit(ROW_LIMIT),
    'user_settings'
  )

  const devices = await fetchOrThrow<{ user_id: string }>(
    supabase
      .from('notification_devices')
      .select('user_id')
      .eq('provider', 'expo')
      .eq('is_active', true)
      .limit(ROW_LIMIT),
    'notification_devices'
  )
  const activeProtocols = await fetchOrThrow<{ user_id: string }>(
    supabase.from('protocols').select('user_id').eq('active', true).limit(ROW_LIMIT),
    'protocols(active)'
  )

  const criticalUserIds = [...new Set(criticalProtocols.map((p) => p.user_id))]
  const activeUserIds = [...new Set(activeProtocols.map((p) => p.user_id))]
  return { doses, logs, criticalUserIds, settings, devices, activeUserIds }
}

interface ChannelInputs {
  withDevice: Set<string>
  settingsByUser: Map<string, { telegram_chat_id: string | null }>
  revokedUserIds: Set<string>
}

/**
 * Quem, entre estes usuários, fica sem canal — pela regra CRÍTICA.
 *
 * 🔴 Tem de ser a MESMA de `resolveChannelsForUser` para dose crítica: device expo ativo ⇒
 * `mobile_push`; senão `telegram_chat_id` ⇒ `telegram`; senão nenhum canal. As flags
 * `channel_*_enabled` NÃO valem para crítica, e web push nunca entra. Escrever isto com a regra
 * genérica reportaria uma população diferente da que o dispatcher de fato atende.
 */
export function classifyChannels(userIds: string[], inputs: ChannelInputs): NoChannelItem[] {
  const out: NoChannelItem[] = []
  for (const userId of userIds) {
    if (inputs.revokedUserIds.has(userId)) continue
    if (inputs.withDevice.has(userId)) continue
    const hasTelegram = inputs.settingsByUser.get(userId)?.telegram_chat_id != null
    out.push({ userId, reason: hasTelegram ? 'so_telegram_sem_aparelho' : 'sem_aparelho_sem_telegram' })
  }
  return out
}

/**
 * Roda a apuração e, havendo o que reportar, emite UM evento agregado ao Sentry.
 * Lança em erro de banco — o `runJob` de `api/notify.ts` isola a falha e a captura (não propaga
 * para os demais jobs, e não fica invisível).
 */
export async function runCriticalDeliveryAudit(params: {
  supabase: SupabaseLike
  logger: LoggerLike
  correlationId?: string
  now?: Date
}): Promise<CriticalDeliveryReport> {
  const { supabase, logger, correlationId } = params
  truncatedReads = []
  // Instantes absolutos (UTC) para a janela; o fuso do usuário só serviria para rótulo (R-020).
  const windowEnd = params.now ?? getRawNow()
  const windowStart = parseTimestamp(windowEnd.getTime() - 24 * 60 * 60 * 1000)

  const { doses, logs, criticalUserIds, settings, devices, activeUserIds } =
    await fetchAuditInputs(supabase, windowStart, windowEnd)

  const withDevice = new Set(devices.map((d) => d.user_id))
  const settingsByUser = new Map(settings.map((row) => [row.user_id, row]))
  // FR-010b: quem revogou não gera linha de log nenhuma — o dispatcher retorna antes.
  const revokedUserIds = new Set(
    settings.filter((row) => row.consent_revoked_at !== null).map((row) => row.user_id)
  )

  const noChannel = classifyChannels(criticalUserIds, { withDevice, settingsByUser, revokedUserIds })
  const noChannelAllTypes = classifyChannels(activeUserIds, {
    withDevice,
    settingsByUser,
    revokedUserIds,
  }).filter((p) => p.reason === 'sem_aparelho_sem_telegram').length

  const report = buildReport({
    windowStart,
    windowEnd,
    doses,
    logs,
    revokedUserIds,
    noChannel,
    noChannelAllTypes,
    truncatedReads,
  })

  if (!shouldAlert(report)) {
    logger.info('Apuração de entrega crítica: nada a reportar', {
      correlationId,
      criticas: doses.length,
      entregues: report.totals.entregue,
    })
    return report
  }

  captureServerEvent('Dose crítica sem entrega comprovada nas últimas 24 h', {
    level: 'error',
    correlationId,
    job: 'critical_delivery_audit',
    extras: {
      window: report.window,
      criticalNoDelivery: { total: report.criticalNoDelivery.total, totals: report.totals },
      items: report.criticalNoDelivery.items,
      noChannelPatients: {
        total: report.noChannelPatients.total,
        soTelegram: report.noChannelPatients.soTelegram,
      },
      // 🔴 A lista sobe para o TOPO do `extra` de propósito (T060a). Aninhada sob
      // `noChannelPatients` ela ficava no 4º nível e o `normalizeDepth` do SDK — 3 por padrão — a
      // entregava como `["[Object]","[Object]"]`: o operador via QUANTOS pacientes estão sem canal
      // e não QUAIS, que é o encaminhamento prometido pelo FR-008. Descoberto no evento REAL
      // `DOSIQ-SERVER-4` (2026-09-11), não em teste: o objeto é montado certo e a perda acontece na
      // serialização, depois do ponto que o teste com `captureServerEvent` mockado afere.
      //
      // Por que não subir o `normalizeDepth`: ele vale para TODO evento de TODO emissor, e o scrub
      // (allowlist de topo + R-321) teria de ser revalidado para todos. Profundidade nunca foi
      // controle de segurança aqui, mas mexer nela tem alcance global — subir esta lista um nível
      // custa uma entrada de allowlist e conserta só o que está quebrado. O `items` de não-entrega,
      // que já nascia no topo, é a prova de que array de objetos RASOS no topo atravessa inteiro.
      noChannelItems: report.noChannelPatients.items,
      noChannelAllTypes: report.noChannelAllTypes,
      residualSilence: report.residualSilence,
      logRate: { doses: doses.length, linhas: logs.length, truncado: report.truncatedReads },
    },
  })

  logger.error('Apuração de entrega crítica: não-entrega detectada', null, {
    correlationId,
    semEntrega: report.criticalNoDelivery.total,
    semCanal: report.noChannelPatients.total,
  })

  return report
}
