// SettingsScreen.jsx — Configurações (Fase 4): densidade da interface + estoque + fuso horário + segurança
// R-010: States → Memos → Effects → Handlers

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, ChevronRight, AlignLeft, Sparkles, LayoutGrid, Shield, Trash2, Globe, Package, } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { useProfile } from '@profile/hooks/useProfile'
import { useProfileMutation } from '@profile/hooks/useProfileMutation'
import { useStockToggle } from '@profile/hooks/useStockToggle'
import { useToast } from '@shared/components/feedback/Toast'
import FormSelect from '@shared/components/form/FormSelect'
import { TIMEZONE_OPTIONS } from '@dosiq/core'
import TzIntentSheet from '@profile/components/TzIntentSheet'
import StockFreezeSheet from '@profile/components/StockFreezeSheet'
import StockReconcileSheet from '@profile/components/StockReconcileSheet'

// ─── Opções de densidade ──────────────────────────────────────────────────────

const DENSITY_OPTIONS = [
  {
    value: 'simple',
    label: 'Padrão',
    Icon: AlignLeft,
    description: 'Textos maiores e foco no essencial',
  },
  {
    value: null,
    label: 'Automático',
    Icon: Sparkles,
    description: 'Ajusta pelos seus tratamentos',
  },
  {
    value: 'complex',
    label: 'Detalhado',
    Icon: LayoutGrid,
    description: 'Gráficos e visões técnicas',
  },
]

function complexityLabel(value) {
  const match = DENSITY_OPTIONS.find((o) => o.value === (value ?? null))
  return match?.label ?? 'Automático'
}

// ─── Sub-componente: opções de densidade ─────────────────────────────────────

function DensityOptions({ currentComplexity, activeLabel, onSelect }) {
  return (
    <>
      <View style={styles.densityRow}>
        {DENSITY_OPTIONS.map((option) => {
          const selected = (option.value ?? null) === (currentComplexity ?? null)
          return (
            <Pressable
              key={String(option.value)}
              style={[styles.densityCard, selected && styles.densityCardSelected]}
              onPress={() => onSelect(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
            >
              <option.Icon
                size={20}
                color={selected ? colors.primary[600] : colors.text.muted}
              />
              <Text style={[styles.densityCardLabel, selected && styles.densityCardLabelSelected]}>
                {option.label}
              </Text>
              <Text style={styles.densityCardDesc}>{option.description}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.densityCaption}>Ativo: {activeLabel}</Text>
    </>
  )
}

// ─── Sub-componente: secção de segurança ─────────────────────────────────────

function SecuritySection({ onChangePassword, onDeleteAccount }) {
  return (
    <>
      <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
        <Shield size={12} color={colors.text.muted} />
        <Text style={styles.sectionLabelText}>SEGURANÇA</Text>
      </View>
      <View style={styles.card}>
        <Pressable style={styles.securityRow} onPress={onChangePassword}
          accessibilityRole="button" accessibilityLabel="Alterar senha">
          <View style={styles.securityInfo}>
            <Text style={styles.securityRowTitle}>Alterar senha</Text>
            <Text style={styles.securityRowSub}>Última alteração: nunca</Text>
          </View>
          <Text style={styles.securityAction}>Alterar</Text>
          <ChevronRight size={16} color={colors.primary[500]} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.securityRow} onPress={onDeleteAccount}
          accessibilityRole="button" accessibilityLabel="Excluir minha conta">
          <View style={styles.deleteIconBg}>
            <Trash2 size={16} color={colors.status.error} />
          </View>
          <View style={styles.securityInfo}>
            <Text style={styles.securityRowTitle}>Excluir minha conta</Text>
            <Text style={styles.securityRowSub}>
              Remove acesso e apaga todos os dados. Bloqueado se houver tratamentos ativos.
            </Text>
          </View>
          <ChevronRight size={16} color={colors.text.muted} />
        </Pressable>
      </View>
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

function SettingsHeader({ onGoBack }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onGoBack}
        style={styles.headerBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <ChevronLeft size={24} color={colors.text.primary} />
      </Pressable>
      <Text style={styles.title}>Configurações</Text>
      <View style={styles.headerSpacer} />
    </View>
  )
}

function PreferencesCard({ loading, currentComplexity, activeLabel, onSelect }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Densidade de informação</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary[500]} style={styles.loader} />
      ) : (
        <DensityOptions
          currentComplexity={currentComplexity}
          activeLabel={activeLabel}
          onSelect={onSelect}
        />
      )}
    </View>
  )
}

// ─── Sub-componente: controle de estoque (spec 044 · T013) ───────────────────

/**
 * Subtítulo por estado (§5 das decisões de design):
 *  on                → saldos e avisos ativos
 *  off + já congelou → desligado (o saldo está guardado)
 *  off + nunca teve  → convite + hint do que acontece ao ativar
 */
function stockSubtitle(enabled, neverHadStock) {
  if (enabled) return 'Saldos e avisos de reposição ativos.'
  if (neverHadStock) return 'Avisa quando o remédio estiver acabando.'
  return 'Desligado — só lembretes e registro de doses.'
}

function StockCard({ ready, enabled, neverHadStock, busy, onToggle }) {
  const subtitle = stockSubtitle(enabled, neverHadStock)

  return (
    <View style={styles.card}>
      <View style={styles.stockRow}>
        <View style={styles.stockInfo}>
          <Text style={styles.securityRowTitle}>Controle de estoque</Text>
          <Text style={styles.securityRowSub}>{subtitle}</Text>
          {!enabled && neverHadStock ? (
            <Text style={styles.stockHint}>
              Ao ativar, a gente pergunta quanto você tem de cada remédio agora.
            </Text>
          ) : null}
        </View>
        {ready && !busy ? (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.neutral[300], true: colors.primary[500] }}
            thumbColor={colors.bg.card}
            accessibilityRole="switch"
            accessibilityLabel={
              enabled ? 'Controle de estoque ativado' : 'Controle de estoque desativado'
            }
            accessibilityState={{ checked: enabled }}
          />
        ) : (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        )}
      </View>
    </View>
  )
}

