/**
 * @fileoverview Testes das seções do Modo Consulta — spec 073 PR 2, achados do smoke do PO.
 *
 * Os três defeitos vistos na tela real (conta doktorr@gmail.com, 2026-08-22):
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

describe('ConsultationMedicinesSection — dose diária derivada', () => {
  it('arredonda a média diária para 2 casas (Ozempic 2,4 mg semanal)', () => {
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
            dailyDosage: 2.4 / 7,
            cadenceLabel: '1x — Semanal',
          },
        ]}
      />
    )

    expect(screen.getByText(/0,34 mg\/dia/)).toBeInTheDocument()
    expect(screen.queryByText(/0,3428/)).not.toBeInTheDocument()
  })

  it('sólido também arredonda e mantém a cadência real', () => {
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
            dailyDosage: 7.5 / 7,
            cadenceLabel: '1x — Semanal',
          },
        ]}
      />
    )

    expect(screen.getByText(/1x — Semanal/)).toBeInTheDocument()
    expect(screen.getByText(/1,07 mg\/dia/)).toBeInTheDocument()
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
