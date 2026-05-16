// MedicineDetailScreen.jsx — detalhe do medicamento (Sprint M1.1 Fase 1)
// Layout: header fixo + hero card + sections (Identificação / Dosagem / Em uso)

import { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import {
  ChevronLeft,
  Pencil,
  Trash2,
  Pill,
  PillBottle,
  Layers,
  Package,
} from 'lucide-react-native'

import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import DeleteConfirmation from '@shared/components/feedback/DeleteConfirmation'
import { ROUTES } from '@navigation/routes'
import { useMedicine } from '@medications/hooks/useMedicines'
import { useMedicineDelete } from '@medications/hooks/useMedicineDelete'
import { MedicineDeleteBlockedSheet } from '@medications/components/MedicineDeleteBlockedSheet'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'

const TYPE_LABELS = {
  medicamento: 'Medicamento',
  suplemento: 'Suplemento',
}

function capitalize(value) {
  if (!value || typeof value !== 'string') return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function KVRow({ label, value, isLast }) {
  return (
    <View style={[styles.kvRow, isLast && styles.kvRowLast]}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={2}>
        {displayValue(value)}
      </Text>
    </View>
  )
}

// eslint-disable-next-line max-lines-per-function
export default function MedicineDetailScreen() {
  // States (via hooks)
  const navigation = useNavigation()
  const route = useRoute()
  const id = route.params?.id
  const { data, loading, error, refresh } = useMedicine(id)
  const { preCheck, confirmDelete, isLoading: deleteLoading } = useMedicineDelete(data)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [blockedOpen, setBlockedOpen] = useState(false)

  // Memos
  const typeLabel = useMemo(() => {
    if (!data?.type) return '—'
    return TYPE_LABELS[data.type] ?? capitalize(data.type)
  }, [data])

  const doseLabel = useMemo(() => {
    if (!data?.dosage_per_pill) return null
    const unit = data.dosage_unit ?? ''
    return `${data.dosage_per_pill}${unit ? ` ${unit}` : ''}`
  }, [data])

  const protocols = useMemo(() => {
    if (!data?.protocols || !Array.isArray(data.protocols)) return []
    return data.protocols
  }, [data])

  const protocolsSummary = useMemo(() => {
    if (protocols.length === 0) return null
    const labels = protocols
      .map((p) => p?.short_name ?? p?.acronym ?? p?.name ?? '')
      .filter(Boolean)
      .slice(0, 3)
      .join(' · ')
    return labels || null
  }, [protocols])

  const stockSummary = useMemo(() => {
    const stock = Array.isArray(data?.stock) ? data.stock : []
    if (stock.length === 0) return null
    const totalUnits = stock.reduce((acc, s) => acc + (Number(s?.quantity) || 0), 0)
    if (totalUnits <= 0) return null
    return `${totalUnits} un.`
  }, [data])

  // Effects
  // Refresh ao voltar da tela de edição (route focus)
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh])
  )

  // Handlers
  const handleBack = useCallback(() => navigation.goBack(), [navigation])
  const handleEdit = useCallback(() => {
    if (!data) return
    navigation.navigate(ROUTES.MEDICINE_EDIT, { medicine: data })
  }, [data, navigation])

  const handleDeletePress = useCallback(() => {
    if (!data) return
    if (!preCheck.canDelete) {
      setBlockedOpen(true)
      return
    }
    setDeleteOpen(true)
  }, [data, preCheck])

  const handleDeleteConfirm = useCallback(async () => {
    await confirmDelete()
    setDeleteOpen(false)
  }, [confirmDelete])

  const handleOpenTreatments = useCallback(() => {
    setBlockedOpen(false)
    navigation.navigate(ROUTES.TREATMENTS_LIST)
  }, [navigation])

  // Header (reaproveitado em todos os estados)
  const Header = (
    <View style={styles.header}>
      <Pressable
        onPress={handleBack}
        hitSlop={8}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <ChevronLeft size={24} color={colors.text.primary} />
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable
          onPress={handleEdit}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Editar medicamento"
          disabled={!data}
        >
          <Pencil
            size={22}
            color={data ? colors.text.primary : colors.text.muted}
          />
        </Pressable>
      </View>
    </View>
  )

  if (loading) {
    return (
      <ScreenContainer>
        {Header}
        <LoadingState />
      </ScreenContainer>
    )
  }

  if (error) {
    return (
      <ScreenContainer>
        {Header}
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    )
  }

  if (!data) {
    return (
      <ScreenContainer>
        {Header}
        <ErrorState message="Medicamento não encontrado" onRetry={refresh} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {Header}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View
            style={[
              styles.heroIconWrap,
              {
                backgroundColor:
                  data.type === 'suplemento' ? colors.supplement[50] : colors.primary[50],
              },
            ]}
          >
            {data.type === 'suplemento' ? (
              <PillBottle size={48} color={colors.supplement[500]} />
            ) : (
              <Pill size={48} color={colors.primary[500]} />
            )}
          </View>
          <View style={styles.heroBody}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName} numberOfLines={2}>
                {data.name}
              </Text>
              {doseLabel && (
                <View style={styles.dosePill}>
                  <Text style={styles.dosePillText}>{doseLabel}</Text>
                </View>
              )}
            </View>
            {data.active_ingredient && (
              <Text style={styles.heroIngredient} numberOfLines={2}>
                {data.active_ingredient}
              </Text>
            )}
            <View style={styles.heroBadges}>
              <View style={[styles.badge, styles.badgeSuccess]}>
                <Text style={[styles.badgeText, styles.badgeTextSuccess]}>
                  ESTÁVEL
                </Text>
              </View>
              <View style={[styles.badge, styles.badgeNeutral]}>
                <Text style={[styles.badgeText, styles.badgeTextNeutral]}>
                  {(data.type ?? '—').toString().toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Identificação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IDENTIFICAÇÃO</Text>
          <View style={styles.sectionCard}>
            <KVRow label="Tipo" value={typeLabel} />
            <KVRow label="Princípio Ativo" value={data.active_ingredient} />
            <KVRow label="Laboratório" value={data.laboratory} />
            <KVRow label="Classe Terapêutica" value={data.therapeutic_class} />
            <KVRow
              label="Categoria Regulatória"
              value={data.regulatory_category}
              isLast
            />
          </View>
        </View>

        {/* Dosagem */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOSAGEM</Text>
          <View style={styles.sectionCard}>
            <KVRow
              label="Dose por unidade"
              value={
                data.dosage_per_pill
                  ? `${data.dosage_per_pill} ${data.dosage_unit ?? ''}`.trim()
                  : null
              }
              isLast
            />
          </View>
        </View>

        {/* Em uso */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EM USO</Text>

          {/* Card tratamentos */}
          <View style={styles.useCard}>
            <View style={[styles.useIconWrap, styles.useIconWrapPrimary]}>
              <Layers size={18} color={colors.primary[700]} />
            </View>
            <Text style={styles.useLabel}>
              {protocols.length === 0
                ? 'Sem tratamentos associados'
                : `${protocols.length} ${protocols.length === 1 ? 'tratamento associado' : 'tratamentos associados'}`}
            </Text>
            {protocolsSummary ? (
              <Text style={styles.useMeta} numberOfLines={1}>
                {protocolsSummary}
              </Text>
            ) : null}
          </View>

          {/* Card estoque */}
          <View style={styles.useCard}>
            <View style={[styles.useIconWrap, styles.useIconWrapSupplement]}>
              <Package size={18} color={colors.supplement[700]} />
            </View>
            <Text style={styles.useLabel}>Estoque</Text>
            <Text style={styles.useMeta}>{stockSummary ?? 'Não rastreado'}</Text>
          </View>

          {/* Botão Excluir medicamento */}
          <Pressable
            onPress={handleDeletePress}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Excluir medicamento"
            disabled={!data || deleteLoading}
          >
            <Trash2 size={18} color={colors.status.error} />
            <Text style={styles.deleteButtonText}>Excluir medicamento</Text>
          </Pressable>
        </View>
      </ScrollView>

      <DeleteConfirmation
        visible={deleteOpen}
        title="Remover medicamento"
        description="Esta ação não pode ser desfeita."
        itemName={data?.name}
        confirmLabel="Remover"
        isLoading={deleteLoading}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      <MedicineDeleteBlockedSheet
        visible={blockedOpen}
        medicineName={data?.name}
        protocols={preCheck.protocols}
        stockUnits={preCheck.stockUnits}
        stockLots={preCheck.stockLots}
        onCancel={() => setBlockedOpen(false)}
        onOpenTreatments={handleOpenTreatments}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.bg.screen,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconButton: {
    padding: spacing[1],
    borderRadius: borderRadius.sm,
  },

  // Scroll
  scrollContent: {
    paddingBottom: spacing[8],
  },

  // Hero
  heroCard: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    gap: spacing[4],
    ...shadows.sm,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    gap: spacing[2],
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  heroName: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    lineHeight: 28,
  },
  dosePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  heroIngredient: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  badgeSuccess: {
    backgroundColor: colors.status.success + '20',
  },
  badgeNeutral: {
    backgroundColor: colors.neutral[200],
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  badgeTextSuccess: {
    color: colors.status.success,
  },
  badgeTextNeutral: {
    color: colors.neutral[700],
  },

  // Sections
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.text.muted,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  sectionCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  // KV rows
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[3],
  },
  kvRowLast: {
    borderBottomWidth: 0,
  },
  kvLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    flexShrink: 0,
  },
  kvValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },

  // Empty
  emptyText: {
    fontSize: 13,
    color: colors.text.muted,
    paddingVertical: spacing[3],
    textAlign: 'center',
  },

  // Em uso — cards
  useCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  useIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useIconWrapPrimary: {
    backgroundColor: colors.primary[50],
  },
  useIconWrapSupplement: {
    backgroundColor: colors.supplement[50],
  },
  useLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  useMeta: {
    fontSize: 12,
    color: colors.text.muted,
    flexShrink: 1,
  },

  // Botão excluir (outline danger)
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.status.error,
  },
})
