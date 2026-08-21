// consentPrune.ts — Exclusão automática pós-revogação (spec 046 Slice C · T013/T013b/T013d).
//
// ═══════════════════════════════════════════════════════════════════════════════
// O QUE ESTE ARQUIVO FAZ E POR QUE ELE NASCE FREADO
// ─────────────────────────────────────────────────────────────────────────────
// Quem revoga o consentimento de dado de saúde pede para o dosiq parar de tratar seus dados.
// Retenção sem base legal é ilícita: 90 dias depois da revogação, sem resolução, a conta e os
// dados são excluídos. Antes disso, dois avisos — D+60 e D+83.
//
// Este é o ÚNICO código do projeto que apaga a conta de alguém sem ninguém clicar em nada. Um bug
// aqui não gera erro na tela: gera dado excluído que não volta. Daí os três freios do T013b, que
// valem TODOS ao mesmo tempo:
//   1. `CONSENT_PRUNE_MODE` — default `dry_run`. Só a string exata 'armed' arma. Env ausente,
//      vazio, com typo, com espaço ⇒ dry-run. A falta de configuração nunca apaga nada.
//   2. cap rígido por run — acima do teto o run ABORTA INTEIRO (não apaga o "começo da lista").
//      Um SELECT que de repente devolve 40 candidatos onde havia 2 é um bug, não um feriado.
//   3. kill-switch por env, sem deploy — `CONSENT_PRUNE_ENABLED=0` desliga tudo, inclusive avisos.
//
// ⚠️ ERRO DE LEITURA NÃO É SINAL VERDE (família AP-290). Se a reconferência da trilha falhar, não
// sabemos se o titular re-consentiu — e não sabendo, NÃO APAGAMOS. O candidato é pulado com alerta.
// O custo de pular é um dia de atraso; o custo de errar para o outro lado é irreversível.
//
// ⚠️ O PRUNE APAGA MESMO COM TRATAMENTO ATIVO (S1/PO-SEC-3). O bloqueio `active_treatments_block`
// vive só no caminho do TITULAR (`delete_user_account()`), de propósito: o alvo típico do prune É
// alguém com tratamento ativo, e herdar o bloqueio faria a conta nunca ser apagada — lei
// descumprida em silêncio, com o job verde. Por isso a exclusão vai por `delete_user_account_by_id`.
//
// ⚠️ O PEPPER NÃO SAI DO POSTGRES (AP-293). Os eventos `notice_sent`/`pruned` exigem `subject_hash`,
// derivado do e-mail com um segredo do Vault. O Node NÃO computa esse hash: chama a RPC
// `consent_controller_event`, que o deriva dentro do banco. (`account_deleted` já é emitido dentro
// da transação de `_delete_user_account_core` — o último instante em que o e-mail ainda existe.)

import { createLogger } from './logger.js'
import { getRawNow } from '../utils/dateUtils.js'

/**
 * Contrato mínimo do client (subset do `SupabaseClient`), no mesmo espírito do
 * `OutboxSupabaseClient`. Tipar por `SupabaseClient` aqui quebraria o cross-program: `api/` e
 * `server/` resolvem o pacote em `node_modules` diferentes, e os dois tipos não são atribuíveis
 * entre si.
 */
export interface ConsentPruneClient {
  from(table: string): any
  rpc(fn: string, args?: Record<string, unknown>): any
}

const logger = createLogger('ConsentPrune')

/** Dias após a revogação em que cada ato acontece. */
export const PRUNE_NOTICE_DAYS = Object.freeze({ d60: 60, d83: 83 })
export const PRUNE_DELETE_DAYS = 90

/** Teto de exclusões por run. Acima disso o run aborta — ver freio 2 no cabeçalho. */
export const PRUNE_DEFAULT_CAP = 5

