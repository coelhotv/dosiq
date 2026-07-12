/**
 * StockPreferenceStep — Passo de onboarding que substitui o antigo "Estoque" (StockStep).
 *
 * Spec 044 F3: espelha a pergunta do mobile — o usuário escolhe entre dose-only
 * (controle de estoque desligado, pré-marcado) ou manter o controle de estoque ligado.
 * A preferência é GLOBAL (persistida no backend via createProfileRepository) — a MESMA
 * usada pelo mobile, para não haver consumo de FIFO divergente entre plataformas.
 *
 * Se a opção "também avisar estoque" for escolhida, o StockStep original (saldo
 * inicial) continua aparecendo em seguida, dentro do mesmo passo do wizard.
 */
import { useState, useCallback, useRef } from 'react'
import { useOnboarding } from './useOnboarding'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { supabase, getUserId } from '@shared/utils/supabase'
import { createProfileRepository } from '@dosiq/core'
import StockStep from './StockStep'
import './StockPreferenceStep.css'

const profileRepo = createProfileRepository({ client: supabase, getUserId })

const OPTIONS = [
  {
    id: 'dose_only',
    title: 'Só lembrar e registrar minhas doses',
    description: 'Lembretes na hora certa e um toque para marcar como tomada.',
  },
  {
    id: 'with_stock',
    title: 'Também avisar quando o remédio estiver acabando',
    description: 'Além dos lembretes, o Dosiq acompanha seu estoque e avisa antes de faltar.',
  },
]

export default function StockPreferenceStep() {
  // 1. States
  const [selected, setSelected] = useState('dose_only')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('choice') // 'choice' | 'initial-stock'
  const optionRefs = useRef([])

  // 2. Context
  const { nextStep } = useOnboarding()
  const { refresh } = useStockTracking()

  // 3. Handlers
  const handleSelect = useCallback((optionId) => {
    setSelected(optionId)
  }, [])

  // Radiogroup ARIA: só o item selecionado é focável (roving tabindex) e as setas movem a
  // seleção — um radiogroup em que Tab passa por todas as opções não é um radiogroup.
  const handleKeyDown = useCallback((e, index) => {
    const optionId = OPTIONS[index].id
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(optionId)
      return
    }
    const delta =
      e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1
          : 0
    if (delta === 0) return
    e.preventDefault()
    const next = (index + delta + OPTIONS.length) % OPTIONS.length
    setSelected(OPTIONS[next].id)
    optionRefs.current[next]?.focus()
  }, [])

  const handleContinue = useCallback(async () => {
    setError(null)
    setIsSaving(true)
    try {
      await profileRepo.setStockTracking(selected === 'with_stock')
      await refresh()
      if (selected === 'with_stock') {
        setPhase('initial-stock')
      } else {
        nextStep()
      }
    } catch (err) {
      console.error('Erro ao salvar preferência de estoque:', err)
      setError('Não foi possível salvar sua escolha. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }, [selected, refresh, nextStep])

  // Opção 2 (manter estoque ligado): segue pro form de saldo inicial já existente.
  if (phase === 'initial-stock') {
    return <StockStep />
  }

  return (
    <div className="stock-preference-step">
      <div className="stock-preference-header">
        <h2>Como o Dosiq pode te ajudar?</h2>
        <p>Escolha o que faz mais sentido pra você agora.</p>
      </div>

      <div
        className="stock-preference-options"
        role="radiogroup"
        aria-label="Como o Dosiq pode te ajudar?"
      >
        {OPTIONS.map((option, index) => {
          const isChecked = selected === option.id
          return (
            <button
              key={option.id}
              ref={(el) => { optionRefs.current[index] = el }}
              type="button"
              role="radio"
              aria-checked={isChecked}
              tabIndex={isChecked ? 0 : -1}
              className={`stock-preference-option${isChecked ? ' stock-preference-option--selected' : ''}`}
              onClick={() => handleSelect(option.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <span className="stock-preference-option__title">{option.title}</span>
              <span className="stock-preference-option__description">{option.description}</span>
            </button>
          )
        })}
      </div>

      {error && <div className="stock-preference-error">{error}</div>}

      <p className="stock-preference-footnote">Dá para mudar isso quando quiser, em Configurações.</p>

      <div className="stock-preference-actions">
        <button
          type="button"
          className="btn-primary stock-preference-continue"
          onClick={handleContinue}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
