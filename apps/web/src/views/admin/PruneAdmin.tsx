// apps/web/src/views/admin/PruneAdmin.tsx
// "Exclusões pendentes" — o admin decide, conta a conta, o que é apagado (spec 107 US-1/US-2).
//
// 🔴 INV-4: nenhum dado de saúde na tela — só id curto, e-mail mascarado, motivo, datas e avisos.
// 🔴 F-4: não existe "aprovar todas". Apagar exige digitar o início do id; o SERVIDOR confere (S-2).
// 🔴 S-3: e-mail inteiro só por "Copiar e-mail", uma linha por vez, com registro de quem revelou.
// FR-014: a lista é organizada pela PRÓXIMA AÇÃO do admin (seção calculada no servidor), não pelo
// estado — cada conta aparece numa seção só, com um botão principal.

import { useState } from 'react'
import { ArrowLeft, AlertTriangle, Mail } from 'lucide-react'
import { parseISO } from '@utils/dateUtils'
import { buildPruneEmail, pruneEmailVariant } from '@dosiq/core'
import Loading from '@shared/components/ui/Loading'
import Button from '@shared/components/ui/Button'
import { usePruneAdminState, prefixMatches } from './usePruneAdminState'
import PruneTextsEditor from './PruneTextsEditor'
import './PruneAdmin.css'

const REASON_LABEL = {
  revoked_90d: 'Retirou a autorização',
  legacy_no_consent: 'Legado sem autorização',
  onboarding_no_consent: 'Cadastro sem autorização',
  unconfirmed_signup: 'Cadastro não confirmado (sem aviso: e-mail não verificado)',
}
const DECISION_LABEL = { pending: 'Pendente', approved: 'Aprovada', deferred: 'Adiada', void: 'Cancelada' }
const VOID_LABEL = { granted: 'autorizou', confirmed: 'confirmou o cadastro', self_deleted: 'excluída pelo titular', unknown: 'não verificável' }

const NOTICE_LABEL = { d60: 'Aviso D+60 por e-mail', d83: 'Aviso D+83 por e-mail', reaviso: 'Reaviso por e-mail (titular perdeu os avisos)' }
const BLOCK_LABEL = {
  missing_notices: 'Sem os 2 avisos da política: envie o reaviso. O prazo passa a ser 7 dias após a marcação.',
  legacy_gate: 'Legado: aguarda o kill switch 0.34 ativo nas duas plataformas.',
}
const SECTIONS = [
  { key: 'email', title: '📧 Enviar e-mail hoje', hint: 'Copie o e-mail, envie pelo Gmail com o texto pronto e marque como enviado.' },
  { key: 'decide', title: '✅ Pronto para decidir', hint: 'No prazo e com os avisos em dia: apagar ou adiar.' },
  { key: 'blocked', title: '⛔ Bloqueado', hint: 'Não pode ser apagado ainda. A linha diz o que falta.' },
  { key: 'approved', title: '⏳ Aprovadas — executam às 10:00', hint: 'Nada a fazer. Se o titular autorizar antes, a linha é cancelada sozinha.' },
]

const fmt = (iso?: string | null) => (iso ? parseISO(iso).toLocaleDateString('pt-BR') : '—')

function noticeSummary(item) {
  const sent = item.notices_sent ?? []
  // Reaviso substitui os avisos perdidos: "1 de 2" faria parecer que ainda falta um (smoke 107).
  if (item.has_reaviso) return `Avisos: reaviso enviado em ${fmt(sent.at(-1))} · prazo ${fmt(item.eligible_at)}`
  const dates = sent.length === 0 ? '' : ` (${sent.map(fmt).join(' · ')})`
  return `Avisos: ${sent.length} de 2${dates}`
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

/**
 * Copia a mensagem SÓ como `text/html` (pedido do PO): o Gmail cola com o CSS inline e os links.
 * Duas tentativas anteriores chegaram como texto puro no smoke (ClipboardItem HTML+texto, e cópia
 * de seleção de um elemento escondido). Aqui o handler do evento `copy` grava o conteúdo
 * explicitamente — o navegador não decide nada sobre o que vai para a área de transferência.
 */
function copyHtmlOnly(htmlBody: string): boolean {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData('text/html', htmlBody)
    e.preventDefault()
  }
  document.addEventListener('copy', onCopy)
  try {
    return document.execCommand('copy')
  } finally {
    document.removeEventListener('copy', onCopy)
  }
}

