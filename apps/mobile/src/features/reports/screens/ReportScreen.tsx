// ReportScreen.tsx — relatório clínico em PDF no mobile (spec 097 Slice B, FR-008/009/016, PO-12).
//
// Período (7/30/90, padrão 30) → Gerar → pronto (Visualizar + Salvar ou Compartilhar). O PDF vem do
// servidor (`api/report.ts`, o mesmo documento da web); esta tela só orquestra estados. Período
// sem registros gera normalmente: o próprio documento diz "Nenhum registro no período" por seção.

import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ArrowLeft, FileText, Eye, Share2, TriangleAlert } = LucideIcons as any
import { REPORT_PERIOD_DAYS, type ReportPeriodDays } from '@dosiq/core/services/report'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import DocumentViewer from '@shared/components/ui/DocumentViewer'
import { useReportGeneration } from '@features/reports/hooks/useReportGeneration'

const PERIOD_LABELS: Record<ReportPeriodDays, string> = {
  7: '7 dias',
  30: '30 dias',
  90: '90 dias',
}

function PeriodSelector({
  period,
  disabled,
  onChange,
}: {
  period: ReportPeriodDays
  disabled: boolean
  onChange: (days: ReportPeriodDays) => void
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Período</Text>
      <View style={styles.periodRow} accessibilityRole="radiogroup">
        {REPORT_PERIOD_DAYS.map((days) => {
          const active = days === period
          return (
            <Pressable
              key={days}
              onPress={() => onChange(days)}
              disabled={disabled}
              style={[styles.periodBtn, active && styles.periodBtnActive, disabled && !active && styles.dimmed]}
              accessibilityRole="radio"
              accessibilityLabel={`Últimos ${PERIOD_LABELS[days]}`}
              accessibilityState={{ selected: active, checked: active, disabled }}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{PERIOD_LABELS[days]}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export default function ReportScreen() {
  const navigation = useNavigation()
  const { period, setPeriod, status, error, actionError, viewerUri, generate, share, view, closeViewer } =
    useReportGeneration()
  const loading = status === 'loading'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Relatório em PDF
        </Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          Um resumo dos tratamentos, das tomadas e das mudanças no período, para levar à consulta.
        </Text>

        <PeriodSelector period={period} disabled={loading} onChange={setPeriod} />

        {status === 'ready' ? (
          <View style={styles.readyCard} accessibilityLiveRegion="polite">
            <View style={styles.readyHeader}>
              <FileText size={20} color={colors.primary[600]} strokeWidth={2} />
              <Text style={styles.readyTitle}>Relatório pronto</Text>
            </View>
            <Text style={styles.readySub}>Últimos {PERIOD_LABELS[period]}</Text>

            <Pressable
              onPress={view}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Visualizar o relatório"
            >
              <Eye size={18} color={colors.text.primary} strokeWidth={2} />
              <Text style={styles.btnSecondaryText}>Visualizar</Text>
            </Pressable>
            <Pressable
              onPress={share}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Salvar ou Compartilhar o relatório"
            >
              <Share2 size={18} color={colors.text.inverse} strokeWidth={2} />
              <Text style={styles.btnPrimaryText}>Salvar ou Compartilhar</Text>
            </Pressable>

            {actionError ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {actionError}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            {status === 'error' && error ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={generate}
              disabled={loading}
              style={({ pressed }) => [styles.btnPrimary, loading && styles.btnDisabled, pressed && !loading && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={status === 'error' ? 'Tentar de novo' : 'Gerar relatório'}
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.btnPrimaryText}>{status === 'error' ? 'Tentar de novo' : 'Gerar relatório'}</Text>
              )}
            </Pressable>
            {loading ? (
              <Text style={styles.hint} accessibilityLiveRegion="polite">
                Gerando o relatório… pode levar alguns segundos.
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.warningRow}>
          <TriangleAlert size={14} color={colors.status.warning} strokeWidth={2} />
          <Text style={styles.warningText}>
            O app não guarda o relatório: para mantê-lo, use “Salvar ou Compartilhar” antes de sair.
          </Text>
        </View>
      </ScrollView>

      <DocumentViewer
        source={viewerUri ? { kind: 'pdf', uri: viewerUri } : null}
        title="Relatório em PDF"
        onClose={closeViewer}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing[5],
    paddingBottom: spacing[8],
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: spacing[5],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  periodBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  periodTextActive: {
    color: colors.text.inverse,
  },
  dimmed: {
    opacity: 0.5,
  },
  readyCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  readyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  readySub: {
    fontSize: 13,
    color: colors.text.muted,
  },
  btnPrimary: {
    flexDirection: 'row',
    gap: spacing[2],
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  btnSecondary: {
    flexDirection: 'row',
    gap: spacing[2],
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  hint: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  errorText: {
    fontSize: 13,
    color: colors.status.error,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.status.warning + '1A',
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
})
