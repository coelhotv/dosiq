/**
 * @fileoverview Testes das seções do Modo Consulta — spec 073 PR 2, achados do smoke do PO.
 *
 * Os três defeitos vistos na tela real (conta de teste do PO, 2026-08-22):
 *  1. dose diária derivada de divisão imprimia a dízima inteira ("0,3428571428571428 mg/dia");
 *  2. receita vencida há 4 dias aparecia como "Hoje" (`daysRemaining` negativo lido como zero);
 *  3. o chip de titulação sufixava "mg" fixo — 10 UI de Lantus saía "10mg".
 *
 * @module features/consultation/components/__tests__/ConsultationSections
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ConsultationMedicinesSection,
  ConsultationPrescriptionsSection,
  ConsultationTitrationsSection,
} from '@/features/consultation/components/ConsultationSections'

describe('ConsultationMedicinesSection — dose total no ciclo (085 C2)', () => {
  it('semanal sai por semana, não como média diária (Ozempic 2,4 mg/semana)', () => {
    render(
      <ConsultationMedicinesSection
        activeMedicines={[
          {
            id: 'ozempic',
            name: 'Ozempic',
            type: 'medicamento',
            dosagePerPill: 2.68,
            dosageUnit: 'mg/ml',
            isLiquid: true,
            timesPerDay: 1,
            intakeUnit: 'mg',
            cycleDosage: 2.4,
            cycleSuffix: '/semana',
            cadenceLabel: '1x — Semanal',
          },
        ]}
      />
    )

    expect(screen.getByText(/\(2,4 mg\/semana\)/)).toBeInTheDocument()
    // smoke C2: a cadência não se repete ao lado do total ("1x — Semanal, 2,4 mg/semana").
    expect(screen.queryByText(/Semanal/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/dia/)).not.toBeInTheDocument()
  })

  it('sólido arredonda para 2 casas e usa o sufixo do ciclo (a cada N dias)', () => {
    render(
      <ConsultationMedicinesSection
        activeMedicines={[
          {
            id: 'mounjaro',
            name: 'Mounjaro',
            type: 'medicamento',
            dosagePerPill: 15,
            dosagePerIntake: 7.5,
            dosageUnit: 'mg',
            isLiquid: false,
            timesPerDay: 1,
            cycleDosage: 10 / 3,
            cycleSuffix: ' a cada 90 dias',
            cadenceLabel: '1x — A cada 90 dias',
          },
        ]}
      />
    )

    expect(screen.getByText(/\(3,33 mg a cada 90 dias\)/)).toBeInTheDocument()
    expect(screen.queryByText(/1x — A cada 90 dias/)).not.toBeInTheDocument()
    expect(screen.queryByText(/3,3333/)).not.toBeInTheDocument()
  })
})

describe('ConsultationMedicinesSection — frase de posologia sem repetição (085 C2, smoke do PO)', () => {
  const detailOf = (med) => {
    const { container, unmount } = render(<ConsultationMedicinesSection activeMedicines={[{ id: 'x', name: 'X', type: 'medicamento', ...med }]} />)
    const text = container.querySelector('.sr-consultation__dosage-detail')?.textContent?.trim()
    unmount()
    return text
  }

  it('líquido com 1 tomada: só o total no ciclo (Mesigyna / Lantus)', () => {
    expect(detailOf({ isLiquid: true, dosagePerPill: 50, dosageUnit: 'mg/ml', timesPerDay: 1, intakeUnit: 'ml',
      cycleDosage: 1, cycleSuffix: ' a cada 30 dias', cadenceLabel: '1x — A cada 30 dias' })).toBe('(1 mL a cada 30 dias)')
    expect(detailOf({ isLiquid: true, dosagePerPill: 100, dosageUnit: 'ui/ml', timesPerDay: 1, intakeUnit: 'UI',
      cycleDosage: 10, cycleSuffix: '/dia', cadenceLabel: '1x ao dia' })).toBe('(10 UI/dia)')
  })

  it('sólido cujo total repete a dose da frente: só a cadência (Selozok 100 mg, 1x ao dia)', () => {
    expect(detailOf({ isLiquid: false, dosagePerIntake: 100, dosageUnit: 'mg', timesPerDay: 1,
      cycleDosage: 100, cycleSuffix: '/dia', cadenceLabel: '1x ao dia' })).toBe('(1x ao dia)')
  })

  it('2+ tomadas no dia: vezes + total, que dizem coisas diferentes', () => {
    expect(detailOf({ isLiquid: false, dosagePerIntake: 850, dosageUnit: 'mg', timesPerDay: 2,
      cycleDosage: 1700, cycleSuffix: '/dia', cadenceLabel: '2x ao dia' })).toBe('(2x ao dia, 1.700 mg/dia)')
    expect(detailOf({ isLiquid: true, dosagePerPill: 2.68, dosageUnit: 'mg/ml', timesPerDay: 2, intakeUnit: 'mg',
      cycleDosage: 4.8, cycleSuffix: '/semana', cadenceLabel: '2x — Semanal' })).toBe('(2x no dia da dose, 4,8 mg/semana)')
  })

  it('sem total (ciclos divergentes/PRN): mantém o rótulo de cadência', () => {
    expect(detailOf({ isLiquid: false, dosagePerIntake: 500, dosageUnit: 'mg', timesPerDay: 3,
      cycleDosage: null, cycleSuffix: null, cadenceLabel: null })).toBe('(3x)')
  })
})

describe('ConsultationPrescriptionsSection — dias da receita', () => {
  const rx = (daysRemaining: number, status = 'vencida') => [
    { protocolId: 'p1', medicineName: 'Dipirona Monoidratada', status, daysRemaining },
  ]

  it('receita vencida há 4 dias NÃO diz "Hoje"', () => {
    render(<ConsultationPrescriptionsSection prescriptionStatus={rx(-4)} />)

    expect(screen.getByText('Há 4 dias')).toBeInTheDocument()
    expect(screen.queryByText('Hoje')).not.toBeInTheDocument()
  })

  it('vencida há 1 dia usa singular', () => {
    render(<ConsultationPrescriptionsSection prescriptionStatus={rx(-1)} />)

    expect(screen.getByText('Há 1 dia')).toBeInTheDocument()
  })

  it('vence hoje é dito explicitamente', () => {
    render(<ConsultationPrescriptionsSection prescriptionStatus={rx(0, 'vencendo')} />)

    expect(screen.getByText('Vence hoje')).toBeInTheDocument()
  })

  it('vencendo em 5 dias mantém o rótulo atual', () => {
    render(<ConsultationPrescriptionsSection prescriptionStatus={rx(5, 'vencendo')} />)

    expect(screen.getByText('5 dias')).toBeInTheDocument()
  })
})

describe('ConsultationTitrationsSection — dose do degrau', () => {
  const titration = (over: any = {}) => [
    {
      protocolId: 't1',
      medicineName: 'Lantus',
      currentStep: 1,
      totalSteps: 1,
      currentDosage: 10,
      currentDoseLabel: '10 UI',
      progressPercent: null,
      isMaintenance: true,
      maintenanceSince: '07/06/2026',
      isTransitionDue: false,
      ...over,
    },
  ]

  it('usa a dose COM a unidade do degrau, não "mg" fixo', () => {
    render(<ConsultationTitrationsSection activeTitrations={titration()} />)

    expect(screen.getByText('10 UI')).toBeInTheDocument()
    expect(screen.queryByText('10mg')).not.toBeInTheDocument()
  })

  it('manutenção declara "Dose alvo" no lugar de um percentual vazio', () => {
    render(<ConsultationTitrationsSection activeTitrations={titration()} />)

    expect(screen.getByText(/Dose alvo — Etapa 1\/1/)).toBeInTheDocument()
    expect(screen.getByText(/desde 07\/06\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/^% —/)).not.toBeInTheDocument()
  })

  it('escada em andamento continua mostrando o percentual', () => {
    render(
      <ConsultationTitrationsSection
        activeTitrations={titration({
          isMaintenance: false,
          progressPercent: 71,
          currentStep: 2,
          totalSteps: 4,
          maintenanceSince: null,
        })}
      />
    )

    expect(screen.getByText(/71% — Etapa 2\/4/)).toBeInTheDocument()
  })

  it('degenerado: sem rótulo de degrau não inventa unidade', () => {
    render(
      <ConsultationTitrationsSection
        activeTitrations={titration({ currentDoseLabel: null, currentDosage: 7.5 })}
      />
    )

    expect(screen.getByText('7,5')).toBeInTheDocument()
  })
})
