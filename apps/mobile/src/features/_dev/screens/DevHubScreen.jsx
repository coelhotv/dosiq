// DevHubScreen — hub DEV-only de validação. Links pras telas de smoke da fase atual.

import { ScrollView, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '../../../navigation/routes'
import { colors, spacing } from '@shared/styles/tokens'
import { devFireAlarmNow, devScheduleAlarmIn, devClearAlarms } from '../devAlarmTriggers'
import {
  devDoseSpikeUpcoming,
  devDoseSpikeLate,
  devDoseSpikeResolve,
} from '../devDoseActivitySpike'
import {
  devLiveActivityUpcoming,
  devLiveActivityLate,
  devLiveActivityEnd,
} from '../devDoseActivitySpikeIOS'

export default function DevHubScreen({ navigation }) {
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
