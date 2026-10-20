// api/admin/_handlers/prune.ts — fila de exclusão no admin web (spec 107 FR-004, ADR-111).
//
// Resource do router `api/admin.ts` (auth de admin herdada, sem função nova — R-090). Toda trava
// mora AQUI, no servidor; a tela é conveniência (mesmo princípio do versionGate):
//   S-1  approve só por `queue_id`; o `user_id` é lido da linha. Corpo com `user_id` ⇒ 400.
//   S-2  o prefixo digitado (≥ 6) é conferido contra o `user_id` da linha ⇒ 422.
//   S-1  só pending/deferred, só elegível em ≤ 7 dias ⇒ 409.
//   FR-014 só com os 2 avisos (D+60/D+83) ou o reaviso no rastro ⇒ 409. Quem perdeu os avisos
//        recebe UM reaviso por e-mail e o prazo passa a ser a marcação + 7 dias.
//   PO-8 legado só com kill switch ≥ 0.34 ativo nas duas plataformas E e-mail da onda 2 ⇒ 409.
//   S-3  `list` devolve e-mail MASCARADO; o inteiro sai só por `reveal`, 1 linha, com auditoria.
//   S-11 marco `wave2` só para conta do conjunto que o servidor calcula; 1× por conta ⇒ 409.
//   S-5  texto da trava validado pelo schema do core (texto puro, `{data}` 1×).
//   INV-4 nenhuma coluna de saúde é lida aqui — nem para "contexto".

import { consentCopyBodySchema } from '@dosiq/core/schemas'
import {
  addDays,
  alertState,
  isApprovable,
  d83Start,
  legacyGateOpen,
  maskEmail,
  pruneSection,
  nextMilestone,
  APPROVE_PREFIX_MIN,
  ONBOARDING_RULE_START,
  PRUNE_CLOCK_DAYS,
  REAVISO_GRACE_DAYS,
  WAVE2_GRACE_DAYS,
} from '../../_ops/pruneRules.js'

const LIVE = ['pending', 'approved', 'deferred']
const QUEUE_COLUMNS = 'id, user_id, reason, scheduled_at, eligible_at, decision, decided_at, decided_by, note, reevaluate_at, executed_at, void_reason, created_at'
const NOTE_MAX = 500
const HISTORY_DAYS = 90

const actor = (adminUserId: string) => `admin:${adminUserId}`
// eslint-disable-next-line no-restricted-syntax -- instante absoluto (R-020 não se aplica)
const nowDate = () => new Date()

async function audit(supabase, row: { queue_id?: string | null; user_id: string; action: string; detail?: object }, adminUserId: string) {
  const { error } = await supabase.from('prune_queue_audit').insert({
    queue_id: row.queue_id ?? null, user_id: row.user_id, action: row.action, actor: actor(adminUserId), detail: row.detail ?? {},
  })
  if (error) throw new Error(`auditoria falhou: ${error.message}`)
}

async function emailsFor(supabase, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase.rpc('prune_account_emails', { p_user_ids: userIds })
  if (error) throw new Error(`prune_account_emails: ${error.message}`)
  return new Map((data ?? []).map((r) => [r.user_id, r.email]))
}

async function noticesByUser(supabase, userIds: string[]): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('consent_log')
    .select('user_id, created_at')
    .in('user_id', userIds)
    .eq('consent_type', 'health_data')
    .eq('action', 'notice_sent')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`consent_log: ${error.message}`)
  const map = new Map<string, string[]>()
  for (const n of data ?? []) map.set(n.user_id, [...(map.get(n.user_id) ?? []), n.created_at])
  return map
}

/** Contas legado ainda sem e-mail da onda 2 e fora da fila (G-3 / S-11). Calculado SÓ aqui. */
async function wave2Candidates(supabase): Promise<Array<{ user_id: string; created_at: string }>> {
  const [accounts, live, marks] = await Promise.all([
    supabase.rpc('prune_unconsented_accounts'),
    supabase.from('prune_queue').select('user_id').in('decision', LIVE).is('executed_at', null),
    supabase.from('prune_queue_audit').select('user_id').eq('action', 'mark_notice').eq('detail->>milestone', 'wave2'),
  ])
  for (const r of [accounts, live, marks]) if (r.error) throw new Error(`wave2: ${r.error.message}`)
  const exclude = new Set([...(live.data ?? []), ...(marks.data ?? [])].map((r) => r.user_id))
  return (accounts.data ?? []).filter((a) => a.created_at < ONBOARDING_RULE_START && !exclude.has(a.user_id))
}

