import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/**
 * Mock do MedicineAutocomplete: expõe botões que disparam onSelect com um
 * medicamento da base ANVISA, sem depender do fetch on-demand real.
 */
const NON_GENERIC = {
  name: 'Epysqli',
  activeIngredient: 'Eculizumabe',
  therapeuticClass: 'Agente Imunosupressor',
  regulatoryCategory: 'Biologico',
  laboratory: 'Samsung Bioepis Br Pharmaceutical',
}

vi.mock('@medications/components/MedicineAutocomplete', () => ({
  default: ({ onSelect }) => (
    <button type="button" data-testid="pick" onClick={() => onSelect(NON_GENERIC)}>
      pick
    </button>
  ),
}))

import AnvisaSearchBar from '@/features/protocols/components/AnvisaSearchBar'

describe('AnvisaSearchBar — prefill do wizard', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('sem protocolo existente: abre wizard com laboratory + regulatory_category (não-genérico)', () => {
    const onOpenWizard = vi.fn()
    render(
      <AnvisaSearchBar
        existingProtocols={[]}
        onOpenWizard={onOpenWizard}
        onEditProtocol={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('pick'))

    expect(onOpenWizard).toHaveBeenCalledTimes(1)
    const payload = onOpenWizard.mock.calls[0][0]
    // O bug: laboratory e regulatory_category vinham ausentes (mapeamento parcial)
    expect(payload.laboratory).toBe('Samsung Bioepis Br Pharmaceutical')
    expect(payload.regulatory_category).toBeTruthy()
    expect(payload.name).toBe('Epysqli')
    expect(payload.active_ingredient).toBeTruthy()
    expect(payload.therapeutic_class).toBeTruthy()
  })

  it('protocolo existente: edita em vez de abrir wizard', () => {
    const onOpenWizard = vi.fn()
    const onEditProtocol = vi.fn()
    render(
      <AnvisaSearchBar
        existingProtocols={[{ medicineName: 'epysqli', id: 'p1' }]}
        onOpenWizard={onOpenWizard}
        onEditProtocol={onEditProtocol}
      />,
    )

    fireEvent.click(screen.getByTestId('pick'))

    expect(onEditProtocol).toHaveBeenCalledTimes(1)
    expect(onOpenWizard).not.toHaveBeenCalled()
  })
})
