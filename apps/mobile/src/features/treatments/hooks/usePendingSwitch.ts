// usePendingSwitch — pendência de troca de medicamento para o card do Hoje (029 F5 / T024).
//
// A DECISÃO é pura e vive no core (`resolvePendingSwitch`, CON-032): daqui sai só o I/O + o
// agrupamento por escada. O "aguardando desde" NÃO vem de coluna — é derivado do vencimento da
// etapa vigente (ver a nota extensa em `resolvePendingSwitch`).
//
// R-239 (nudge, não nag): "Ainda não" NÃO escreve no servidor. Ele só rebaixa o card para a
// linha neutra, e o dismiss é local+persistente (`nativeStorageAdapter`, nunca AsyncStorage cru).
// A partir do dia 1 a linha neutra é o estado natural, com ou sem dismiss.

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { resolvePendingSwitch, getTodayLocal, type PendingSwitchInfo } from '@dosiq/core'
import { nativeStorageAdapter } from '@platform/storage/nativeStorageAdapter'
import { getPendingSwitchSteps, type PendingSwitchStep } from '../services/titrationService'
import { onTitrationRefresh } from '../services/titrationRefreshBus'

const DISMISS_PREFIX = 'dosiq:evo-switch-dismissed:'

export interface PendingSwitchView {
  info: PendingSwitchInfo
  /** Etapa que começa — alimenta "Semaglutida 0,5 mg" + pill de dose. */
  pendingStep: PendingSwitchStep
  /** Etapa que segue regendo os lembretes (copy do dia 3 e do banner de vencida). */
  currentStep: PendingSwitchStep
  /** Card completo com os 2 botões (§3.1) vs. linha neutra sem botões (§3.2). */
  showCta: boolean
  /** Dia 3+: a linha neutra ganha a frase de contexto (§3.2). */
  showContext: boolean
}

/**
 * Escolhe a pendência que o Hoje mostra. PURA — fora do hook de propósito: é decisão de domínio
 * (R-279), fica testável sem renderizar, e o React Compiler consegue memoizar a chamada.
 *
 * Só a PRIMEIRA pendência aparece: duas trocas no mesmo dia é raro, e empilhar dois CTAs de
 * decisão clínica na mesma tela é pior que resolver uma de cada vez.
 *
 * @param dismissedIds `null` = storage ainda não lido — não decidir nada ainda (evita o card
 *                     piscar como CTA e virar linha neutra meio segundo depois).
 */
export function selectPendingView(
  steps: PendingSwitchStep[],
  dismissedIds: string[] | null,
  timezone: string,
): PendingSwitchView | null {
  if (dismissedIds === null || steps.length === 0) return null
  const todayLocal = getTodayLocal(timezone)

  // Agrupa por escada: `resolvePendingSwitch` raciocina sobre UMA escada por vez.
  const byLadder = new Map<string, PendingSwitchStep[]>()
  for (const s of steps) {
    const list = byLadder.get(s.titration_id) ?? []
    list.push(s)
    byLadder.set(s.titration_id, list)
  }

  for (const ladder of byLadder.values()) {
    const info = resolvePendingSwitch(ladder, todayLocal, timezone)
    if (!info) continue
    const pendingStep = ladder.find((s) => s.id === info.pendingStepId)
    const currentStep = ladder.find((s) => s.id === info.currentStepId)
    if (!pendingStep || !currentStep) continue

    // Etapa órfã (medicamento sem embed) NÃO vira CTA: não há o que iniciar. Quem trata esse
    // caso é o card warning da timeline (§7.3 / T026).
    if (!pendingStep.medicine) continue

    return {
      info,
      pendingStep,
      currentStep,
      showCta: info.daysWaiting === 0 && !dismissedIds.includes(info.pendingStepId),
      showContext: info.daysWaiting >= 3,
    }
  }
  return null
}

