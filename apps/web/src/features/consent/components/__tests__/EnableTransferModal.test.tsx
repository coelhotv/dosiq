// EnableTransferModal.test.tsx — ligar B (spec 096 guarda 11); falha de rede não trava o modal (RC6 #898).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TRANSFER_CONSENT_COPY } from '@dosiq/core'
import EnableTransferModal, { ENABLE_TRANSFER_COPY } from '../EnableTransferModal'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('EnableTransferModal', () => {
  it('onAuthorize que REJEITA → botões voltam e aparece o erro', async () => {
    const onAuthorize = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    render(<EnableTransferModal onAuthorize={onAuthorize} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    fireEvent.click(screen.getByText(ENABLE_TRANSFER_COPY.authorize))
    expect(await screen.findByText('Não foi possível registrar agora. Tente de novo.')).toBeInTheDocument()
    expect(screen.getByText(ENABLE_TRANSFER_COPY.cancel)).not.toBeDisabled()
    expect(screen.getByText(ENABLE_TRANSFER_COPY.authorize)).not.toBeDisabled()
  })
})
