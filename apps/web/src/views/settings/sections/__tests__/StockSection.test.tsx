// StockSection — modal de reconciliação (>=30d) na web (spec 044, T016).
//
// O que este teste protege: "Começar do zero" ZERA o saldo. Selecionar a opção NÃO pode
// executá-la — a confirmação é um segundo ato deliberado (paridade com o mobile). Um clique
// só disparando a ação destrutiva foi o achado do review do PR #739.

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const resumeAndZero = vi.fn()
const resumeAsIs = vi.fn()
const closeSheet = vi.fn()

const toggleState = {
  enabled: false,
  ready: true,
  neverHadStock: false,
  sheet: 'reconcile',
  reconcile: { gapDays: 47, pausedAt: '2026-05-01T10:00:00Z' },
  busy: false,
  announcement: null,
  clearAnnouncement: vi.fn(),
  error: null,
  requestToggle: vi.fn(),
  confirmFreeze: vi.fn(),
  resumeAsIs,
  resumeAndZero,
  closeSheet,
}

vi.mock('@features/settings/hooks/useStockToggle', () => ({
  useStockToggle: () => toggleState,
}))

vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ children, title }: { children: unknown; title: string }) => (
    <div role="dialog" aria-label={title}>
      {children as never}
    </div>
  ),
}))

const { default: StockSection } = await import('../StockSection')

describe('StockSection — reconciliação >=30d', () => {
  beforeEach(() => {
    toggleState.busy = false
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('selecionar "Retomar o saldo" NÃO executa nada até confirmar', async () => {
    render(<StockSection />)

    fireEvent.click(screen.getByRole('radio', { name: /Retomar o saldo/i }))

    // Selecionar é escolher, não executar.
    expect(resumeAsIs).not.toHaveBeenCalled()
    expect(resumeAndZero).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))
    await waitFor(() => expect(resumeAsIs).toHaveBeenCalledTimes(1))
    expect(resumeAndZero).not.toHaveBeenCalled()
  })

  it('"Começar do zero" é o default pré-marcado e só zera após a confirmação', async () => {
    render(<StockSection />)

    expect(screen.getByRole('radio', { name: /Começar do zero/i })).toBeChecked()
    expect(resumeAndZero).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Ativar estoque' }))
    await waitFor(() => expect(resumeAndZero).toHaveBeenCalledTimes(1))
  })

  it('a data do congelamento aparece em PT-BR (nunca no formato US)', () => {
    render(<StockSection />)
    // 2026-05-01 → "01 mai 2026" (formatDatePtBR), jamais "5/1/2026".
    expect(screen.getByRole('radio', { name: /Retomar o saldo de 01/i })).toBeInTheDocument()
  })

  it('as setas alternam a opção selecionada (roving tabindex)', async () => {
    render(<StockSection />)

    const zero = screen.getByRole('radio', { name: /Começar do zero/i })
    zero.focus()
    fireEvent.keyDown(zero, { key: 'ArrowDown' })

    expect(screen.getByRole('radio', { name: /Retomar o saldo/i })).toBeChecked()
    expect(zero).not.toBeChecked()
    expect(resumeAsIs).not.toHaveBeenCalled()
  })
})
