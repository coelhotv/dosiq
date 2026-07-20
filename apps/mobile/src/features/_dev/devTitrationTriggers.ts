// devTitrationTriggers.ts — gatilhos DEV-only pro smoke da Evolução do tratamento (029 F5).
//
// ⛔ NÃO usar em produção. Tudo aqui é gated por `__DEV__` no DevHub e escreve na conta LOGADA.
// Use a conta de smoke, nunca a de um paciente real (Constituição I).
//
// ═══ POR QUE ESTES GATILHOS EXISTEM ═══
// A escada tem etapa de no mínimo 1 semana, e o estado que o F5 exercita
// (`pending_confirmation`) é escrito pelo CRON, às 08:00 SP. Esperar o tempo real tornaria o
// smoke inviável.
//
// 🔴 MOVER A ÂNCORA, NÃO O RELÓGIO. O offset de "agora" descrito em
// `docs/operations/DEV_TIME_TRAVEL.md` NÃO serve para esta feature: o vencimento é
// `dia_local(started_at) + duration_days`, aritmética de dia-calendário contra um valor GRAVADO,
// avaliada nos DOIS lados (motor no servidor, `resolvePendingSwitch` no cliente). Um offset só
// no device moveria o cliente e deixaria o servidor para trás — a UI mostraria "vencida há 12
// dias" enquanto o servidor ainda acha que é dia 0 e nunca enviou push. Smoke falso.
// Retroagir `started_at` move os dois juntos, sem código de time-travel e sem o footgun do
// AP-203 (a RPC de confirmação usa `now()` server-side, então nada grava data futura).
//
// ═══ O QUE ESTES GATILHOS PROVAM (e o que NÃO provam) ═══
// ✅ UI: card do Hoje (dia 0), linha neutra, frase do dia 3, banner de vencida, sheet, RPC real.
// ✅ Push: categoria registrada, botões desenhados, handler das ações, chamada da RPC.
// ❌ NÃO provam a montagem do payload no servidor nem o `interruptionLevel` vindo do Expo —
//    `devPushLocalSwitch` fabrica a notificação LOCALMENTE. Esses dois só o run real das 08:00
//    valida (ver o passo a passo em docs/operations/DEV_TIME_TRAVEL.md §Evolução do tratamento).

// ⚠️ expo-notifications, NÃO notifee. A categoria do switch é registrada por
// `Notifications.setNotificationCategoryAsync` e o listener das ações é o
// `addNotificationResponseReceivedListener` — as duas bibliotecas coexistem no app (o ALARME usa
// notifee). Disparar o gatilho pelo notifee testaria um caminho que o push real não percorre.
import * as Notifications from 'expo-notifications'
import { getRawNow, addDays } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { TITRATION_CATEGORY_ID, TITRATION_ACTION } from '@platform/notifications/titrationNotificationActions'

const client = supabase as any

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data?.user?.id
  if (!id) throw new Error('Sem sessão — faça login antes de usar os gatilhos.')
  return id
}

export interface DevSwitchTarget {
  titrationId: string
  currentStepId: string
  pendingStepId: string
  currentMedicineName: string
  pendingMedicineName: string
  pendingPosition: number
}

/**
 * Acha a primeira fronteira de `medicine_switch` da escada do usuário — o par (etapa vigente,
 * próxima etapa com OUTRO `medicine_id`).
 *
 * ⚠️ Escada same-med não serve para o smoke do F5: se todas as etapas compartilham o
 * `medicine_id`, toda transição é `dose_change` AUTOMÁTICO e o CTA nunca aparece, por design
 * (Decisões §0). Esta função devolve `null` nesse caso — e a mensagem no DevHub diz por quê,
 * em vez de deixar você caçando um card que não deveria existir.
 */
