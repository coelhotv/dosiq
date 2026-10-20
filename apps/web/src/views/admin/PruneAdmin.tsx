// apps/web/src/views/admin/PruneAdmin.tsx
// "Exclusões pendentes" — o admin decide, conta a conta, o que é apagado (spec 107 US-1/US-2).
//
// 🔴 INV-4: nenhum dado de saúde na tela — só id curto, e-mail mascarado, motivo, datas e avisos.
// 🔴 F-4: não existe "aprovar todas". Apagar exige digitar o início do id; o SERVIDOR confere (S-2).
// 🔴 S-3: e-mail inteiro só por "Copiar e-mail", uma linha por vez, com registro de quem revelou.

import { useState } from 'react'
import { ArrowLeft, AlertTriangle, Mail } from 'lucide-react'
import { parseISO } from '@utils/dateUtils'
import { PRUNE_EMAIL_NOTICE_COPY } from '@dosiq/core'
import Loading from '@shared/components/ui/Loading'
import Button from '@shared/components/ui/Button'
import { usePruneAdminState, prefixMatches } from './usePruneAdminState'
import PruneTextsEditor from './PruneTextsEditor'
import './PruneAdmin.css'

const REASON_LABEL = {
  revoked_90d: 'Retirou a autorização',
  legacy_no_consent: 'Legado sem autorização',
  onboarding_no_consent: 'Cadastro sem autorização',
}
const DECISION_LABEL = { pending: 'Pendente', approved: 'Aprovada', deferred: 'Adiada', void: 'Cancelada' }
const VOID_LABEL = { granted: 'autorizou', self_deleted: 'excluída pelo titular', unknown: 'não verificável' }

const fmt = (iso?: string | null) => (iso ? parseISO(iso).toLocaleDateString('pt-BR') : '—')

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
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
      <p className="prune-admin__meta">
        Avisos: {item.notices_sent.length === 0 ? 'nenhum' : item.notices_sent.map(fmt).join(' · ')}
      </p>

      {item.email_notice_due && (
        <div className="prune-admin__email-due">
          <Mail size={14} /> Aviso {item.email_notice_due === 'd60' ? 'D+60' : 'D+83'} por e-mail devido
          <Button size="sm" variant="secondary" disabled={busy}
            onClick={async () => { const e = await state.reveal(item.queue_id, target, item.email_notice_due); if (e) copyToClipboard(e) }}>
            Copiar e-mail
          </Button>
          <Button size="sm" variant="secondary" disabled={busy}
            onClick={() => state.markNotice(item.queue_id, target, item.email_notice_due)}>
            Marcar enviado
          </Button>
          <p className="prune-admin__email-text" aria-label="Texto do aviso por e-mail">
            <strong>{PRUNE_EMAIL_NOTICE_COPY.subject}</strong>
            {'\n'}
            {PRUNE_EMAIL_NOTICE_COPY.body.replace('{data}', fmt(item.eligible_at))}
          </p>
        </div>
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
      <h2>Onda 2 — e-mail de reengajamento</h2>
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
            <Button size="sm" variant="secondary" disabled={state.busy === key}
              onClick={async () => { const e = await state.reveal(key, target, 'wave2'); if (e) copyToClipboard(e) }}>
              Copiar e-mail
            </Button>
            <Button size="sm" variant="secondary" disabled={state.busy === key} onClick={() => state.markNotice(key, target, 'wave2')}>
              Marcar enviado
            </Button>
          </div>
        )
      })}
    </section>
  )
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
          {items.length === 0 ? (
            <p className="prune-admin__empty">Nenhuma conta na fila. Os avisos e alertas continuam rodando todo dia.</p>
          ) : (
            items.map((item) => <PruneRow key={item.queue_id} item={item} state={state} />)
          )}
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
