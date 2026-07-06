// devDoseActivityBgSpike.js — spike DEV-only do épico 039 (F2 re-trabalho).
//
// OBJETIVO (de-risk): provar que a superfície de estado contínuo transiciona os N estados
// (label / cor / cronômetro) **com o app FECHADO** — o ponto central do US2.1 ("acompanhar e
// agir sem abrir o app"). A impl atual (JS-interval + flip timer) só transiciona em foreground;
// este spike valida o modelo CORRETO: transições dirigidas por **trigger nativo** (Notifee
// TimestampTrigger + AlarmManager allowWhileIdle → fura Doze), ENCADEADAS via onBackgroundEvent.
//
// Restrição do Notifee: 1 trigger pendente por `id`. Como todos os passos re-exibem o MESMO card
// (mesmo id), NÃO dá pra ter os N triggers pendentes juntos. Solução (a validar aqui): agendar só
// o PRÓXIMO passo; quando ele é ENTREGUE, o handler de background agenda o seguinte (encadeamento).
//
// Risco real que o spike mede: (1) o trigger dispara com app morto/Doze? (2) o onBackgroundEvent
// DELIVERED roda headless e consegue agendar o próximo? Se sim, o modelo trigger-driven é viável.
//
// NÃO usar em produção. Canal/id próprios de DEV. Sem ações (foco = transição automática).

import notifee, { AndroidImportance, TriggerType, EventType } from '@notifee/react-native'

const SPIKE_CHANNEL_ID = 'dose-activity-spike'
export const SPIKE_BG_ID = 'dev-039-bg-sequence'
const DEV_MED = 'Lantus · 10 UI'

// Sequência curta p/ smoke (intervalos de ~15-30s). `atSec` = offset do início; `chrono.targetSec`
// = alvo do cronômetro (offset do início) — regressivo (down) ou progressivo (up).
const STEPS = [
  { state: 'upcoming', atSec: 0, label: 'Dose crítica chegando', color: '#99f6e4', chrono: { dir: 'down', targetSec: 30 } },
  { state: 'now', atSec: 30, label: 'Dose crítica agora', color: '#14b8a6', chrono: null },
  { state: 'late', atSec: 45, label: 'Dose crítica pendente', color: '#904d00', chrono: { dir: 'up', targetSec: 30 } },
  { state: 'done', atSec: 75, label: 'Tomada ✓', color: '#166534', chrono: null, terminal: true },
]

async function ensureChannel() {
  await notifee.createChannel({
    id: SPIKE_CHANNEL_ID,
    name: 'Dose — estado contínuo (spike)',
    importance: AndroidImportance.DEFAULT, // persistente, não intrusivo (não é alarme)
    sound: undefined,
    vibration: false,
  })
}

// Monta o payload do passo. `nextIndex` vai no data → o handler de entrega sabe qual agendar a seguir.
function buildStep(step, baseMs, nextIndex) {
  const android: any = {
    channelId: SPIKE_CHANNEL_ID,
    importance: AndroidImportance.DEFAULT,
    color: step.color,
    colorized: true, // pinta o header com a cor (sinal forte de estado) — testar se o OEM honra
    smallIcon: 'ic_dosiq_mark',
    ongoing: !step.terminal,
    autoCancel: !!step.terminal,
    onlyAlertOnce: true,
  }
  if (step.chrono) {
    android.showChronometer = true
    android.chronometerDirection = step.chrono.dir
    android.timestamp = baseMs + step.chrono.targetSec * 1000
  }
  if (step.terminal) android.timeoutAfter = 3 * 60 * 1000 // some sozinho (paridade card done)
  return {
    id: SPIKE_BG_ID,
    title: DEV_MED,
    body: `${step.label} · (spike bg)`,
    data: {
      __spikeSeq: 'true',
      __spikeBase: String(baseMs),
      __spikeNext: nextIndex != null ? String(nextIndex) : '',
    },
    android,
  }
}

// Agenda (ou exibe, se já no horário) o passo `i` como trigger nativo. allowWhileIdle fura Doze.
async function scheduleStep(i, baseMs) {
  if (i < 0 || i >= STEPS.length) return
  const step = STEPS[i]
  const nextIndex = i + 1 < STEPS.length ? i + 1 : null
  const ts = baseMs + step.atSec * 1000
  const payload = buildStep(step, baseMs, nextIndex)
  if (ts <= Date.now()) {
    await notifee.displayNotification(payload)
    return
  }
  await notifee.createTriggerNotification(payload, {
    type: TriggerType.TIMESTAMP,
    timestamp: ts,
    alarmManager: { allowWhileIdle: true }, // fura Doze
  })
}

// Encadeia também em FOREGROUND (se o app estiver aberto quando um passo é entregue, o DELIVERED
// chega via onForegroundEvent — sem isso a cadeia travaria com app aberto). Guard p/ registrar 1x.
let fgRegistered = false
function ensureForegroundChain() {
  if (fgRegistered) return
  fgRegistered = true
  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.DELIVERED && detail?.notification?.data?.__spikeSeq === 'true') {
      await onSpikeDelivered(detail.notification.data)
    }
  })
}

/** Inicia a sequência: exibe o passo 0 já + agenda o passo 1 (encadeia daí). */
export async function startDoseBgSpike() {
  await ensureChannel()
  ensureForegroundChain()
  const base = Date.now()
  await notifee.displayNotification(buildStep(STEPS[0], base, 1))
  await scheduleStep(1, base)
}

/**
 * Chamado pelo handler (bg/fg) quando um passo do spike é ENTREGUE → agenda o próximo.
 * É o elo que prova o encadeamento headless. @param {object} data - data da notificação entregue
 */
export async function onSpikeDelivered(data) {
  if (data?.__spikeSeq !== 'true') return
  const nextRaw = data.__spikeNext
  if (!nextRaw) return // terminal → fim da cadeia
  const next = parseInt(nextRaw, 10)
  const base = parseInt(data.__spikeBase, 10)
  if (Number.isNaN(next) || Number.isNaN(base)) return
  await scheduleStep(next, base)
}

/** Limpa o card + trigger pendente do spike. */
export async function clearDoseBgSpike() {
  await notifee.cancelNotification(SPIKE_BG_ID)
  await notifee.cancelTriggerNotification(SPIKE_BG_ID)
}
