import React, { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { formatIntakeDose, formatDose, formatMedicineFullName, parseLocalDate } from '@dosiq/core'
import EvolutionSwitchCard from '@dashboard/components/EvolutionSwitchCard'
import EvolutionSwitchOutcomeSheet, {
  type SwitchOutcomeLine,
} from '@treatments/components/EvolutionSwitchOutcomeSheet'
import { usePendingSwitch } from '@treatments/hooks/usePendingSwitch'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import {
  confirmTitrationSwitch,
  getSwitchOutcomeProtocols,
  type SwitchOutcomeProtocol,
} from '@treatments/services/titrationService'
import { logEvent } from '@platform/analytics/firebaseAnalytics'
import { ROUTES } from '../../../navigation/routes'
import { navigateCrossTab } from '@navigation/navigateCrossTab'

/**
 * EvolutionSwitchSection — o card de troca de etapa no Hoje (029 F5 / T024 · Decisões §3).
 *
 * Container: orquestra hook + card + sheet. A TodayScreen ganha UMA linha, sem lógica de domínio
 * (R-279 — a decisão pura vive em `resolvePendingSwitch`, no core).
 *
 * 🔴 Sem lock de "confirmando" (AP-221/R-288): a exclusão mútua é o claim DENTRO da RPC. Toque
 * duplo cai em `already_confirmed:true`, que é SUCESSO — a UI converge para "etapa iniciada" e
 * nunca mostra falha (Constituição IX).
 */

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-06-24" → "24 jun". Dia LOCAL já resolvido pelo core — nunca `new Date(str)` (R-020). */
function fmtDay(localDay: string): string {
  const d = parseLocalDate(localDay)
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`
}

/** Frequência + horários + dose do protocolo ativado, para a linha "Lembretes" (§3.3). @private */
function buildRemindersValue(activated: SwitchOutcomeProtocol | undefined): string {
  if (!activated) return ''
  const dias = (activated.weekdays ?? []).map((d) => `${d.charAt(0).toUpperCase()}${d.slice(1)}`)
  const horarios = activated.time_schedule ?? []
  const dose = formatDose(activated.dosage_per_intake, activated.intake_unit)
  // Diário não lista os 7 dias — a copy do §8 mostra o dia só quando ele é informativo.
  const partes = [dias.length > 0 ? dias.join(', ') : null, horarios.join(' · ') || null, dose || null]
  return partes.filter(Boolean).join(' · ')
}

export default function EvolutionSwitchSection({
  timezone,
  refreshToken,
}: {
  timezone?: string
  refreshToken?: number
}) {
  // 1. States
  const [outcome, setOutcome] = useState<{
    stepNumber: number
    lines: SwitchOutcomeLine[]
    frozenStockMedicineName?: string
    protocolId: string | null
  } | null>(null)

  // 2. Hooks de dados
  const { view, postpone, refresh } = usePendingSwitch(timezone, refreshToken)
  // 044: em dose-only o rodapé de estoque do sheet não se aplica (ver setOutcome).
  const { enabled: stockEnabled } = useStockTracking()

  // 3. Handlers
  // Cross-tab SEMPRE pelo helper: `navigate(tab, { screen })` de um tiro deixa a tab presa na
  // sub-tela (ver navigateCrossTab). Achado no smoke do F5.
  const openTreatment = useCallback((protocolId: string | null | undefined) => {
    if (!protocolId) return
    navigateCrossTab(ROUTES.TREATMENTS, ROUTES.PROTOCOL_DETAIL, { id: protocolId })
  }, [])

  const handleStart = useCallback(async () => {
    if (!view) return
    const { info, pendingStep, currentStep } = view

    const result = await confirmTitrationSwitch(info.pendingStepId)

    // R-286: estreitar a união com `=== false`. `!result.ok` NÃO discrimina sob `strict:false`
    // (o mobile herda da base) e o erro apareceria longe da causa.
    if (result.ok === false) {
      // SEC-6: só IDs e tipos — nunca nome de medicamento ou dose em telemetria.
      logEvent('titration_transition_confirmed', {
        step_id: info.pendingStepId,
        surface: 'today_card',
        outcome: result.reason,
      })
      // Princípio IX: dizer o que NÃO aconteceu e por quê — nunca sucesso falso, nunca genérico.
      Alert.alert('A etapa não foi iniciada', result.message)
      await refresh()
      return
    }

    logEvent('titration_transition_confirmed', {
      step_id: info.pendingStepId,
      surface: 'today_card',
      // `already_confirmed` é sucesso (double-tap/retry), não falha — medir separado evita ler
      // convergência como erro no funil.
      outcome: result.alreadyConfirmed ? 'already_confirmed' : 'confirmed',
    })

    // Best-effort (R-245): a transição JÁ aconteceu no servidor. Se a leitura de detalhe falhar,
    // o sheet sai sem as linhas mecânicas em vez de sumir — o usuário ainda vê que deu certo.
    let protocols: SwitchOutcomeProtocol[] = []
    try {
      protocols = await getSwitchOutcomeProtocols([result.protocolActivated ?? '', result.protocolPaused ?? ''])
    } catch {
      protocols = []
    }
    const activated = protocols.find((p) => p.id === result.protocolActivated)
    const paused = protocols.find((p) => p.id === result.protocolPaused)

    // Nome + concentração: numa escada do mesmo medicamento as duas linhas do sheet sairiam
    // idênticas ("Mounjaro — pausado" / "Mounjaro — ativo"), o oposto de transparência.
    const pausedName = formatMedicineFullName(paused?.medicine ?? currentStep.medicine, '')
    const activatedName = formatMedicineFullName(activated?.medicine ?? pendingStep.medicine, '')

    const lines: SwitchOutcomeLine[] = []
    if (pausedName) lines.push({ kind: 'paused', label: pausedName, value: 'Tratamento pausado' })
    if (activatedName) lines.push({ kind: 'activated', label: activatedName, value: 'Tratamento ativo' })
    const reminders = buildRemindersValue(activated)
    if (reminders) lines.push({ kind: 'reminders', label: 'Lembretes', value: reminders })

    setOutcome({
      stepNumber: info.pendingPosition + 1,
      lines,
      // PO-4 / vocabulário do congelamento (044): o saldo do anterior fica como está.
      // Só quando o usuário CONTROLA estoque: em dose-only não há saldo, e prometer que "fica
      // guardado" descreveria um cadastro inexistente. O prop já documentava a omissão; faltava
      // a preferência chegar aqui (mesmo furo do aviso de preparação na timeline).
      frozenStockMedicineName: stockEnabled ? pausedName || undefined : undefined,
      protocolId: result.protocolActivated ?? pendingStep.protocol_id ?? currentStep.protocol_id,
    })
    await refresh()
  }, [view, refresh, stockEnabled])

  const handlePostpone = useCallback(() => {
    if (!view) return
    logEvent('titration_transition_postponed', {
      step_id: view.info.pendingStepId,
      surface: 'today_card',
    })
    postpone()
  }, [view, postpone])

  const closeSheet = useCallback(() => setOutcome(null), [])

  const openFromSheet = useCallback(() => {
    const protocolId = outcome?.protocolId
    setOutcome(null)
    openTreatment(protocolId)
  }, [outcome, openTreatment])

  // 4. Render
  if (!view && !outcome) return null

  return (
    <>
      {!!view && (
        <EvolutionSwitchCard
          stepNumber={view.info.pendingPosition + 1}
          medicineName={formatMedicineFullName(view.pendingStep.medicine)}
          doseLabel={formatIntakeDose(
            view.pendingStep.dose,
            view.pendingStep.intake_unit,
            view.pendingStep.medicine,
          )}
          currentMedicineName={formatMedicineFullName(view.currentStep.medicine, 'dose atual')}
          sinceLabel={fmtDay(view.info.dueDay)}
          showCta={view.showCta}
          showContext={view.showContext}
          onStart={handleStart}
          onPostpone={handlePostpone}
          onOpen={() => openTreatment(view.currentStep.protocol_id)}
        />
      )}
      {!!outcome && (
        <EvolutionSwitchOutcomeSheet
          visible
          stepNumber={outcome.stepNumber}
          lines={outcome.lines}
          frozenStockMedicineName={outcome.frozenStockMedicineName}
          onClose={closeSheet}
          onOpenTreatment={openFromSheet}
        />
      )}
    </>
  )
}
