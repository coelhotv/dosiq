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
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, Pencil, Trash2, Layers, Package } = LucideIcons as any
import MedicineIcon from '@shared/components/ui/MedicineIcon'

import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import DeleteConfirmation from '@shared/components/feedback/DeleteConfirmation'
import { ROUTES } from '@navigation/routes'
import { useMedicine } from '@medications/hooks/useMedicines'
import { useMedicineDelete } from '@medications/hooks/useMedicineDelete'
import { MedicineDeleteBlockedSheet } from '@medications/components/MedicineDeleteBlockedSheet'
import { formatConcentration, PRESENTATION_LABELS, isLiquidMedicine } from '@dosiq/core'
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

function KVRow({ label, value, isLast = false }) {
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
function MedicineDetailHeader({ onBack, onEdit, hasData }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <ChevronLeft size={24} color={colors.text.primary} />
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Editar medicamento"
          disabled={!hasData}
        >
          <Pencil
            size={22}
            color={hasData ? colors.text.primary : colors.text.muted}
          />
        </Pressable>
      </View>
    </View>
  )
}

function MedicineDetailHero({ type, name, doseLabel, active_ingredient, isTitrating, medicine }) {
  return (
    <View style={styles.heroCard}>
      <View
        style={[
          styles.heroIconWrap,
          {
            backgroundColor:
              type === 'suplemento' ? colors.supplement[50] : colors.primary[50],
          },
        ]}
      >
        <MedicineIcon
          medicine={medicine}
          size={48}
          color={type === 'suplemento' ? colors.supplement[500] : colors.primary[500]}
        />
      </View>
      <View style={styles.heroBody}>
        <View style={styles.heroNameRow}>
          <Text style={styles.heroName} numberOfLines={2}>
            {name}
          </Text>
          {doseLabel && (
            <View style={styles.dosePill}>
              <Text style={styles.dosePillText}>{doseLabel}</Text>
            </View>
          )}
        </View>
        {active_ingredient && (
          <Text style={styles.heroIngredient} numberOfLines={2}>
            {active_ingredient}
          </Text>
        )}
        <View style={styles.heroBadges}>
          <View style={[styles.badge, styles.badgeSuccess]}>
            <Text style={[styles.badgeText, styles.badgeTextSuccess]}>
              {isTitrating ? 'TITULANDO' : 'ESTÁVEL'}
            </Text>
          </View>
          <View style={[styles.badge, styles.badgeNeutral]}>
            <Text style={[styles.badgeText, styles.badgeTextNeutral]}>
              {(type ?? '—').toString().toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function MedicineDetailIdentification({
  typeLabel,
  presentation,
  shelf_life_days,
  active_ingredient,
  laboratory,
  therapeutic_class,
  regulatory_category,
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>IDENTIFICAÇÃO</Text>
      <View style={styles.sectionCard}>
        <KVRow label="Tipo" value={typeLabel} />
        <KVRow
          label="Apresentação"
          value={PRESENTATION_LABELS[presentation] ?? presentation}
        />
        {presentation === 'injetavel' && shelf_life_days ? (
          <KVRow
            label="Validade após aberto"
            value={`${shelf_life_days} dias`}
          />
        ) : null}
        <KVRow label="Princípio Ativo" value={active_ingredient} />
        <KVRow label="Laboratório" value={laboratory} />
        <KVRow label="Classe Terapêutica" value={therapeutic_class} />
        <KVRow
          label="Categoria Regulatória"
          value={regulatory_category}
          isLast
        />
      </View>
    </View>
  )
}

function MedicineDetailDosage({ dosage_per_pill, dosage_unit, concentration_volume_ml }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>DOSAGEM</Text>
      <View style={styles.sectionCard}>
        <KVRow
          label="Concentração"
          value={
            dosage_per_pill
              ? formatConcentration(dosage_per_pill, dosage_unit, concentration_volume_ml)
              : null
          }
          isLast
        />
      </View>
    </View>
  )
}

function MedicineDetailUsage({
  protocols,
  protocolsSummary,
  stockSummary,
  hideDelete,
  onDeletePress,
  deleteLoading,
}) {
  return (
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

      {/* Botão Excluir medicamento — oculto quando vindo de um tratamento
          (exclusão bloqueada por dependência; ação morta) */}
      {!hideDelete && (
        <Pressable
          onPress={onDeletePress}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.deleteButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Excluir medicamento"
          disabled={deleteLoading}
        >
          <Trash2 size={18} color={colors.status.error} />
          <Text style={styles.deleteButtonText}>Excluir medicamento</Text>
        </Pressable>
      )}
    </View>
  )
}

function useMedicineDetailState() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const id = route.params?.id
  // Vindo do detalhe de um tratamento: a exclusão é sempre bloqueada (medicamento
  // tem dependência), então ocultamos o botão pra não exibir ação morta.
  const hideDelete = route.params?.hideDelete === true
  const { data, loading, error, refresh } = useMedicine(id)
  const { preCheck, confirmDelete, isLoading: deleteLoading } = useMedicineDelete(data)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [blockedOpen, setBlockedOpen] = useState(false)

  const {
    type,
    name,
    active_ingredient,
    presentation,
    shelf_life_days,
    laboratory,
    therapeutic_class,
    regulatory_category,
    dosage_per_pill,
    dosage_unit,
    concentration_volume_ml,
    id: dataId,
    protocols: protocolsData,
  } = data || {}

  // Memos
  const typeLabel = useMemo(() => {
    if (!type) return '—'
    return TYPE_LABELS[type] ?? capitalize(type)
  }, [type])

  const doseLabel = useMemo(() => {
    if (!dosage_per_pill) return null
    return formatConcentration(dosage_per_pill, dosage_unit, concentration_volume_ml)
  }, [dosage_per_pill, dosage_unit, concentration_volume_ml])

  const protocols = useMemo(() => {
    if (!protocolsData || !Array.isArray(protocolsData)) return []
    return protocolsData
  }, [protocolsData])

  const isTitrating = useMemo(
    () => protocols.some((p) => p?.titration_status === 'titulando'),
    [protocols],
  )

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
    if (!data?.stock || data.stock.length === 0) return null
    const totalUnits = data.stock.reduce((acc, s) => acc + (Number(s?.quantity) || 0), 0)
    if (totalUnits <= 0) return null
    // Líquido: saldo é em ml (022). B4 ajustará protocols não-diários p/ doses.
    const unitLabel = isLiquidMedicine(data) ? 'ml' : 'un.'
    return `${totalUnits} ${unitLabel}`
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

  const handleOpenProtocol = useCallback((protocolId) => {
    setBlockedOpen(false)
    navigation.navigate(ROUTES.TREATMENTS, {
      screen: ROUTES.PROTOCOL_DETAIL,
      params: { id: protocolId },
    })
  }, [navigation])

  const handleOpenStock = useCallback(() => {
    setBlockedOpen(false)
    navigation.navigate(ROUTES.STOCK, {
      screen: ROUTES.STOCK_DETAIL,
      params: { medicineId: dataId, medicineName: name },
    })
  }, [navigation, dataId, name])

  return {
    data,
    loading,
    error,
    refresh,
    preCheck,
    deleteLoading,
    deleteOpen,
    setDeleteOpen,
    blockedOpen,
    setBlockedOpen,
    hideDelete,
    type,
    name,
    active_ingredient,
    presentation,
    shelf_life_days,
    laboratory,
    therapeutic_class,
    regulatory_category,
    dosage_per_pill,
    dosage_unit,
    concentration_volume_ml,
    typeLabel,
    doseLabel,
    protocols,
    isTitrating,
    protocolsSummary,
    stockSummary,
    handleBack,
    handleEdit,
    handleDeletePress,
    handleDeleteConfirm,
    handleOpenProtocol,
    handleOpenStock,
  }
}

export default function MedicineDetailScreen() {
  const state = useMedicineDetailState()

  if (state.loading) {
    return (
      <ScreenContainer>
        <MedicineDetailHeader onBack={state.handleBack} onEdit={state.handleEdit} hasData={false} />
        <LoadingState />
      </ScreenContainer>
    )
  }

  if (state.error) {
    return (
      <ScreenContainer>
        <MedicineDetailHeader onBack={state.handleBack} onEdit={state.handleEdit} hasData={false} />
        <ErrorState message={state.error} onRetry={state.refresh} />
      </ScreenContainer>
    )
  }

  if (!state.data) {
    return (
      <ScreenContainer>
        <MedicineDetailHeader onBack={state.handleBack} onEdit={state.handleEdit} hasData={false} />
        <ErrorState message="Medicamento não encontrado" onRetry={state.refresh} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <MedicineDetailHeader onBack={state.handleBack} onEdit={state.handleEdit} hasData={true} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MedicineDetailHero
          type={state.type}
          name={state.name}
          doseLabel={state.doseLabel}
          active_ingredient={state.active_ingredient}
          isTitrating={state.isTitrating}
          medicine={state.data}
        />

        <MedicineDetailIdentification
          typeLabel={state.typeLabel}
          presentation={state.presentation}
          shelf_life_days={state.shelf_life_days}
          active_ingredient={state.active_ingredient}
          laboratory={state.laboratory}
          therapeutic_class={state.therapeutic_class}
          regulatory_category={state.regulatory_category}
        />

        <MedicineDetailDosage
          dosage_per_pill={state.dosage_per_pill}
          dosage_unit={state.dosage_unit}
          concentration_volume_ml={state.concentration_volume_ml}
        />

        <MedicineDetailUsage
          protocols={state.protocols}
          protocolsSummary={state.protocolsSummary}
          stockSummary={state.stockSummary}
          hideDelete={state.hideDelete}
          onDeletePress={state.handleDeletePress}
          deleteLoading={state.deleteLoading}
        />
      </ScrollView>

      <DeleteConfirmation
        visible={state.deleteOpen}
        title="Remover medicamento"
        description="Esta ação não pode ser desfeita."
        itemName={state.name}
        confirmLabel="Remover"
        isLoading={state.deleteLoading}
        onCancel={() => state.setDeleteOpen(false)}
        onConfirm={state.handleDeleteConfirm}
      />

      <MedicineDeleteBlockedSheet
        visible={state.blockedOpen}
        medicineName={state.name}
        protocols={state.preCheck.protocols}
        stockUnits={state.preCheck.stockUnits}
        stockLots={state.preCheck.stockLots}
        onCancel={() => state.setBlockedOpen(false)}
        onOpenProtocol={state.handleOpenProtocol}
        onOpenStock={state.handleOpenStock}
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
