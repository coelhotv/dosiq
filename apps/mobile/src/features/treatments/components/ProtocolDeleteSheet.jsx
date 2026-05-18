// ProtocolDeleteSheet.jsx — bottom sheet de confirmação de exclusão de tratamento.
// Fase 2 T2.11 (Sprint T2.2 PR-C). Spec §3.7.
//
// Warning soft (não hard block como em medicamento): doses registradas continuam
// no histórico — apenas o agendamento futuro é cancelado. Mostra stats reais via
// useProtocolStats para dar contexto antes do confirm.

import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Info,
  Trash2,
} from 'lucide-react-native'
import { useProtocolStats } from '@treatments/hooks/useProtocolStats'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

export default function ProtocolDeleteSheet({
  open,
  onClose,
  onConfirm,
  protocol,
  isDeleting = false,
}) {
  // States (R-010 — States → Memos → Effects → Handlers)
  // Passamos o protocol completo (já carregado pelo Detail via useProtocol)
  // pra evitar fetch redundante só por time_schedule.length.
  const { data: stats, loading } = useProtocolStats(protocol)

  // Handlers
  function handleCancel() {
    if (isDeleting) return
    selectionTap()
    onClose?.()
  }

  function handleConfirm() {
    if (isDeleting) return
    onConfirm?.()
  }

  return (
    <Modal
      visible={!!open}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
      // Android: statusBarTranslucent faz o Modal cobrir status bar + ignorar
      // bottom tabs do parent navigator (sem isso o modal só ocupa a área do
      // screen atual, deixando topo sem overlay e botões cortados pela tab bar).
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Spacer Android: empurra o sheet abaixo da status bar translúcida */}
        {Platform.OS === 'android' ? (
          <View style={{ height: StatusBar.currentHeight ?? 0 }} />
        ) : null}
        <Pressable
          style={styles.backdrop}
          onPress={handleCancel}
          accessibilityLabel="Fechar"
        />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

          {/* Ícone alert soft */}
          <View style={styles.iconWrap}>
            <AlertTriangle size={28} color={colors.status.warning} strokeWidth={2} />
          </View>

          <Text style={styles.title}>Excluir este tratamento?</Text>
           <Text style={styles.body}>
            Confira os detalhes abaixo.
          </Text>

          {/* Seção HISTÓRICO RECENTE */}
          <Text style={styles.eyebrow}>HISTÓRICO RECENTE</Text>
          <View style={styles.statsCard}>
            <StatRow
              icon={CheckCircle2}
              iconColor={colors.status.success}
              label={
                loading || !stats
                  ? 'Carregando…'
                  : `${stats.confirmedLast7d} ${stats.confirmedLast7d === 1 ? 'dose tomada' : 'doses tomadas'}`
              }
              sub="Últimos 7 dias"
              muted={loading || !stats}
            />
            <StatRow
              icon={CalendarDays}
              iconColor={colors.primary[600]}
              label={
                loading || !stats
                  ? 'Carregando…'
                  : `${stats.scheduledNext7d} ${stats.scheduledNext7d === 1 ? 'dose agendada' : 'doses agendadas'}`
              }
              sub="Próximos 7 dias · serão canceladas"
              muted={loading || !stats}
            />
          </View>

          {/* Banner warning */}
          <View style={styles.banner}>
            <Info size={16} color={colors.status.warning} strokeWidth={2} />
            <Text style={styles.bannerText}>
              Excluir o tratamento NÃO apaga o histórico de doses já registradas, nem
              o cadastro do medicamento.
            </Text>
          </View>

          {/* Botões */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleCancel}
              disabled={isDeleting}
              style={({ pressed }) => [
                styles.btn,
                styles.btnCancel,
                pressed && !isDeleting && styles.btnPressed,
                isDeleting && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              accessibilityState={{ disabled: isDeleting }}
            >
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={isDeleting}
              style={({ pressed }) => [
                styles.btn,
                styles.btnConfirm,
                pressed && !isDeleting && styles.btnPressed,
                isDeleting && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Excluir tratamento"
              accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
            >
              <Trash2 size={18} color={colors.text.inverse} strokeWidth={2} />
              <Text style={styles.btnConfirmText}>
                {isDeleting ? 'Excluindo…' : 'Excluir'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

function StatRow(props) {
  const { icon: IconComponent, iconColor, label, sub, muted } = props
  return (
    <View style={styles.statRow}>
      {IconComponent ? <IconComponent size={18} color={iconColor} strokeWidth={2} /> : null}
      <View style={styles.statTextWrap}>
        <Text style={[styles.statLabel, muted && styles.statMuted]}>{label}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[5],
    paddingBottom: spacing[6],
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing[4],
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.supplement[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[2],
  },
  body: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing[2],
  },
  statsCard: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  statTextWrap: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statMuted: {
    color: colors.text.muted,
    fontWeight: '500',
  },
  statSub: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.supplement[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.primary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingTop: spacing[1],
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
  },
  btnCancel: {
    backgroundColor: colors.neutral[100],
  },
  btnConfirm: {
    backgroundColor: colors.status.error,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  btnConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
})