function TimezoneCard({ loading, timezone, options, onChange }) {
  return (
    <View style={styles.card}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary[500]}
          style={styles.loader}
        />
      ) : (
        <FormSelect
          name="timezone"
          label={null}
          value={timezone}
          options={options}
          onChange={onChange}
          placeholder="Selecionar fuso"
        />
      )}
    </View>
  )
}

export default function SettingsScreen() {
  // States (navigation faz parte da inicialização, não é estado reativo)
  const navigation = useNavigation()

  // States
  const [tzPrompt, setTzPrompt] = useState(null) // { fromTz, toTz } enquanto o sheet está aberto
  const [tzApplying, setTzApplying] = useState<'travel' | 'move' | false>(false)

  // Memos/hooks de dados
  const { profile, settings, loading: profileLoading, refresh, updateTimezone, checkFuturePendingDoses } = useProfile()
  const { setComplexity, loading: mutating } = useProfileMutation()
  const stock = useStockToggle()
  const toast = useToast()

  const currentComplexity = useMemo(
    () => profile?.complexity_override ?? null,
    [profile],
  )

  const activeLabel = useMemo(
    () => complexityLabel(currentComplexity),
    [currentComplexity],
  )

  const currentTimezone = useMemo(
    () => settings?.timezone ?? 'America/Sao_Paulo',
    [settings],
  )

  // Effects — o anúncio da retomada/congelamento é TEXTUAL (leitor de tela), não só visual.
  const { announcement: stockAnnouncement, clearAnnouncement: clearStockAnnouncement } = stock
  useEffect(() => {
    if (!stockAnnouncement) return
    toast.show(stockAnnouncement, { variant: 'success' })
    clearStockAnnouncement()
  }, [stockAnnouncement, clearStockAnnouncement, toast])

  useEffect(() => {
    if (stock.error) toast.show(stock.error, { variant: 'error' })
  }, [stock.error, toast])

  // Handlers
  const persistTimezone = useCallback(
    async (value, { regen }) => {
      const res = await updateTimezone(value, { regen })
      if (res.success) {
        toast.show(regen ? 'Fuso e horários das doses atualizados' : 'Fuso horário salvo', { variant: 'success' })
      } else {
        toast.show(res.error ?? 'Erro ao salvar fuso horário', { variant: 'error' })
      }
      return res.success
    },
    [updateTimezone, toast],
  )

  const handleSelectTimezone = useCallback(
    async (_name, value) => {
      if (!value || value === currentTimezone) return
      // Sem dose futura, viagem×mudança não muda nada → persiste direto, sem prompt.
      const hasFuture = await checkFuturePendingDoses()
      if (!hasFuture) {
        await persistTimezone(value, { regen: false })
        return
      }
      setTzPrompt({ fromTz: currentTimezone, toTz: value })
    },
    [currentTimezone, checkFuturePendingDoses, persistTimezone],
  )

  // "Estou aqui só de viagem": persiste o tz, sem regenerar.
  // tzApplying='travel'/'move' → spinner só no botão acionado (TzIntentSheet).
  const handleTzTravel = useCallback(async () => {
    if (!tzPrompt) return
    setTzApplying('travel')
    await persistTimezone(tzPrompt.toTz, { regen: false })
    setTzApplying(false)
    setTzPrompt(null)
  }, [tzPrompt, persistTimezone])

  // "Me mudei": persiste o tz e re-ancora as doses futuras.
  const handleTzMove = useCallback(async () => {
    if (!tzPrompt) return
    setTzApplying('move')
    await persistTimezone(tzPrompt.toTz, { regen: true })
    setTzApplying(false)
    setTzPrompt(null)
  }, [tzPrompt, persistTimezone])

  const handleTzCancel = useCallback(() => setTzPrompt(null), [])
  const handleSelectDensity = useCallback(
    async (value) => {
      // Não disparar se já selecionado ou mutando
      if (value === currentComplexity || mutating) return
      const res = await setComplexity(value)
      if (res.success) {
        toast.show('Preferência salva', { variant: 'success' })
        refresh()
      } else {
        toast.show(res.error ?? 'Erro ao salvar preferência', { variant: 'error' })
      }
    },
    [currentComplexity, mutating, setComplexity, toast, refresh],
  )

  const handleChangePassword = useCallback(
    () => (navigation.navigate as any)(ROUTES.CHANGE_PASSWORD), [navigation])
  const handleDeleteAccount = useCallback(
    () => (navigation.navigate as any)(ROUTES.DELETE_ACCOUNT), [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader onGoBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Seção PREFERÊNCIAS ── */}
        <View style={styles.sectionLabel}>
          <Sparkles size={12} color={colors.text.muted} />
          <Text style={styles.sectionLabelText}>PREFERÊNCIAS</Text>
        </View>

        <PreferencesCard
          loading={profileLoading}
          currentComplexity={currentComplexity}
          activeLabel={activeLabel}
          onSelect={handleSelectDensity}
        />

        {/* ── Seção ESTOQUE (spec 044 · T013) ── */}
        <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
          <Package size={12} color={colors.text.muted} />
          <Text style={styles.sectionLabelText}>ESTOQUE</Text>
        </View>

        <StockCard
          ready={stock.ready}
          enabled={stock.enabled}
          neverHadStock={stock.neverHadStock}
          busy={stock.busy}
          onToggle={stock.requestToggle}
        />

        {/* ── Seção FUSO HORÁRIO ── */}
        <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
          <Globe size={12} color={colors.text.muted} />
          <Text style={styles.sectionLabelText}>FUSO HORÁRIO</Text>
        </View>

        <TimezoneCard
          loading={profileLoading}
          timezone={currentTimezone}
          options={TIMEZONE_OPTIONS}
          onChange={handleSelectTimezone}
        />

        {/* ── Seção SEGURANÇA ── */}
        <SecuritySection
          onChangePassword={handleChangePassword}
          onDeleteAccount={handleDeleteAccount}
        />
      </ScrollView>

      <StockFreezeSheet
        visible={stock.sheet === 'freeze'}
        applying={stock.busy}
        onConfirm={stock.confirmFreeze}
        onCancel={stock.closeSheet}
      />

      {/* Montagem condicional (não só `visible`): desmontar reseta o `choice` interno para o
          default "Começar do zero" — senão a escolha da tentativa anterior voltaria pré-marcada. */}
      {stock.sheet === 'reconcile' && stock.reconcile ? (
        <StockReconcileSheet
          gapDays={stock.reconcile.gapDays}
          pausedAt={stock.reconcile.pausedAt}
          applying={stock.busy}
          onZero={stock.resumeAndZero}
          onResume={stock.resumeAsIs}
          onClose={stock.closeSheet}
        />
      ) : null}

      <TzIntentSheet
        prompt={tzPrompt}
        applying={tzApplying}
        onTravel={handleTzTravel}
        onMove={handleTzMove}
        onCancel={handleTzCancel}
      />
    </SafeAreaView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

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
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  sectionLabelMargin: {
    marginTop: spacing[6],
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  loader: {
    marginVertical: spacing[4],
  },
  densityRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  densityCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    padding: spacing[3],
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.bg.screen,
  },
  densityCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  densityCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  densityCardLabelSelected: {
    color: colors.primary[700],
  },
  densityCardDesc: {
    fontSize: 10,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 13,
  },
  densityCaption: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing[3],
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
  },
  stockInfo: {
    flex: 1,
  },
  stockHint: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 16,
    marginTop: spacing[1],
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  securityInfo: {
    flex: 1,
  },
  securityRowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  securityRowSub: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 16,
  },
  securityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing[2],
    marginHorizontal: -spacing[1],
  },
  deleteIconBg: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