/**
 * Teto de AVISOS por run. O cap de exclusões não protege deste caso: um `consent_revoked_at`
 * corrompido em massa não apagaria ninguém (só passa dos 90 dias quem revogou mesmo), mas
 * dispararia um push para cada linha. É reversível, e ainda assim é um incidente.
 */
export const PRUNE_DEFAULT_NOTICE_CAP = 50

/**
 * Lê um teto do env recusando lixo. `Number('abc')` é `NaN`, e **toda comparação com NaN é false**:
 * um typo no env faria `due > cap` nunca disparar, desarmando o freio EXATAMENTE no cenário em que
 * ele existe para agir. Valor ausente, não-numérico ou negativo ⇒ default.
 */
export function resolveCap(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export type ConsentPruneMode = 'dry_run' | 'armed'

export interface ConsentPruneCandidate {
  user_id: string
  consent_revoked_at: string
}

export interface ConsentPruneResult {
  mode: ConsentPruneMode
  enabled: boolean
  candidates: number
  noticed: number
  pruned: number
  skipped: number
  aborted: boolean
  reason?: string
}

export interface ConsentPruneDeps {
  supabase: ConsentPruneClient
  /** `notificationDispatcher` do ciclo diário — mesmo contrato dos demais jobs. */
  dispatcher: { dispatch(input: Record<string, unknown>): Promise<unknown> }
  env?: Record<string, string | undefined>
  now?: Date
  correlationId?: string
  cap?: number
  noticeCap?: number
}

/**
 * Lê o modo do env. Só 'armed' arma — qualquer outra coisa (ausente, vazia, 'ARMED ', typo) é
 * dry-run. A direção do default é o freio: configuração faltando nunca pode APAGAR.
 */
export function resolvePruneMode(env: Record<string, string | undefined> = process.env): ConsentPruneMode {
  return env.CONSENT_PRUNE_MODE === 'armed' ? 'armed' : 'dry_run'
}

/** Kill-switch. Só '0' e 'false' desligam — o default é ligado (avisos precisam sair). */
export function isPruneEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env.CONSENT_PRUNE_ENABLED ?? '').trim().toLowerCase()
  return raw !== '0' && raw !== 'false'
}

/** Dias inteiros decorridos desde a revogação (UTC — a régua legal é de dias corridos). */
export function daysSince(revokedAt: string, now: Date): number {
  const revoked = Date.parse(revokedAt)
  if (Number.isNaN(revoked)) return Number.NaN
  return Math.floor((now.getTime() - revoked) / 86_400_000)
}

/**
 * Reconferência na TRILHA antes de qualquer ato (defesa em profundidade).
 *
 * `user_settings.consent_revoked_at` é índice operacional; `consent_log` é a prova. O flag é
 * suficiente para VARRER (é indexado e barato), nunca para APAGAR.
 *
 * Retorna `'revoked'`, `'resolved'` (re-consentiu) ou `'unknown'` — e `'unknown'` inclui o erro de
 * leitura, que o chamador trata como "pula", jamais como "pode apagar".
 */
export async function confirmStillRevoked(
  supabase: ConsentPruneClient,
  userId: string,
): Promise<'revoked' | 'resolved' | 'unknown'> {
  const { data, error } = await supabase
    .from('consent_log')
    .select('action, created_at, seq')
    .eq('user_id', userId)
    .eq('consent_type', 'health_data')
    .in('action', ['granted', 'revoked'])
    // T013e: `seq` desempata `created_at` (constante dentro de uma txn). Sem ele, dois atos no
    // mesmo instante deixariam a eleição do "último" ao acaso — e o acaso aqui apaga contas.
    .order('seq', { ascending: false })
    .limit(1)

  if (error) {
    logger.error('Reconferência da trilha falhou — candidato PULADO (nunca apagado)', error, { userId })
    return 'unknown'
  }
  const last = Array.isArray(data) ? data[0] : null
  if (!last) return 'unknown'
  return last.action === 'revoked' ? 'revoked' : 'resolved'
}