export async function devFindSwitchTarget(): Promise<DevSwitchTarget | null> {
  const userId = await getUserId()
  const { data, error } = await client
    .from('titration_steps')
    .select('id, titration_id, position, status, medicine_id, medicine:medicines(name)')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error

  const byLadder = new Map<string, any[]>()
  for (const s of data ?? []) {
    const list = byLadder.get(s.titration_id) ?? []
    list.push(s)
    byLadder.set(s.titration_id, list)
  }

  for (const steps of byLadder.values()) {
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].medicine_id !== steps[i + 1].medicine_id) {
        return {
          titrationId: steps[i].titration_id,
          currentStepId: steps[i].id,
          pendingStepId: steps[i + 1].id,
          currentMedicineName: steps[i].medicine?.name ?? 'Medicamento',
          pendingMedicineName: steps[i + 1].medicine?.name ?? 'Medicamento',
          pendingPosition: steps[i + 1].position,
        }
      }
    }
  }
  return null
}

/**
 * Põe a escada no estado "troca pendente há N dias" — o que o cron faria naturalmente.
 *
 * Duas escritas, nesta ordem:
 *  1. a etapa da fronteira vira `current` com `started_at` retroagido `duration_days + N` dias
 *     → `dueDay` cai N dias no passado;
 *  2. a próxima vira `pending_confirmation`.
 *
 * ⚠️ Isto SIMULA a escrita do cron; não exercita o motor (`resolveTitrationAdvance`), que já tem
 * cobertura própria e prova live do F3. O alvo aqui é a UI e o handler.
 *
 * @param daysWaiting 0 = vence hoje (card com botões) · 3 = frase de contexto · 12 = banner de vencida
 */
export async function devArmPendingSwitch(daysWaiting = 0): Promise<DevSwitchTarget> {
  const userId = await getUserId()
  const target = await devFindSwitchTarget()
  if (!target) {
    throw new Error(
      'Nenhuma escada com troca de MEDICAMENTO. Escada same-med só faz dose_change automático — ' +
        'o CTA não existe nesse caso. Cadastre uma etapa com outro medicamento.',
    )
  }

  const { data: cur, error: curErr } = await client
    .from('titration_steps')
    .select('duration_days')
    .eq('id', target.currentStepId)
    .single()
  if (curErr) throw curErr

  const duration = Number(cur?.duration_days) || 7
  const back = duration + daysWaiting
  // R-020: aritmética de data pelos helpers do core, nunca `new Date()` cru.
  const startedAt = addDays(getRawNow(), -back).toISOString()

  // 🔴 NORMALIZAR A ESCADA INTEIRA, não só as duas etapas do interesse.
  // A 1ª versão só promovia a etapa da fronteira a `current` e deixava a que JÁ era `current`
  // como estava → escada com DUAS vigentes. O banco aceita (não há constraint impedindo; só
  // `UNIQUE (titration_id, position)`), e `resolvePendingSwitch` ancorava o vencimento na
  // primeira que encontrasse → "Dia 3" produzia daysWaiting = 0 e o smoke virava falso-verde.
  // Um gatilho de smoke que fabrica estado impossível testa um app que não existe.
  await normalizeLadder(userId, target, { startedAt })

  return target
}

/**
 * Deixa a escada num estado COERENTE em torno da fronteira: anteriores `completed`, a da
 * fronteira `current` (com o `started_at` pedido), a seguinte `pending_confirmation` (ou
 * `upcoming`) e as demais `upcoming`.
 *
 * @private
 */
