// DevHubScreen — hub DEV-only de validação. Links pras telas de smoke da fase atual.

import { useState } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft } = LucideIcons as any
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '../../../navigation/routes'
import { colors, spacing } from '@shared/styles/tokens'
import { logEvent } from '@platform/analytics/productAnalytics'
import {
  devFireAlarmNow,
  devScheduleAlarmIn,
  devClearAlarms,
  devFireEarlyAlarm,
  devFireEarlyAlarmBurst,
  devFireEarlyAlarmTwoDoses,
  devFireServerRefusedAlarm,
  devClearEarlyAlarms,
} from '../devAlarmTriggers'
import {
  devDoseSpikeUpcoming,
  devDoseSpikeLate,
  devDoseSpikeResolve,
} from '../devDoseActivitySpike'
import { startDoseBgSpike, clearDoseBgSpike } from '../devDoseActivityBgSpike'
import {
  devLiveActivityUpcoming,
  devLiveActivityLate,
  devLiveActivityEnd,
} from '../devDoseActivitySpikeIOS'
import {
  devArmPendingSwitch,
  devResetLadder,
  devPushLocalSwitch,
} from '../devTitrationTriggers'

// Os gatilhos da 029 escrevem no banco e podem falhar por motivo ÚTIL (ex.: "escada same-med não
// produz CTA"). Engolir o erro faria o botão parecer inerte; o Alert diz o que aconteceu.
function runTitrationTrigger(fn: () => Promise<unknown>, okMsg: string) {
  fn()
    .then(() => Alert.alert('Dev — Evolução', `${okMsg}.\n\nReabra a aba Hoje para ver.`))
    .catch((err) => Alert.alert('Dev — Evolução', err?.message ?? 'Falhou.'))
}

/**
 * Gatilhos da 067 A2 falham por PRÉ-CONDIÇÃO (sem dose pending crítica, dose perto demais pra estar
 * fora da janela). Engolir isso numa promise solta faria o smoke parecer "nada aconteceu" quando na
 * verdade nem chegou a disparar — o mesmo silêncio que a spec está corrigindo.
 */
function runEarly(fn: () => Promise<unknown>) {
  fn().catch((err) => Alert.alert('Dev — Guarda 067', err?.message ?? 'Falhou.'))
}

function DevAlarmSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Spec 001 — Alarme Nativo</Text>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          devFireAlarmNow()
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>⚡ Disparar notif AGORA (visual: notif + botões + som)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          devScheduleAlarmIn(10)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>⏱️ Agendar +10s (path real: lock/Doze → full-screen)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          devClearAlarms()
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>🧹 Limpar alarmes de teste</Text>
      </TouchableOpacity>
      <Text style={styles.note}>
        Tomei/Pular usam id sentinela → o registro falha de propósito. Foco: apresentação.
      </Text>

      <Text style={styles.sectionTitle}>Spec 067 A2 — Guarda de janela</Text>
      <Text style={styles.note}>
        Usa uma dose pending crítica REAL do banco: a trilha grava `uuid`, e id sentinela faria o
        insert falhar em silêncio (fail-open da FR-008) com o smoke parecendo verde.
      </Text>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runEarly(devFireEarlyAlarm)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>🚨 Disparo ADIANTADO 3h37 (PO-3/PO-15)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runEarly(() => devFireEarlyAlarmBurst(3))
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>🔁 3 disparos na MESMA dose (PO-16 → 1 aviso)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runEarly(devFireEarlyAlarmTwoDoses)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>👯 2 doses distintas (guard PO-16 → 2 avisos)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runEarly(devClearEarlyAlarms)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>🧹 Limpar disparos adiantados + avisos</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Spec 067 B1 — Recusa do SERVIDOR</Text>
      <Text style={styles.note}>
        O payload mente (&quot;a dose é agora&quot;) e o banco não: a guarda de client passa — como
        passaria num aparelho com relógio adiantado — e a RPC recusa lendo o horário da própria
        linha. Toque em &quot;Pular&quot; no alarme: nada deve ser gravado, a dose segue pendente e a
        mensagem da recusa aparece (Alert na tela cheia · notificação se você agir pelo shade).
        {'\n\n'}⚠️ Usa uma dose crítica a MAIS de 4h daqui, de propósito: rodar contra a dose do dia
        sequestraria o alarme real dela. E aqui só se toca em &quot;Pular&quot; — &quot;Tomei&quot;
        registraria a dose de verdade (o registro não tem guarda de janela, por decisão clínica).
      </Text>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runEarly(devFireServerRefusedAlarm)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>🛡️ Alarme que só o BANCO recusa (PO-7)</Text>
      </TouchableOpacity>
      <Text style={styles.note}>
        Estes NÃO mandam `__dev`: a guarda roda de verdade. Esperado — takeover não abre, alarme é
        cancelado, evento `alarm_out_of_window` na trilha e aviso "Alarme fora de hora" sem som.
        Tocar "Tomei"/"Pular" deve ser RECUSADO.
      </Text>
    </View>
  )
}

function DevSpikeSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Spec 039 — Dose State Machine (F0 spike)</Text>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          devDoseSpikeUpcoming(60)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>⏳ PRÓXIMA — ongoing + cronômetro regressivo (60s)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          devDoseSpikeLate(30)
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>⏱️ ATRASADA — ongoing + cronômetro progressivo (count-up)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          devDoseSpikeResolve()
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>✓ REGISTRADA — encerra a superfície (cancel-on-resolve)</Text>
      </TouchableOpacity>
      <Text style={styles.note}>
        Prova PO-0.2: notif fixa, cronômetro corre sozinho (sem update), botões Registrar/Adiar.
        Sem som (não é alarme). Registrar/Adiar = sentinela DEV.
      </Text>
    </View>
  )
}

function DevTitrationSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Spec 029 F5 — Evolução do tratamento</Text>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runTitrationTrigger(() => devArmPendingSwitch(0), 'Troca pendente HOJE (dia 0)')
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>📊 Vencer HOJE (dia 0) — card com [Iniciar etapa] [Ainda não]</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runTitrationTrigger(() => devArmPendingSwitch(3), 'Pendente há 3 dias')
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>📊 Dia 3 — linha neutra + frase de contexto</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runTitrationTrigger(() => devArmPendingSwitch(12), 'Vencida há 12 dias')
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>📊 Vencida há 12 dias — banner âmbar + [Ajustar duração]</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runTitrationTrigger(devPushLocalSwitch, 'Notificação local disparada')
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>🔔 Push LOCAL com as 2 ações (categoria + handler + RPC)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          lightTap()
          runTitrationTrigger(devResetLadder, 'Escada restaurada')
        }}
        style={styles.buttonCard}
      >
        <Text style={styles.buttonText}>↩️ Resetar escada (vigente começa hoje, próxima volta a futura)</Text>
      </TouchableOpacity>
    </View>
  )
}

function DevDemosSection({ navigation }: any) {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spec 039 — Transição em BACKGROUND (spike F2)</Text>
        <TouchableOpacity
          onPress={() => {
            lightTap()
            startDoseBgSpike()
          }}
          style={styles.buttonCard}
        >
          <Text style={styles.buttonText}>▶️ Iniciar sequência (chegando→agora→pendente→tomada)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            lightTap()
            clearDoseBgSpike()
          }}
          style={styles.buttonCard}
        >
          <Text style={styles.buttonText}>🧹 Limpar sequência</Text>
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spec 039 — Live Activity iOS (F0 spike)</Text>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              devLiveActivityUpcoming(60)
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>🏝️ HORA — Live Activity + countdown na ilha (60s)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              devLiveActivityLate(120)
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>⏱️ ATRASADA — Live Activity count-up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              devLiveActivityEnd()
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>✓ Encerrar Live Activity (cancel-on-resolve)</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fase 3 — Estoque S3.1</Text>
        <TouchableOpacity
          onPress={() => {
            lightTap()
            navigation?.navigate(ROUTES.STOCK_PRIMITIVES_DEMO)
          }}
          style={styles.buttonCard}
        >
          <Text style={styles.buttonText}>📦 PurchaseCard + PurchaseFormScreen + PurchaseHistoryScreen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fase 5 — Registro de Doses (FAB)</Text>
        <TouchableOpacity
          onPress={() => {
            lightTap()
            navigation?.navigate(ROUTES.DOSE_PRIMITIVES_DEMO)
          }}
          style={styles.buttonCard}
        >
          <Text style={styles.buttonText}>💊 BulkDoseRegisterModal (Modo Simples e Complexo)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spec 055 PR 1.4 — Edge-to-edge (Android 16)</Text>
        <TouchableOpacity
          onPress={() => {
            lightTap()
            navigation?.navigate(ROUTES.DEV_FORM_NO_TABBAR)
          }}
          style={styles.buttonCard}
        >
          <Text style={styles.buttonText}>📐 MedicineFormScreen SEM tab bar (FormActions safe-area)</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

export default function DevHubScreen({ navigation }: any) {
  const [smokeCrash, setSmokeCrash] = useState(false)
  if (smokeCrash) {
    throw new Error('[smoke] crash de teste — ErrorBoundary → Sentry (ADR-090)')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Dev</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <DevAlarmSection />
        <DevSpikeSection />
        <DevTitrationSection />
        <DevDemosSection navigation={navigation} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spec 055 / ADR-090 — Observabilidade</Text>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              setSmokeCrash(true)
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>💥 Forçar crash de teste (→ Sentry)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              logEvent('dev_smoke_event', { source: 'devhub', platform: Platform.OS })
                .then(() => Alert.alert('Dev — PostHog', 'Evento dev_smoke_event enviado.'))
                .catch((err) => Alert.alert('Dev — PostHog', err?.message ?? 'Erro ao enviar evento.'))
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>📊 Enviar evento de teste (→ PostHog)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  buttonCard: {
    backgroundColor: colors.bg.card,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  note: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing[2],
    lineHeight: 16,
  },
})
