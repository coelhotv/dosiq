// StockSection — espelho web do toggle "Controle de estoque" (spec 044, T013/T014/T015/T016).
//
// Mesma preferência global do mobile (backend), mesmo serviço do core. Congelar NÃO deleta:
// o modal de confirmação usa cadeado e botão primário comum — não é ação `danger`.
// Fechar o modal de reconciliação NÃO ativa o estoque.

import { useCallback, useEffect, useState } from 'react'
import { Package, Lock } from 'lucide-react'
import Modal from '@shared/components/ui/Modal'
import { parseISO, formatDatePtBR } from '@dosiq/core'
import { useStockToggle } from '@features/settings/hooks/useStockToggle'
import InitialBalanceForm from '@features/stock/components/InitialBalanceForm'
import './StockSection.css'

/** Fechamento inibido enquanto a escrita está em voo (ver os modais abaixo). */
const noop = () => {}

/** Subtítulo por estado (§5 das decisões de design do 044). */
function stockSubtitle(enabled, neverHadStock) {
  if (enabled) return 'Saldos e avisos de reposição ativos.'
  if (neverHadStock) return 'Avisa quando o remédio estiver acabando.'
  return 'Desligado — só lembretes e registro de doses.'
}

/**
 * Data do congelamento em PT-BR; carimbo ausente/inválido → null (rótulo cai no genérico).
 * Mesma função do mobile (`formatDatePtBR`) para que a copy seja idêntica nas duas superfícies.
 */
function pausedDateLabel(pausedAt) {
  if (!pausedAt) return null
  const date = parseISO(pausedAt)
  if (Number.isNaN(date.getTime())) return null
  return formatDatePtBR(date) || null
}

/**
 * Modal de reconciliação (gap >= 30d). Montado apenas enquanto o sheet está aberto: a
 * desmontagem é o que devolve a escolha ao default "Começar do zero" a cada nova tentativa —
 * a opção de uma tentativa anterior nunca volta pré-marcada, muito menos a destrutiva.
 *
 * Selecionar NÃO executa: "Começar do zero" zera o saldo, então a confirmação é um segundo ato
 * deliberado (paridade com o mobile). Radiogroup com roving tabindex — o foco acompanha a
 * seleção, senão o leitor de tela não anuncia a troca.
 */
