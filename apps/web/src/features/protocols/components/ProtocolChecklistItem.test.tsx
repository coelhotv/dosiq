import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProtocolChecklistItem from './ProtocolChecklistItem'

describe('ProtocolChecklistItem', () => {
  it('renders correctly when not selected', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('💊 Manhã')).toBeInTheDocument()
    expect(screen.getByText('1 un.')).toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('renders correctly when selected', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={true} onToggle={onToggle} />)

    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('calls onToggle when clicked', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByText('💊 Manhã'))

    expect(onToggle).toHaveBeenCalledWith('p1')
  })

  // 029 F6: o badge deriva da escada N2 (`titration_steps`), não mais de `titration_status`
  // — coluna dropada que estava `'estável'` em 100% das linhas de prod, ou seja, este selo
  // dizia "Estável" até para quem estava titulando (a mesma mentira corrigida no #763).
  it('mostra "Em evolução" quando a etapa vigente é FINITA', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      titration_steps: [
        { id: 's1', position: 0, status: 'completed', duration_days: 7, started_at: '2026-07-01T10:00:00-03:00' },
        { id: 's2', position: 1, status: 'current', duration_days: 14, started_at: '2026-07-08T10:00:00-03:00' },
      ],
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('📈 Em evolução')).toBeInTheDocument()
  })

  it('NÃO mostra badge quando a etapa vigente é CONTÍNUA (manutenção = estável)', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      // `duration_days: null` = etapa contínua: chegou na dose de manutenção, não evolui mais.
      titration_steps: [
        { id: 's1', position: 0, status: 'current', duration_days: null, started_at: '2026-07-01T10:00:00-03:00' },
      ],
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.queryByText('📈 Em evolução')).not.toBeInTheDocument()
  })

  // 🔴 O caso REAL deste componente: os tratamentos vêm de `selectedPlan.protocols`, que não
  // carrega `titration_steps`. Antes o componente afirmava "Estável" nesse cenário — afirmação
  // sem dado, indistinguível da verdade. Agora não afirma nada.
  it('sem escada carregada não afirma estabilidade (ausência é visível)', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.queryByText('Estável')).not.toBeInTheDocument()
    expect(screen.queryByText('📈 Em evolução')).not.toBeInTheDocument()
  })

  // 029 F3.1: removido 'renders titration scheduler data when present'. Montava
  // `titration_scheduler_data` à mão — um campo que NENHUM produtor do repositório escreve.
  // Ficou verde 6 meses provando um render que a produção nunca alcançou; o componente caía
  // sempre no ramo do badge. É a mesma armadilha do PO-5 (paridade com um cadáver): um teste só
  // vale se o estado que ele monta puder existir de verdade. Ver AP-301.

  it('renders time schedule pills', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      time_schedule: ['08:00', '12:00', '20:00'],
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('12:00')).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
  })

  it('renders correct dosage text for single pill', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('1 un.')).toBeInTheDocument()
  })

  it('renders correct dosage text for multiple pills', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 2,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('2 un.')).toBeInTheDocument()
  })
})
