// PurchaseCard.jsx — card de exibição de uma compra (histórico de estoque)
// Parte do fluxo S1.4 Wave 2 — visão detalhada de cada compra com barra de consumo

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Syringe } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { formatDateShortPtBR, computeExpiryDays, formatBRL, formatStockCount, stockUnitLabel, isLiquidMedicine, isBiologicallyExpired, biologicalExpiryDaysLeft, INJECTION_CONTAINER_SINGULAR, formatDose } from '@dosiq/core'

/**
 * @param {{
 *   purchase: {
 *     id: string,
 *     medicine_id: string,
 *     quantity_bought: number,
 *     unit_price: number,
 *     purchase_date: string,        // 'YYYY-MM-DD'
 *     expiration_date: string|null, // 'YYYY-MM-DD' ou null
 *     pharmacy: string|null,
 *     laboratory: string|null,
 *     notes: string|null,
 *   },
 *   remaining: number,              // saldo restante da entry do stock
 *   isLatest?: boolean,             // true se é a mais recente (badge "ÚLTIMA")
 *   onPress?: () => void            // tap leva pra editar compra
 * }} props
 */
// Helpers de derivação para simplificar a complexidade de PurchaseCard
function getRemainingText(remaining, isLiquid) {
  return isLiquid
    ? formatDose(remaining, 'ml')
    : `${remaining}`
}

function getBoughtText(purchase, medicine, isLiquid) {
  const containerLabel = isLiquid ? INJECTION_CONTAINER_SINGULAR[purchase.injection_container] : null
  if (containerLabel) {
    return `${formatDose(purchase.quantity_bought, 'ml')} (${containerLabel}) comprados`
  }
  return `${formatStockCount(purchase.quantity_bought, medicine)} ${isLiquid ? 'comprados' : 'compradas'}`
}

function getExpiryStatusColor(expiryDays) {
  if (expiryDays === null) return colors.neutral[400]
  if (expiryDays < 30) return colors.status.error
  if (expiryDays < 90) return colors.status.warning
  return colors.text.secondary
}

function getExpiryLabel(expirationDate, expiryDays) {
  if (!expirationDate) return null
  if (expiryDays === null || expiryDays < 0) return 'Vencido'
  if (expiryDays <= 60) return `Vence em ${expiryDays} ${expiryDays === 1 ? 'dia' : 'dias'}`
  return `Vence em ${formatDateShortPtBR(expirationDate)}`
}

function getTtlInfo(remaining, stockEntry, medicine) {
  const showTtlAlert = remaining > 0 && stockEntry !== null
  if (!showTtlAlert) {
    return { showTtlBadge: false, ttlLabel: null, ttlExpired: false }
  }

  const ttlExpired = isBiologicallyExpired(stockEntry, medicine)
  const ttlDaysLeft = biologicalExpiryDaysLeft(stockEntry, medicine)
  const showTtlBadge = ttlExpired || (ttlDaysLeft !== null && ttlDaysLeft >= 0 && ttlDaysLeft <= 3)

  let ttlLabel = null
  if (ttlExpired) {
    ttlLabel = 'Vencido (validade após aberto)'
  } else if (ttlDaysLeft === 0) {
    ttlLabel = 'Vence hoje (validade após aberto)'
  } else if (ttlDaysLeft === 1) {
    ttlLabel = 'Vence amanhã (validade após aberto)'
  } else if (ttlDaysLeft !== null) {
    ttlLabel = `Vence em ${ttlDaysLeft} dias (validade após aberto)`
  }

  return { showTtlBadge, ttlLabel, ttlExpired }
}