export function usePendingSwitch(
  timezone: string = 'America/Sao_Paulo',
  /** Bump para forçar releitura — o Hoje passa o contador do pull-to-refresh. */
  refreshToken: number = 0,
) {
  // 1. States
  const [steps, setSteps] = useState<PendingSwitchStep[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[] | null>(null) // null = storage não lido
  const [loading, setLoading] = useState(true)

  // 2. Memos
  const view = useMemo<PendingSwitchView | null>(
    () => selectPendingView(steps, dismissedIds, timezone),
    [steps, dismissedIds, timezone],
  )

  // 3. Effects
  // 🔴 Duas falhas possíveis aqui derrubam a feature INTEIRA, e de formas diferentes (RC6):
  //   1. JSON válido mas com forma errada (storage corrompido, schema antigo) — `as string[]` era
  //      cego: um objeto passaria e `dismissedIds.includes(...)` estouraria em `selectPendingView`,
  //      dentro de um `useMemo` de render, quebrando o Hoje;
  //   2. rejeição na LEITURA (SecureStore/bridge) sem `.catch` — `dismissedIds` ficaria `null`
  //      para sempre, e `null` é o sinal de "storage não lido": o card NUNCA apareceria. Pior que
  //      um erro visível, porque some em silêncio.
  // Fail-safe nos dois casos: lista vazia = "nada foi adiado", que só mostra a mais, nunca a menos.
  useEffect(() => {
    let cancelled = false
    nativeStorageAdapter
      .getItem(`${DISMISS_PREFIX}list`)
      .then((raw) => {
        if (cancelled) return
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : []
          // Valida a FORMA, não só o parse: array de strings ou nada.
          setDismissedIds(
            Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [],
          )
        } catch {
          setDismissedIds([])
        }
      })
      .catch(() => {
        if (!cancelled) setDismissedIds([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await getPendingSwitchSteps()
      setSteps(data)
    } catch {
      // Falha silenciosa: sem o card o Hoje segue inteiro. O tratamento continua acessível pela
      // timeline, que tem carregamento e erro próprios (não há decisão clínica perdida aqui).
      setSteps([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + refoco + pull-to-refresh, num efeito SÓ. `useFocusEffect` já roda no mount,
  // então um `useEffect` separado para a carga inicial produziria DUAS leituras em toda montagem
  // da tela (achado do RC5). `refreshToken` entra nas deps: mudar a identidade do callback
  // re-executa o efeito de foco, que é como o pull-to-refresh chega até aqui.
  //
  // Sem o refetch no foco o card só apareceria em cold start: quem escreve `pending_confirmation`
  // é o cron das 08:00 SP, e o app em background/outra aba manteria o snapshot do mount — a
  // pendência existiria no banco e não na tela.
  //
  // startTransition: o lint barra setState síncrono dentro de efeito (cascading renders) —
  // mesmo padrão de useMedicines/useStockUpsell.
  useFocusEffect(
    useCallback(() => {
      startTransition(() => {
        load()
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, refreshToken]),
  )

  // Os outros DOIS caminhos pelos quais a escada muda sem esta tela perder o foco:
  //   1. ação do PUSH (`opensAppToForeground:false`) — resolve sem trocar de tela nem de
  //      AppState; só o bus avisa;
  //   2. volta do background — o cron pode ter virado a etapa enquanto o app dormia, e aí não há
  //      evento de foco porque a tela nunca saiu de foco (mesmo raciocínio do useStockTracking).
  useEffect(() => {
    const unsubscribe = onTitrationRefresh(() => {
      startTransition(() => {
        load()
      })
    })
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        startTransition(() => {
          load()
        })
      }
    })
    return () => {
      unsubscribe()
      sub.remove()
    }
  }, [load])

  // 4. Handlers
  /** "Ainda não" (§3.2): rebaixa para a linha neutra. Nada é escrito no servidor. */
  const postpone = useCallback(() => {
    const id = view?.info.pendingStepId
    if (!id) return
    setDismissedIds((prev) => {
      const next = [...(prev ?? []), id]
      void nativeStorageAdapter.setItem(`${DISMISS_PREFIX}list`, JSON.stringify(next))
      return next
    })
  }, [view])

  return { view, loading, refresh: load, postpone }
}