function ReconcileModal({ gapDays, dateLabel, busy, onZero, onResume, onClose }) {
  const [choice, setChoice] = useState('zero')

  const handleKeyDown = useCallback(
    (event) => {
      if (busy) return
      const { key } = event
      let next = null
      if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(key)) {
        next = choice === 'zero' ? 'resume' : 'zero'
      } else if (key === 'Home') {
        next = 'zero'
      } else if (key === 'End') {
        next = 'resume'
      }
      if (!next) return

      event.preventDefault()
      setChoice(next)
      const radios = event.currentTarget.querySelectorAll('[role="radio"]')
      radios[next === 'zero' ? 0 : 1]?.focus()
    },
    [busy, choice],
  )

  return (
    <Modal
      isOpen
      onClose={busy ? noop : onClose}
      title={`Seu estoque está congelado há ${gapDays} ${gapDays === 1 ? 'dia' : 'dias'}`}
    >
      <div className="stock-reconcile">
        <p className="stock-reconcile__body">Como você quer voltar a usar o estoque?</p>

        <div
          className="stock-reconcile__options"
          role="radiogroup"
          aria-label="Opções de reconciliação do estoque"
          onKeyDown={handleKeyDown}
        >
          <button
            type="button"
            role="radio"
            aria-checked={choice === 'zero'}
            tabIndex={choice === 'zero' ? 0 : -1}
            className={`stock-reconcile__option ${choice === 'zero' ? 'stock-reconcile__option--default' : ''}`}
            onClick={() => setChoice('zero')}
            disabled={busy}
          >
            <span className="stock-reconcile__option-label">Começar do zero</span>
            <span className="stock-reconcile__option-desc">
              O saldo volta a zero. O histórico de compras fica guardado.
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={choice === 'resume'}
            tabIndex={choice === 'resume' ? 0 : -1}
            className={`stock-reconcile__option ${choice === 'resume' ? 'stock-reconcile__option--default' : ''}`}
            onClick={() => setChoice('resume')}
            disabled={busy}
          >
            <span className="stock-reconcile__option-label">
              {dateLabel ? `Retomar o saldo de ${dateLabel}` : 'Retomar o saldo congelado'}
            </span>
            <span className="stock-reconcile__option-desc">
              Volta exatamente como estava quando você desativou.
            </span>
          </button>
        </div>

        <div className="stock-freeze__actions stock-reconcile__actions">
          <button
            type="button"
            className="stock-btn stock-btn--primary"
            onClick={choice === 'zero' ? onZero : onResume}
            disabled={busy}
          >
            Ativar estoque
          </button>
          <button type="button" className="stock-btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function StockSection() {
  const {
    enabled,
    ready,
    neverHadStock,
    sheet,
    reconcile,
    busy,
    announcement,
    clearAnnouncement,
    error,
    requestToggle,
    confirmFreeze,
    resumeAsIs,
    resumeAndZero,
    closeSheet,
    closeInitialBalance,
    finishInitialBalance,
  } = useStockToggle()

  const gapDays = reconcile?.gapDays ?? 0
  const dateLabel = pausedDateLabel(reconcile?.pausedAt ?? null)

  // A confirmação é um anúncio, não um estado da tela: sai depois de lida, senão fica poluindo
  // as Configurações para sempre. 8s — a frase é longa e a região é `aria-live=polite`.
  useEffect(() => {
    if (!announcement) return undefined
    const timer = setTimeout(clearAnnouncement, 8000)
    return () => clearTimeout(timer)
  }, [announcement, clearAnnouncement])

  return (
    <section className="sr-section">
      <h3 className="sr-section__title">
        <Package size={24} /> Estoque
      </h3>

      <div className="sr-section__card">
        <div className="stock-toggle">
          <div className="stock-toggle__info">
            <span className="stock-toggle__label">Controle de estoque</span>
            <span className="stock-toggle__sub">{stockSubtitle(enabled, neverHadStock)}</span>
            {!enabled && neverHadStock ? (
              <span className="stock-toggle__hint">
                Ao ativar, a gente pergunta quanto você tem de cada remédio agora.
              </span>
            ) : null}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? 'Controle de estoque ativado' : 'Controle de estoque desativado'}
            className={`stock-toggle__switch ${enabled ? 'stock-toggle__switch--on' : ''}`}
            onClick={requestToggle}
            disabled={busy || !ready}
          >
            <span className="stock-toggle__knob" />
          </button>
        </div>

        {/* Anúncio TEXTUAL (a11y §10): a retomada silenciosa não pode ser só visual. */}
        <p className="stock-toggle__status" role="status" aria-live="polite">
          {announcement ?? ''}
        </p>
        {error ? (
          <p className="stock-toggle__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {sheet === 'freeze' ? (
        // Fechar no meio da escrita deixaria a UI opinando sobre um resultado que ainda não
        // existe: enquanto `busy`, o modal não fecha.
        <Modal isOpen onClose={busy ? noop : closeSheet} title="Desativar o controle de estoque?">
          <div className="stock-freeze">
            <Lock size={24} className="stock-freeze__icon" aria-hidden="true" />
            <p className="stock-freeze__body">
              Seu estoque fica guardado como está — nada é apagado. Você deixa de ver saldos e
              avisos de reposição até reativar.
            </p>
            <div className="stock-freeze__actions">
              <button
                type="button"
                className="stock-btn stock-btn--primary"
                onClick={confirmFreeze}
                disabled={busy}
              >
                Desativar
              </button>
              <button
                type="button"
                className="stock-btn"
                onClick={closeSheet}
                disabled={busy}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {sheet === 'reconcile' && reconcile ? (
        <ReconcileModal
          gapDays={gapDays}
          dateLabel={dateLabel}
          busy={busy}
          onZero={resumeAndZero}
          onResume={resumeAsIs}
          onClose={closeSheet}
        />
      ) : null}

      {sheet === 'initial-balance' ? (
        // T017: quem nunca teve estoque preenche o saldo aqui — a escrita (saldos + liga a
        // preferência) é toda do InitialBalanceForm/stockPreferenceService.
        <Modal isOpen onClose={closeInitialBalance}>
          <InitialBalanceForm
            source="settings"
            onDone={finishInitialBalance}
            onCancel={closeInitialBalance}
          />
        </Modal>
      ) : null}
    </section>
  )
}
