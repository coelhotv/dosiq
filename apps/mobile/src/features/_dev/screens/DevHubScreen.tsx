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
import { devFireAlarmNow, devScheduleAlarmIn, devClearAlarms } from '../devAlarmTriggers'
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

export default function DevHubScreen({ navigation }) {
  // ADR-090: smoke do pipeline de crash. Erro em HANDLER não passa pelo ErrorBoundary (React só
  // captura erro de render/lifecycle) — o botão arma o state e o THROW acontece no render,
  // exercitando o caminho real ErrorBoundary → Sentry.captureException.
  const [smokeCrash, setSmokeCrash] = useState(false)
  if (smokeCrash) {
    throw new Error('[smoke] crash de teste — ErrorBoundary → Sentry (ADR-090)')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Cabeçalho */}
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
        </View>

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
          <Text style={styles.note}>
            **Move a ÂNCORA, não o relógio:** cada botão retroage o `started_at` da etapa vigente, que
            é o que define o vencimento nos DOIS lados (motor no servidor + UI). Offset de "agora" no
            device NÃO serve aqui — moveria só o cliente e o servidor ficaria para trás (ver
            docs/operations/DEV_TIME_TRAVEL.md). Após cada botão, **reabra a aba Hoje**.{'\n\n'}
            Exige escada com troca de MEDICAMENTO: escada same-med só faz dose_change automático e o
            CTA não existe nela por design.{'\n\n'}
            O push LOCAL valida categoria + botões + handler + RPC. NÃO valida a montagem do payload
            no servidor nem o interruption level do Expo — só o run real das 08:00 SP pega esses dois.
          </Text>
        </View>

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
          <Text style={styles.note}>
            De-risk do US2.1: toque Iniciar e **FECHE o app** (ou bloqueie a tela). O card deve
            transicionar sozinho via triggers nativos encadeados: chegando (countdown ~30s) → AGORA
            (estático, teal) → pendente (count-up, âmbar, +15s) → tomada ✓ (verde, +30s). Se mudar de
            estado com app fechado/Doze, o modelo trigger-driven é viável. Senão, encadeamento headless
            não roda no device → replanejar.
          </Text>
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
            <Text style={styles.note}>
              Prova PO-0.1: timer vivo na Dynamic Island + Lock Screen, sem APNs.
              Requer wiring do Widget Extension no Xcode (SPIKE_iOS.md).
            </Text>
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
          <Text style={styles.note}>
            Root stack, sem RootTabs embaixo — expõe o footer sticky (FormActions) direto contra a
            gesture bar. Telas do fluxo normal (tratamento/estoque) ficam mascaradas pela tab bar,
            que já reserva o inset. Use pra validar antes/depois do fix T041.
          </Text>
        </View>

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
                .then(() => Alert.alert('Dev — PostHog', 'Evento dev_smoke_event enviado.\n\nO envio é em lote: pode levar ~30s para aparecer no dashboard.'))
                .catch((err) => Alert.alert('Dev — PostHog', err?.message ?? 'Erro ao enviar evento.'))
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>📊 Enviar evento de teste (→ PostHog)</Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            Prova PO-7: o crash cai no ErrorBoundary → Sentry.captureException; o evento vai pro
            PostHog junto com o cold_start disparado no boot. Sem chave configurada
            (EXPO_PUBLIC_SENTRY_DSN / EXPO_PUBLIC_POSTHOG_API_KEY) ambos viram no-op silencioso.
          </Text>
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