function PurchaseCardHeader({ purchaseDateFormatted, isLatest }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.purchaseDate}>{purchaseDateFormatted}</Text>
        {isLatest && (
          <View style={styles.badgeLatest}>
            <Text style={styles.badgeLatestText}>ÚLTIMA</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function PurchaseCardQuantity({ boughtText, isInUse, remainingText }) {
  return (
    <View style={styles.quantityRow}>
      <Text style={styles.quantityText}>{boughtText}</Text>
      <Text style={styles.quantityDot}> · </Text>
      <Text style={[styles.quantityText, { color: isInUse ? colors.status.success : colors.text.muted }]}>
        {remainingText} restantes
      </Text>
    </View>
  )
}

function PurchaseCardCost({ isFree, unitLabel, totalCost, unitPrice }) {
  return (
    <View style={styles.costRow}>
      <Text style={styles.costLabel}>Custo: </Text>
      {isFree ? (
        <Text style={styles.costValue}>Grátis</Text>
      ) : (
        <>
          <Text style={styles.costValue}>
            {formatBRL(unitPrice)} por {unitLabel}
          </Text>
          <Text style={styles.costDot}> · </Text>
          <Text style={styles.costValue}>Total {formatBRL(totalCost)}</Text>
        </>
      )}
    </View>
  )
}

function PurchaseCardBottomInfo({ pharmacy, laboratory }) {
  if (!pharmacy && !laboratory) return null
  return (
    <View style={styles.bottomInfo}>
      {pharmacy && <Text style={styles.bottomInfoText}>{pharmacy}</Text>}
      {pharmacy && laboratory && <Text style={styles.bottomInfoDot}> · </Text>}
      {laboratory && <Text style={styles.bottomInfoText}>{laboratory}</Text>}
    </View>
  )
}

export default function PurchaseCard({ purchase, remaining = 0, isLatest = false, onPress, medicine = null, stockEntry = null }) {
  // States (R-010 — ordem critica antes de derivações)
  // Nenhum hook complexo — apenas useMemo se houver heavy computation

  // Derivações
  // Líquidos (022): quantidades em ml, custo por ml.
  const isLiquid = isLiquidMedicine(medicine)
  const unitLabel = stockUnitLabel(medicine)
  const remainingText = getRemainingText(remaining, isLiquid)
  
  // 012 B4 (ADR-068): contextualiza o lote injetável com a apresentação (caneta/refil/…)
  // — "0,5 ml (caneta) comprados". 'ml' é masculino → "comprados"; unidades → "compradas".
  const boughtText = getBoughtText(purchase, medicine, isLiquid)
  const isInUse = remaining > 0
  const expiryDays = purchase.expiration_date ? computeExpiryDays(purchase.expiration_date) : null
  const purchaseDateFormatted = formatDateShortPtBR(purchase.purchase_date)
  const totalCost = purchase.unit_price * purchase.quantity_bought
  // Grátis: medicamentos distribuídos pelo SUS / Farmácia Popular (preço zero/nulo)
  const isFree = !(purchase.unit_price > 0)
  const expiryStatusColor = getExpiryStatusColor(expiryDays)

  // Contagem de dias só ajuda para validade próxima (<=60d). Para datas longas,
  // "vence em 680 dias" não é projetável — mostra a data formatada.
  const expiryLabel = getExpiryLabel(purchase.expiration_date, expiryDays)

  // Eixo de validade biológica TTL pós-abertura (012 Fase A) — paralelo ao volume.
  // Ativo somente com stockEntry.opened_at + medicine.shelf_life_days presentes.
  const { showTtlBadge, ttlLabel, ttlExpired } = getTtlInfo(remaining, stockEntry, medicine)

  const card = (
    <View
      style={[
        styles.card,
        isLatest && styles.cardLatest,
      ]}
    >
      <PurchaseCardHeader purchaseDateFormatted={purchaseDateFormatted} isLatest={isLatest} />
      <PurchaseCardQuantity boughtText={boughtText} isInUse={isInUse} remainingText={remainingText} />
      <PurchaseCardCost isFree={isFree} unitLabel={unitLabel} totalCost={totalCost} unitPrice={purchase.unit_price} />
      <PurchaseCardBottomInfo pharmacy={purchase.pharmacy} laboratory={purchase.laboratory} />

      {/* Validade (se expiration_date) */}
      {expiryLabel && (
        <View style={styles.expiryChip}>
          <Text style={[styles.expiryText, { color: expiryStatusColor }]}>
            {expiryLabel}
          </Text>
        </View>
      )}

      {/* Validade biológica TTL pós-abertura (012 Fase A) — eixo paralelo ao volume */}
      {showTtlBadge && ttlLabel && (
        <View style={[styles.ttlChip, ttlExpired ? styles.ttlChipExpired : styles.ttlChipWarning]}>
          <Syringe
            size={12}
            color={colors.status.error}
            strokeWidth={2.5}
          />
          <Text style={[styles.ttlText, { color: colors.status.error }]}>
            {ttlLabel}
          </Text>
        </View>
      )}
    </View>
  )

  if (!onPress) return card

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={`Editar compra de ${purchase.quantity_bought} unidades do ${purchaseDateFormatted}`}
    >
      {card}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Card base com borda sutil
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing[3],
    gap: spacing[2],
  },

  // Destaque para última compra
  cardLatest: {
    borderColor: colors.primary[200],
    borderWidth: 1.5,
  },

  // Header com data + badge
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
    flexWrap: 'wrap',
  },

  purchaseDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Badge "ÚLTIMA"
  badgeLatest: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.primary[200],
  },

  badgeLatestText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary[700],
    letterSpacing: 0.5,
  },

  // Linha de quantidades
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  quantityText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },

  quantityDot: {
    fontSize: 13,
    color: colors.text.muted,
    marginHorizontal: 2,
  },

  // Linha de custo
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: spacing[1],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  costLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },

  costValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },

  costDot: {
    fontSize: 12,
    color: colors.text.muted,
    marginHorizontal: 2,
  },

  // Informações inferiores (farmácia, laboratório)
  bottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  bottomInfoText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.muted,
  },

  bottomInfoDot: {
    fontSize: 12,
    color: colors.text.muted,
    marginHorizontal: 2,
  },

  // Chip de validade
  expiryChip: {
    marginTop: spacing[1],
  },

  expiryText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Chip de validade biológica TTL (012 Fase A)
  ttlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
    minHeight: 28,
  },

  ttlChipExpired: {
    backgroundColor: colors.status.errorLight,
    borderColor: colors.status.error,
  },

  ttlChipWarning: {
    backgroundColor: colors.status.warningLight,
    borderColor: colors.status.warning,
  },

  ttlText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Feedback de tap
  pressed: {
    opacity: 0.7,
  },
})