async function normalizeLadder(
  userId: string,
  target: DevSwitchTarget,
  opts: { startedAt: string; pendingStatus?: 'pending_confirmation' | 'upcoming' },
): Promise<void> {
  const pendingStatus = opts.pendingStatus ?? 'pending_confirmation'
  const { data: all, error } = await client
    .from('titration_steps')
    .select('id, position')
    .eq('titration_id', target.titrationId)
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error

  const boundary = (all ?? []).find((s: any) => s.id === target.currentStepId)
  const boundaryPos = Number(boundary?.position ?? 0)

  for (const step of all ?? []) {
    const pos = Number(step.position)
    let patch: Record<string, unknown>
    if (pos < boundaryPos) {
      // `titration_steps_current_exige_started_check`: só `current` exige started_at; concluída
      // sem data é aceito e não é o alvo do teste.
      patch = { status: 'completed' }
    } else if (pos === boundaryPos) {
      patch = { status: 'current', started_at: opts.startedAt, ended_at: null }
    } else if (step.id === target.pendingStepId) {
      patch = { status: pendingStatus, started_at: null, ended_at: null }
    } else {
      patch = { status: 'upcoming', started_at: null, ended_at: null }
    }
    const { error: e } = await client
      .from('titration_steps')
      .update(patch)
      .eq('id', step.id)
      .eq('user_id', userId)
    if (e) throw e
  }
}

/**
 * Devolve a escada ao estado natural: a etapa da fronteira volta a vigorar começando HOJE e a
 * próxima volta a `upcoming`. Roda depois de cada cenário para não deixar a conta de smoke com
 * escada meio-transicionada.
 *
 * ⚠️ NÃO desfaz uma confirmação já executada — mas o estrago encolheu com a 052 Slice C.
 * ANTES: a RPC pausava um tratamento e ativava/criava outro, então reverter exigia mexer em N
 * protocolos na tela de tratamentos. AGORA (executor único, ADR-085) nenhum protocolo nasce ou
 * é encerrado: a confirmação só muta `medicine_id`/`dosage_per_intake`/`intake_unit` do executor
 * vigente. Reverter = devolver esses 3 campos ao valor anterior no MESMO tratamento (anote-os
 * antes do smoke) e rodar este reset. As `dose_instances` futuras se reprojetam sozinhas pelo
 * `resyncProtocolWindow` que roda atrás da RPC.
 */
export async function devResetLadder(): Promise<void> {
  const userId = await getUserId()
  const target = await devFindSwitchTarget()
  if (!target) return

  // Mesma normalização do arm — tinha o MESMO furo de só tocar as duas etapas da fronteira e
  // deixar uma vigente residual para trás.
  await normalizeLadder(userId, target, {
    startedAt: getRawNow().toISOString(),
    pendingStatus: 'upcoming',
  })
}

/**
 * Dispara LOCALMENTE uma notificação com a MESMA categoria e as MESMAS 2 ações que o servidor
 * emite no `medicine_switch` — para validar botões + handler sem esperar as 08:00.
 *
 * O `stepId` sai da escada real, então `[Iniciar etapa]` chama a RPC de verdade. Se não houver
 * etapa pendente, o botão exercita o caminho de recusa honesta (`nao_pendente`) — que também é
 * um caso que vale ver.
 */
export async function devPushLocalSwitch(): Promise<void> {
  const target = await devFindSwitchTarget()
  const stepId = target?.pendingStepId ?? 'dev-step-inexistente'
  const stepNumber = (target?.pendingPosition ?? 1) + 1
  const medName = target?.pendingMedicineName ?? 'Medicamento'

  // Espelha exatamente o que `buildTitrationAlertPayload` + `expoPushChannel` mandam no push
  // real: `categoryIdentifier` desenha os botões, e `data.actions[].params.stepId` é o que o
  // handler consome. Divergir aqui tornaria o gatilho inútil como smoke.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Etapa ${stepNumber} começa hoje`,
      body: `${medName}\nComo prescrito pelo seu médico.`,
      categoryIdentifier: TITRATION_CATEGORY_ID,
      data: {
        kind: 'titration_alert',
        __dev: true,
        actions: [
          { id: TITRATION_ACTION.START_STEP, label: 'Iniciar etapa', params: { stepId } },
          { id: TITRATION_ACTION.NOT_YET, label: 'Ainda não', params: { stepId } },
        ],
      },
    },
    trigger: null, // imediato
  })
}