async function legacyRequirements(supabase, userId: string): Promise<{ gate: boolean; wave2: boolean }> {
  const [gates, marks] = await Promise.all([
    supabase.from('app_version_gate').select('platform, min_supported_version, is_active'),
    supabase.from('prune_queue_audit').select('id').eq('user_id', userId).eq('action', 'mark_notice').eq('detail->>milestone', 'wave2'),
  ])
  return {
    gate: gates.error ? false : legacyGateOpen(gates.data),
    wave2: marks.error ? false : (marks.data ?? []).length > 0,
  }
}

/** Linhas da fila que já receberam o reaviso (marco `reaviso` na auditoria, 1× por linha). */
async function reavisoQueues(supabase, queueIds: string[]): Promise<Set<string>> {
  if (queueIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('prune_queue_audit')
    .select('queue_id')
    .in('queue_id', queueIds)
    .eq('action', 'mark_notice')
    .eq('detail->>milestone', 'reaviso')
  if (error) throw new Error(`auditoria do reaviso: ${error.message}`)
  return new Set((data ?? []).map((r) => r.queue_id))
}

/** Kill switch 0.34 ativo nas duas plataformas? Erro de leitura ⇒ false (na dúvida, bloqueia). */
async function legacyGateIsOpen(supabase): Promise<boolean> {
  const gates = await supabase.from('app_version_gate').select('platform, min_supported_version, is_active')
  return gates.error ? false : legacyGateOpen(gates.data)
}

/** Avisos desde o início do relógio e desde o D+83 (o D+83 sozinho basta — `noticesComplete`). */
function noticeCounts(dates: string[] | undefined, scheduledAt: string) {
  const since = (dates ?? []).filter((at) => at >= scheduledAt)
  const fromD83 = d83Start(scheduledAt)
  return { sentSinceStart: since.length, sentSinceD83: since.filter((at) => at >= fromD83).length }
}

/** Seção da linha com o rastro lido do banco — a MESMA conta da lista e das travas. */
async function sectionOf(supabase, row, now: Date) {
  const [notices, reaviso, gate] = await Promise.all([
    noticesByUser(supabase, [row.user_id]),
    reavisoQueues(supabase, [row.id]),
    row.reason === 'legacy_no_consent' ? legacyGateIsOpen(supabase) : Promise.resolve(true),
  ])
  return pruneSection(row, { ...noticeCounts(notices.get(row.user_id), row.scheduled_at), hasReaviso: reaviso.has(row.id), legacyGate: gate }, now)
}

async function loadRow(supabase, queueId: unknown) {
  if (typeof queueId !== 'string' || queueId.length === 0) return { row: null, status: 400, error: 'queue_id obrigatório' }
  const { data, error } = await supabase.from('prune_queue').select(QUEUE_COLUMNS).eq('id', queueId).maybeSingle()
  if (error) return { row: null, status: 500, error: 'Falha ao ler a fila' }
  if (!data) return { row: null, status: 404, error: 'Linha não encontrada' }
  return { row: data, status: 200, error: null }
}

// ─── GET list ───────────────────────────────────────────────────────────────────────────────
export async function handleListPrune(req, res, supabase) {
  try {
    const now = nowDate()
    const tab = req.query?.tab === 'history' ? 'history' : 'pending'
    // eslint-disable-next-line no-restricted-syntax -- instante absoluto
    const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString()

    const query = supabase.from('prune_queue').select(QUEUE_COLUMNS).order('eligible_at', { ascending: true })
    const { data: rows, error } = tab === 'pending'
      ? await query.in('decision', LIVE).is('executed_at', null)
      : await query.gte('created_at', since)
    if (error) return res.status(500).json({ error: 'Falha ao ler a fila' })

    const visible = tab === 'pending' ? rows ?? [] : (rows ?? []).filter((r) => r.executed_at || r.decision === 'void')
    const ids = visible.map((r) => r.user_id)
    const [emails, notices, reaviso, gate] = await Promise.all([
      emailsFor(supabase, ids),
      noticesByUser(supabase, ids),
      reavisoQueues(supabase, visible.map((r) => r.id)),
      visible.some((r) => r.reason === 'legacy_no_consent') ? legacyGateIsOpen(supabase) : Promise.resolve(true),
    ])

    const items = visible.map((r) => {
      const sent = (notices.get(r.user_id) ?? []).filter((at) => at >= r.scheduled_at)
      const hasReaviso = reaviso.has(r.id)
      const where = pruneSection(r, { ...noticeCounts(sent, r.scheduled_at), hasReaviso, legacyGate: gate }, now)
      return {
        queue_id: r.id,
        short_id: r.user_id.slice(0, 8),
        email_masked: maskEmail(emails.get(r.user_id)),
        reason: r.reason,
        scheduled_at: r.scheduled_at,
        eligible_at: r.eligible_at,
        decision: r.decision,
        decided_at: r.decided_at ?? null,
        note: r.note ?? null,
        reevaluate_at: r.reevaluate_at ?? null,
        executed_at: r.executed_at ?? null,
        void_reason: r.void_reason ?? null,
        notices_sent: sent,
        has_reaviso: hasReaviso,
        section: where.section,
        block: where.block,
        email_notice_due: tab === 'pending' ? where.notice_due : null,
        // Data que vai no texto do e-mail: no reaviso, o prazo novo (hoje + 7); nos demais, o atual.
        email_deadline: where.notice_due === 'reaviso' ? addDays(now.toISOString(), REAVISO_GRACE_DAYS) : r.eligible_at,
        approvable: where.section === 'decide',
        next_milestone: where.section === 'counting' ? nextMilestone(r, now) : null,
        ...alertState(r, now),
      }
    })

    if (tab === 'history') return res.status(200).json({ data: items })

    const executed30 = await supabase
      .from('prune_queue')
      .select('id', { count: 'exact', head: true })
      // eslint-disable-next-line no-restricted-syntax -- instante absoluto
      .gte('executed_at', new Date(now.getTime() - 30 * 86_400_000).toISOString())
    const wave2 = await wave2Candidates(supabase)
    const wave2Emails = await emailsFor(supabase, wave2.map((w) => w.user_id))

    return res.status(200).json({
      data: items,
      summary: {
        approved_waiting: items.filter((i) => i.decision === 'approved').length,
        by_section: Object.fromEntries(
          ['email', 'decide', 'blocked', 'approved', 'counting'].map((k) => [k, items.filter((i) => i.section === k).length]),
        ),
        executed_30d: executed30.count ?? 0,
      },
      wave2: wave2.map((w) => ({
        user_id: w.user_id,
        short_id: w.user_id.slice(0, 8),
        email_masked: maskEmail(wave2Emails.get(w.user_id)),
        created_at: w.created_at,
        // Prazo que vai no e-mail da onda 2: entra na fila 7 d após a marcação, apaga 90 d depois.
        email_deadline: addDays(now.toISOString(), WAVE2_GRACE_DAYS + PRUNE_CLOCK_DAYS),
      })),
    })
  } catch (err) {
    console.error('[Prune API] list:', err instanceof Error ? err.message : 'erro')
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── POST approve ───────────────────────────────────────────────────────────────────────────
export async function handleApprovePrune(req, res, supabase, adminUserId: string) {
  try {
    const body = req.body ?? {}
    if (body.user_id !== undefined || body.queue_id === undefined) {
      return res.status(400).json({ error: 'Aprovação só por queue_id (S-1)' })
    }
    const { row, status, error } = await loadRow(supabase, body.queue_id)
    if (!row) return res.status(status).json({ error })

    const now = nowDate()
    if (!isApprovable(row, now)) {
      return res.status(409).json({ error: 'Linha não aprovável (estado ou fora da janela de 7 dias)' })
    }
    const prefix = typeof body.prefix === 'string' ? body.prefix.trim().toLowerCase() : ''
    if (prefix.length < APPROVE_PREFIX_MIN || !row.user_id.toLowerCase().startsWith(prefix)) {
      return res.status(422).json({ error: `Confirmação inválida: digite os ${APPROVE_PREFIX_MIN}+ primeiros caracteres do id` })
    }
    const where = await sectionOf(supabase, row, now)
    if (where.block === 'missing_notices' || where.section === 'email') {
      return res.status(409).json({ error: 'Titular sem os 2 avisos da política: envie o reaviso antes (FR-014)' })
    }
    if (row.reason === 'legacy_no_consent') {
      const req2 = await legacyRequirements(supabase, row.user_id)
      if (!req2.gate) return res.status(409).json({ error: 'Kill switch de versão mínima 0.34 inativo (INV-6)' })
      if (!req2.wave2) return res.status(409).json({ error: 'E-mail da onda 2 não consta no rastro (INV-6)' })
    }

    const decidedAt = now.toISOString()
    const { data: updated, error: upErr } = await supabase
      .from('prune_queue')
      .update({ decision: 'approved', decided_at: decidedAt, decided_by: adminUserId })
      .eq('id', row.id)
      .in('decision', ['pending', 'deferred'])
      .is('executed_at', null)
      .select('id')
    if (upErr) return res.status(500).json({ error: 'Falha ao aprovar' })
    if (!Array.isArray(updated) || updated.length !== 1) return res.status(409).json({ error: 'Linha mudou de estado' })

    await audit(supabase, {
      queue_id: row.id, user_id: row.user_id, action: 'approve',
      detail: { reason: row.reason, prefix_checked: prefix.length, decided_at: decidedAt },
    }, adminUserId)
    return res.status(200).json({ data: { queue_id: row.id, decision: 'approved', decided_at: decidedAt } })
  } catch (err) {
    console.error('[Prune API] approve:', err instanceof Error ? err.message : 'erro')
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── POST defer ─────────────────────────────────────────────────────────────────────────────
export async function handleDeferPrune(req, res, supabase, adminUserId: string) {
  try {
    const body = req.body ?? {}
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (note.length === 0 || note.length > NOTE_MAX) {
      return res.status(400).json({ error: `Nota obrigatória (1–${NOTE_MAX} caracteres)` })
    }
    const reevaluate = typeof body.reevaluate_at === 'string' ? Date.parse(body.reevaluate_at) : Number.NaN
    const now = nowDate()
    if (!Number.isFinite(reevaluate) || reevaluate <= now.getTime()) {
      return res.status(400).json({ error: 'reevaluate_at precisa ser uma data futura' })
    }
    const { row, status, error } = await loadRow(supabase, body.queue_id)
    if (!row) return res.status(status).json({ error })

    // eslint-disable-next-line no-restricted-syntax -- instante absoluto vindo de Date.parse
    const reevaluateAt = new Date(reevaluate).toISOString()
    const { data: updated, error: upErr } = await supabase
      .from('prune_queue')
      .update({ decision: 'deferred', decided_at: now.toISOString(), decided_by: adminUserId, note, reevaluate_at: reevaluateAt })
      .eq('id', row.id)
      .in('decision', ['pending', 'deferred'])
      .is('executed_at', null)
      .select('id')
    if (upErr) return res.status(500).json({ error: 'Falha ao adiar' })
    if (!Array.isArray(updated) || updated.length !== 1) return res.status(409).json({ error: 'Linha não pode ser adiada' })

    await audit(supabase, { queue_id: row.id, user_id: row.user_id, action: 'defer', detail: { reevaluate_at: reevaluateAt } }, adminUserId)
    return res.status(200).json({ data: { queue_id: row.id, decision: 'deferred', reevaluate_at: reevaluateAt } })
  } catch (err) {
    console.error('[Prune API] defer:', err instanceof Error ? err.message : 'erro')
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/** Resolve o alvo de reveal/mark: linha viva da fila OU conta do conjunto da onda 2. */
async function resolveTarget(supabase, body, milestone: string) {
  if (milestone === 'wave2') {
    if (typeof body.user_id !== 'string') return { error: 'user_id obrigatório para a onda 2', status: 400 }
    const candidates = await wave2Candidates(supabase)
    if (!candidates.some((c) => c.user_id === body.user_id)) {
      return { error: 'Conta fora do conjunto da onda 2 (S-11)', status: 409 }
    }
    return { userId: body.user_id as string, queueId: null, row: null }
  }
  if (milestone !== 'd60' && milestone !== 'd83' && milestone !== 'reaviso') return { error: 'milestone inválido', status: 400 }
  const { row, status, error } = await loadRow(supabase, body.queue_id)
  if (!row) return { error, status }
  if (!LIVE.includes(row.decision) || row.executed_at) return { error: 'Linha não está viva', status: 409 }
  return { userId: row.user_id as string, queueId: row.id as string, row }
}

// ─── POST reveal ────────────────────────────────────────────────────────────────────────────
export async function handleRevealPrune(req, res, supabase, adminUserId: string) {
  try {
    const body = req.body ?? {}
    const target = await resolveTarget(supabase, body, body.milestone)
    if ('error' in target) return res.status(target.status).json({ error: target.error })
    const emails = await emailsFor(supabase, [target.userId])
    const email = emails.get(target.userId)
    if (!email) return res.status(404).json({ error: 'Conta não existe mais' })
    await audit(supabase, {
      queue_id: target.queueId, user_id: target.userId, action: 'reveal_email', detail: { milestone: body.milestone },
    }, adminUserId)
    return res.status(200).json({ data: { email } })
  } catch (err) {
    console.error('[Prune API] reveal:', err instanceof Error ? err.message : 'erro')
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── POST mark_notice ───────────────────────────────────────────────────────────────────────
export async function handleMarkNoticePrune(req, res, supabase, adminUserId: string) {
  try {
    const body = req.body ?? {}
    const target = await resolveTarget(supabase, body, body.milestone)
    if ('error' in target) return res.status(target.status).json({ error: target.error })

    const now = nowDate()
    let newEligibleAt: string | null = null
    if (target.row && body.milestone === 'reaviso') {
      // Reaviso: só para linha bloqueada por falta de aviso, e 1× por linha (FR-014).
      const where = await sectionOf(supabase, target.row, now)
      if (where.block !== 'missing_notices') return res.status(409).json({ error: 'Reaviso não devido para esta linha' })
      newEligibleAt = addDays(now.toISOString(), REAVISO_GRACE_DAYS)
    } else if (target.row) {
      // D+60/D+83: só se o marco é o devido HOJE pela mesma regra da tela (1× por marco).
      const where = await sectionOf(supabase, target.row, now)
      if (where.notice_due !== body.milestone) return res.status(409).json({ error: 'Aviso não devido para este marco' })
    }

    const { error } = await supabase.rpc('consent_controller_event', {
      p_user_id: target.userId, p_action: 'notice_sent', p_consent_type: 'health_data',
    })
    if (error) return res.status(500).json({ error: 'Falha ao registrar o aviso na trilha' })
    if (newEligibleAt) {
      // O prazo recomeça: aprovar continua possível já (janela de 7 dias), mas o executor só
      // apaga a partir de `eligible_at` — o titular tem os 7 dias prometidos para responder.
      const { error: upErr } = await supabase
        .from('prune_queue').update({ eligible_at: newEligibleAt }).eq('id', target.queueId).is('executed_at', null)
      if (upErr) return res.status(500).json({ error: 'Aviso registrado, mas o prazo não foi atualizado' })
    }
    await audit(supabase, {
      queue_id: target.queueId, user_id: target.userId, action: 'mark_notice',
      detail: newEligibleAt ? { milestone: body.milestone, eligible_at: newEligibleAt } : { milestone: body.milestone },
    }, adminUserId)
    return res.status(200).json({ data: { milestone: body.milestone, eligible_at: newEligibleAt } })
  } catch (err) {
    console.error('[Prune API] mark_notice:', err instanceof Error ? err.message : 'erro')
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── GET/PUT texts ──────────────────────────────────────────────────────────────────────────
const COPY_KEY = 'never_consented_deadline'

export async function handleGetPruneTexts(req, res, supabase) {
  const { data, error } = await supabase.from('consent_copy').select('key, body, version, updated_at').eq('key', COPY_KEY).maybeSingle()
  if (error) return res.status(500).json({ error: 'Falha ao ler o texto' })
  return res.status(200).json({ data })
}

export async function handleUpdatePruneTexts(req, res, supabase, adminUserId: string) {
  try {
    const parsed = consentCopyBodySchema.safeParse(req.body?.body)
    if (parsed.success === false) {
      return res.status(400).json({ error: 'Texto inválido', details: parsed.error.issues.map((i) => i.message) })
    }
    const { data: current, error } = await supabase
      .from('consent_copy').select('key, body, version, updated_by, updated_at').eq('key', COPY_KEY).single()
    if (error || !current) return res.status(500).json({ error: 'Falha ao ler o texto atual' })

    // Histórico guarda a versão ANTERIOR; a linha viva guarda a nova com quem/quando (PO-SEC-3).
    const hist = await supabase.from('consent_copy_history').insert({
      key: current.key, body: current.body, version: current.version, updated_by: current.updated_by, updated_at: current.updated_at,
    })
    if (hist.error) return res.status(500).json({ error: 'Falha ao registrar histórico' })

    const { data, error: upErr } = await supabase
      .from('consent_copy')
      .update({ body: parsed.data, version: current.version + 1, updated_by: adminUserId, updated_at: nowDate().toISOString() })
      .eq('key', COPY_KEY)
      .eq('version', current.version)
      .select('key, body, version, updated_at')
    if (upErr) return res.status(400).json({ error: 'Texto recusado pelo banco' })
    if (!Array.isArray(data) || data.length !== 1) return res.status(409).json({ error: 'Texto mudou durante a edição' })
    return res.status(200).json({ data: data[0] })
  } catch (err) {
    console.error('[Prune API] texts:', err instanceof Error ? err.message : 'erro')
    return res.status(500).json({ error: 'Internal server error' })
  }
}