/**
 * Quantos avisos já foram enviados DEPOIS da revogação corrente.
 *
 * Sem esta contagem o job vira spam: ele roda todo dia, e "days >= 60" é verdade em D+60, D+61,
 * D+62… O titular revogado receberia 30 avisos em vez dos 2 que a política promete — e avisos
 * repetidos ensinam a ignorar exatamente a mensagem que precisa ser lida.
 *
 * `null` = não deu para ler. O chamador PULA: no aviso, o erro para o lado de não incomodar.
 */
export async function countNoticesSince(
  supabase: ConsentPruneClient,
  userId: string,
  revokedAt: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('consent_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('consent_type', 'health_data')
    .eq('action', 'notice_sent')
    .gte('created_at', revokedAt)

  if (error) {
    logger.error('Contagem de avisos falhou — candidato pulado neste run', error, { userId })
    return null
  }
  return count ?? 0
}

/** Grava um ato do CONTROLADOR na trilha via RPC (o Node nunca vê o pepper). */
async function writeControllerEvent(
  supabase: ConsentPruneClient,
  userId: string,
  action: 'notice_sent' | 'pruned',
): Promise<boolean> {
  const { error } = await supabase.rpc('consent_controller_event', {
    p_user_id: userId,
    p_action: action,
    p_consent_type: 'health_data',
  })
  if (error) {
    logger.error('Falha ao gravar ato do controlador na trilha', error, { userId, action })
    return false
  }
  return true
}

/**
 * Busca candidatos pelo flag indexado. Ordem por revogação mais antiga: se o cap cortar, corta
 * quem está mais perto do prazo — nunca uma fatia arbitrária.
 */
async function fetchCandidates(
  supabase: ConsentPruneClient,
  now: Date,
): Promise<{ rows: ConsentPruneCandidate[]; error: unknown }> {
  // Aritmética sobre instante absoluto (epoch), não parsing de 'YYYY-MM-DD': a régua legal é de
  // dias corridos, sem fuso no meio — não é o caso que a R-020 persegue.
  // eslint-disable-next-line no-restricted-syntax
  const cutoff = new Date(now.getTime() - PRUNE_NOTICE_DAYS.d60 * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, consent_revoked_at')
    .not('consent_revoked_at', 'is', null)
    .lte('consent_revoked_at', cutoff)
    .order('consent_revoked_at', { ascending: true })

  if (error) return { rows: [], error }
  return { rows: (data ?? []) as ConsentPruneCandidate[], error: null }
}

type CandidateOutcome = 'pruned' | 'noticed' | 'skipped' | 'silent' | 'aborted' | 'trail_failed'

/** Desfechos que param o run inteiro, e o motivo que vai para o resumo. */
const ABORT_REASONS: Partial<Record<CandidateOutcome, string>> = {
  aborted: 'delete_failed',
  trail_failed: 'trail_write_failed',
}

/** Desfechos que apenas contam. `silent` não aparece aqui de propósito: não é pulo por erro. */
const COUNTERS: Partial<Record<CandidateOutcome, 'pruned' | 'noticed' | 'skipped'>> = {
  pruned: 'pruned',
  noticed: 'noticed',
  skipped: 'skipped',
}

/**
 * Decide e executa o ato do dia para UM candidato.
 *
 * Toda saída que não seja `pruned` é inofensiva — e é assim de propósito: em qualquer dúvida
 * (trilha ilegível, contagem de avisos indisponível, modo dry-run) o candidato é PULADO. Só um
 * caminho apaga, e ele exige: modo armado + prazo vencido + trilha reconfirmando `revoked`.
 */
async function processCandidate({
  row, now, mode, supabase, dispatcher, correlationId,
}: {
  row: ConsentPruneCandidate
  now: Date
  mode: ConsentPruneMode
  supabase: ConsentPruneClient
  dispatcher: ConsentPruneDeps['dispatcher']
  correlationId?: string
}): Promise<CandidateOutcome> {
  const days = daysSince(row.consent_revoked_at, now)
  if (!Number.isFinite(days)) {
    logger.error('consent_revoked_at ilegível — candidato pulado', null, { correlationId, userId: row.user_id })
    return 'skipped'
  }

  const state = await confirmStillRevoked(supabase, row.user_id)
  if (state !== 'revoked') {
    // 'resolved' = re-consentiu (o flag ainda não zerou ou a varredura pegou uma corrida).
    // 'unknown' = não deu para ler a trilha ⇒ pula. Erro de leitura NUNCA autoriza apagar.
    return 'skipped'
  }

  if (days >= PRUNE_DELETE_DAYS) {
    if (mode === 'dry_run') {
      logger.warn('[dry-run] candidato ELEGÍVEL a exclusão — nada foi apagado', { correlationId, userId: row.user_id, days })
      return 'skipped'
    }
    // `pruned` ANTES da exclusão: depois dela não existe mais e-mail em auth.users para derivar o
    // `subject_hash`, e o evento nasceria sem prova de quem era. O `account_deleted` sai de dentro
    // da própria transação de `_delete_user_account_core`.
    //
    // 🔴 E se a trilha NÃO gravar, a exclusão não acontece. A ordem sozinha não bastava: ignorando
    // o retorno, uma RPC fora do ar produziria conta apagada SEM registro de por quê — e o registro
    // é irrecuperável depois (o e-mail que deriva o hash morre com a conta). Excluir sem poder
    // provar a base legal é o oposto do que esta spec existe para entregar. Aborta o run: se a RPC
    // da trilha caiu, ela caiu para todos os candidatos.
    if (!(await writeControllerEvent(supabase, row.user_id, 'pruned'))) {
      logger.error('Trilha não registrou o `pruned` — exclusão CANCELADA e run abortado', null, {
        correlationId, userId: row.user_id,
      })
      return 'trail_failed'
    }

    const { error } = await supabase.rpc('delete_user_account_by_id', { p_user_id: row.user_id })
    if (error) {
      // Aborta o run: exclusão que falha no meio de um lote é sintoma (privilégio, RPC, dado
      // inconsistente), e seguir apagando os próximos seria propagar o desconhecido.
      logger.error('Exclusão falhou — run abortado (demais candidatos intocados)', error, {
        correlationId, userId: row.user_id,
      })
      return 'aborted'
    }
    return 'pruned'
  }

  // Quantos avisos ele já recebeu decide SE há um a enviar hoje: 1º na janela do D+60, 2º na do
  // D+83. Já tendo os dois, nada sai até a data da exclusão.
  const notices = await countNoticesSince(supabase, row.user_id, row.consent_revoked_at)
  if (notices === null) return 'skipped'

  const stage = days >= PRUNE_NOTICE_DAYS.d83 ? 'd83' : 'd60'
  const expectedNotices = stage === 'd83' ? 2 : 1
  if (notices >= expectedNotices) return 'silent'

  const daysLeft = Math.max(PRUNE_DELETE_DAYS - days, 1)
  try {
    // Copy neutra (S8) — ver CONSENT_LIFECYCLE_KINDS: este kind atravessa a supressão por
    // consentimento justamente por não tratar dado de saúde.
    await dispatcher.dispatch({
      userId: row.user_id,
      kind: 'consent_prune_notice',
      data: { stage, daysLeft },
      context: { correlationId },
    })
  } catch (err) {
    logger.error('Aviso de prune falhou (isolado — demais candidatos seguem)', err, {
      correlationId, userId: row.user_id, stage,
    })
    return 'skipped'
  }

  return (await writeControllerEvent(supabase, row.user_id, 'notice_sent')) ? 'noticed' : 'skipped'
}

/**
 * Ciclo do prune. Roda 1×/dia junto do ciclo de notificações.
 *
 * Devolve SEMPRE um resumo (nunca lança): a falha do prune não pode derrubar o job de lembretes
 * que roda ao lado — mesma disciplina de isolamento dos demais jobs de `api/notify.ts`.
 */
export async function runConsentPrune(deps: ConsentPruneDeps): Promise<ConsentPruneResult> {
  const { supabase, dispatcher } = deps
  const env = deps.env ?? process.env
  const now = deps.now ?? getRawNow()
  const correlationId = deps.correlationId
  const cap = deps.cap ?? resolveCap(env.CONSENT_PRUNE_CAP, PRUNE_DEFAULT_CAP)
  const noticeCap = deps.noticeCap ?? resolveCap(env.CONSENT_PRUNE_NOTICE_CAP, PRUNE_DEFAULT_NOTICE_CAP)
  const mode = resolvePruneMode(env)
  const enabled = isPruneEnabled(env)

  const result: ConsentPruneResult = {
    mode, enabled, candidates: 0, noticed: 0, pruned: 0, skipped: 0, aborted: false,
  }

  if (!enabled) {
    logger.warn('Prune DESLIGADO por kill-switch (CONSENT_PRUNE_ENABLED) — nada será enviado nem apagado', { correlationId })
    return result
  }

  const { rows, error } = await fetchCandidates(supabase, now)
  if (error) {
    logger.error('Varredura de candidatos falhou — run abortado sem tocar em nada', error as Error, { correlationId })
    return { ...result, aborted: true, reason: 'candidate_query_failed' }
  }
  result.candidates = rows.length
  if (rows.length === 0) {
    logger.info('Prune: nenhum candidato', { correlationId, mode })
    return result
  }

  // Freio 2 — o cap conta quem seria APAGADO hoje, não quem receberia aviso: é o ato irreversível
  // que precisa de teto. Acima dele, aborta o run inteiro; apagar "os primeiros do cap" seria
  // executar metade de uma decisão que já se sabe suspeita.
  //
  // ⚠️ Mas NÃO em `dry_run`: o dry-run existe para descobrir quantos candidatos existem, e abortar
  // nele fazia a ferramenta recusar justamente a pergunta que a pessoa foi fazer — e no cenário em
  // que a resposta mais importa (população acima do teto). Como o dry-run não apaga nada, o cap
  // vira aviso. Achado ao rodar a 1ª prova do PO-5 em produção.
  const dueForDelete = rows.filter((r) => daysSince(r.consent_revoked_at, now) >= PRUNE_DELETE_DAYS)
  if (dueForDelete.length > cap) {
    if (mode === 'armed') {
      logger.error('Prune ABORTADO — candidatos a exclusão acima do cap (nada foi apagado)', null, {
        correlationId, cap, due: dueForDelete.length,
      })
      return { ...result, aborted: true, reason: 'cap_exceeded' }
    }
    logger.warn('[dry-run] candidatos a exclusão ACIMA do cap — no modo armado este run abortaria', {
      correlationId, cap, due: dueForDelete.length,
    })
  }

  if (rows.length > noticeCap) {
    logger.error('Prune ABORTADO — candidatos acima do teto de avisos (nada foi enviado nem apagado)', null, {
      correlationId, noticeCap, candidatos: rows.length,
    })
    return { ...result, aborted: true, reason: 'notice_cap_exceeded' }
  }

  for (const row of rows) {
    const outcome = await processCandidate({ row, now, mode, supabase, dispatcher, correlationId })
    // Os dois abortos param o run: seguir depois de uma falha destas seria repetir, candidato a
    // candidato, um erro cuja causa já se sabe compartilhada (RPC/privilégio fora do ar).
    const abortReason = ABORT_REASONS[outcome]
    if (abortReason) return { ...result, aborted: true, reason: abortReason }

    // 'silent' = já avisado nesta etapa; não é pulo por erro e não entra em nenhum contador.
    const counter = COUNTERS[outcome]
    if (counter) result[counter] += 1
  }

  logger.info('Prune concluído', { correlationId, ...result })
  return result
}