/** Bloco do e-mail a enviar: assunto, prévia e as 3 cópias (endereço, assunto, mensagem formatada). */
function EmailNotice({ label, variant, deadline, busy, onRevealEmail, onMark }) {
  const email = buildPruneEmail(variant, fmt(deadline))
  return (
    <div className="prune-admin__email-due">
      <Mail size={14} /> {label}
      <Button size="sm" variant="secondary" disabled={busy} onClick={onRevealEmail}>Copiar e-mail</Button>
      <Button size="sm" variant="secondary" onClick={() => copyToClipboard(email.subject)}>Copiar assunto</Button>
      <Button size="sm" variant="secondary" onClick={() => copyHtmlOnly(email.html)}>Copiar mensagem formatada</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={onMark}>Marcar enviado</Button>
      <details className="prune-admin__email-preview">
        <summary>Assunto: {email.subject}</summary>
        {/* Prévia com o visual real; sandbox sem scripts. O texto puro fica só para leitura/teste. */}
        <iframe title="Prévia do e-mail" sandbox="" srcDoc={email.html} className="prune-admin__email-frame" />
        <p className="prune-admin__email-text" aria-label="Texto do aviso por e-mail" hidden>{email.text}</p>
      </details>
    </div>
  )
}

function PruneRow({ item, state }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'defer'>('idle')
  const [prefix, setPrefix] = useState('')
  const [note, setNote] = useState('')
  const [reevaluate, setReevaluate] = useState('')
  const busy = state.busy === item.queue_id
  const target = { queueId: item.queue_id }

  return (
    <article className={`prune-admin__row ${item.red ? 'prune-admin__row--red' : ''}`}>
      <div className="prune-admin__row-head">
        <code>{item.short_id}…</code>
        <span>{state.revealed[item.queue_id] ?? item.email_masked}</span>
        <span className="prune-admin__when">
          {item.red && <AlertTriangle size={14} />} elegível {fmt(item.eligible_at)}
          {item.overdue && ' · vencida'}
        </span>
      </div>
      <p className="prune-admin__meta">
        {REASON_LABEL[item.reason]} · relógio desde {fmt(item.scheduled_at)} · {DECISION_LABEL[item.decision]}
        {item.decision === 'deferred' && ` até ${fmt(item.reevaluate_at)} (${item.note})`}
      </p>
      <p className="prune-admin__meta">{noticeSummary(item)}</p>
      {item.block && <p className="prune-admin__block">{BLOCK_LABEL[item.block]}</p>}
      {item.next_milestone && (
        <p className="prune-admin__meta">
          Próximo marco: {item.next_milestone.label} em {fmt(item.next_milestone.at)}
        </p>
      )}

      {item.email_notice_due && (
        <EmailNotice
          label={NOTICE_LABEL[item.email_notice_due]}
          variant={pruneEmailVariant(item.reason, item.email_notice_due)}
          deadline={item.email_deadline}
          busy={busy}
          onRevealEmail={async () => { const e = await state.reveal(item.queue_id, target, item.email_notice_due); if (e) copyToClipboard(e) }}
          onMark={() => state.markNotice(item.queue_id, target, item.email_notice_due)}
        />
      )}

      {item.decision !== 'approved' && mode === 'idle' && (
        <div className="prune-admin__actions">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMode('defer')}>Adiar…</Button>
          {item.approvable && (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setMode('approve')}>Apagar esta conta</Button>
          )}
        </div>
      )}

      {mode === 'approve' && (
        <div className="prune-admin__confirm">
          <label htmlFor={`prefix-${item.queue_id}`}>
            Para confirmar, digite os primeiros caracteres do id (<code>{item.short_id}</code>, mínimo 6):
          </label>
          <input id={`prefix-${item.queue_id}`} value={prefix} onChange={(e) => setPrefix(e.target.value)} autoComplete="off" />
          <Button size="sm" variant="danger" disabled={busy || !prefixMatches(prefix, item.short_id)}
            onClick={async () => { if (await state.approve(item.queue_id, prefix)) setMode('idle') }}>
            Confirmar exclusão
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setMode('idle'); setPrefix('') }}>Cancelar</Button>
        </div>
      )}

      {mode === 'defer' && (
        <div className="prune-admin__confirm">
          <label htmlFor={`note-${item.queue_id}`}>Motivo (obrigatório)</label>
          <input id={`note-${item.queue_id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <label htmlFor={`date-${item.queue_id}`}>Reavaliar em</label>
          <input id={`date-${item.queue_id}`} type="date" value={reevaluate} onChange={(e) => setReevaluate(e.target.value)} />
          <Button size="sm" variant="primary" disabled={busy || !note.trim() || !reevaluate}
            onClick={async () => { if (await state.defer(item.queue_id, note, `${reevaluate}T12:00:00-03:00`)) setMode('idle') }}>
            Adiar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMode('idle')}>Cancelar</Button>
        </div>
      )}
    </article>
  )
}

function Wave2List({ state }) {
  if (state.wave2.length === 0) return null
  return (
    <section className="prune-admin__wave2">
      <h2>📨 Onda 2 — legado <span className="prune-admin__count">{state.wave2.length}</span></h2>
      <p className="prune-admin__hint">
        Contas antigas sem autorização. Envie o e-mail e marque: a conta entra na fila 7 dias depois, sem retorno.
      </p>
      {state.wave2.map((w) => {
        const key = `w2-${w.user_id}`
        const target = { userId: w.user_id }
        return (
          <div key={w.user_id} className="prune-admin__wave2-row">
            <code>{w.short_id}…</code>
            <span>{state.revealed[key] ?? w.email_masked}</span>
            <EmailNotice
              label="E-mail da onda 2"
              variant="never_consented"
              deadline={w.email_deadline}
              busy={state.busy === key}
              onRevealEmail={async () => { const e = await state.reveal(key, target, 'wave2'); if (e) copyToClipboard(e) }}
              onMark={() => state.markNotice(key, target, 'wave2')}
            />
          </div>
        )
      })}
    </section>
  )
}

function PendingSections({ state }) {
  const { items } = state
  const counting = items.filter((i) => i.section === 'counting')
  if (items.length === 0) {
    return <p className="prune-admin__empty">Nenhuma conta na fila. Os avisos e alertas continuam rodando todo dia.</p>
  }
  return (
    <>
      {SECTIONS.map(({ key, title, hint }) => {
        const rows = items.filter((i) => i.section === key)
        if (rows.length === 0) return null
        return (
          <section key={key} className={`prune-admin__section prune-admin__section--${key}`}>
            <h2>{title} <span className="prune-admin__count">{rows.length}</span></h2>
            <p className="prune-admin__hint">{hint}</p>
            {rows.map((item) => <PruneRow key={item.queue_id} item={item} state={state} />)}
          </section>
        )
      })}
      {counting.length > 0 && (
        <details className="prune-admin__section prune-admin__section--counting">
          <summary>🕒 Em contagem <span className="prune-admin__count">{counting.length}</span> — nada a fazer hoje</summary>
          {counting.map((item) => <PruneRow key={item.queue_id} item={item} state={state} />)}
        </details>
      )}
    </>
  )
}

function SectionCounters({ summary, wave2Count }) {
  const by = summary?.by_section ?? {}
  const parts = [
    by.email ? `${by.email} e-mail(s)` : null,
    by.decide ? `${by.decide} para decidir` : null,
    by.blocked ? `${by.blocked} bloqueada(s)` : null,
    by.approved ? `${by.approved} aprovada(s)` : null,
    wave2Count ? `${wave2Count} na onda 2` : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return <p className="prune-admin__counters">{parts.join(' · ')}</p>
}

function HistoryRow({ item }) {
  return (
    <article className="prune-admin__row">
      <div className="prune-admin__row-head">
        <code>{item.short_id}…</code>
        <span>{REASON_LABEL[item.reason]}</span>
        <span className="prune-admin__when">
          {item.executed_at ? `apagada em ${fmt(item.executed_at)}` : `cancelada: ${VOID_LABEL[item.void_reason] ?? item.void_reason}`}
        </span>
      </div>
      {item.decided_at && <p className="prune-admin__meta">Decidida em {fmt(item.decided_at)}</p>}
    </article>
  )
}

export default function PruneAdmin({ onBack }) {
  const state = usePruneAdminState()
  const { tab, setTab, items, summary, isLoading, error, message } = state

  return (
    <div className="prune-admin">
      <header className="prune-admin__header">
        <div>
          <h1>Exclusões pendentes</h1>
          <p className="prune-admin__hint">Nada é apagado sem a sua aprovação, conta a conta.</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="prune-admin__back-btn" type="button">
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
      </header>

      <div className="prune-admin__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'pending'} onClick={() => setTab('pending')}>Pendentes</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Histórico</button>
      </div>

      {message && <p className={`prune-admin__message prune-admin__message--${message.type}`}>{message.text}</p>}
      {error && (
        <div className="prune-admin__message prune-admin__message--error">
          Falha ao carregar: {error} <Button size="sm" variant="secondary" onClick={state.reload}>Tentar de novo</Button>
        </div>
      )}
      {isLoading && <Loading text="Carregando fila..." />}

      {!isLoading && !error && tab === 'pending' && (
        <>
          <SectionCounters summary={summary} wave2Count={state.wave2.length} />
          <PendingSections state={state} />
          {summary && (
            <p className="prune-admin__summary">
              Aprovadas aguardando execução (próx. 10:00): {summary.approved_waiting} · Executadas (30d): {summary.executed_30d}
            </p>
          )}
          <Wave2List state={state} />
          <PruneTextsEditor />
        </>
      )}

      {!isLoading && !error && tab === 'history' && (
        items.length === 0
          ? <p className="prune-admin__empty">Nenhuma execução ou cancelamento nos últimos 90 dias.</p>
          : items.map((item) => <HistoryRow key={item.queue_id} item={item} />)
      )}
    </div>
  )
}
