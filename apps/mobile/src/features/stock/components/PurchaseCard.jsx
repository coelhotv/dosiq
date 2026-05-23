// PurchaseCard.jsx — card de exibição de uma compra (histórico de estoque)
// Parte do fluxo S1.4 Wave 2 — visão detalhada de cada compra com barra de consumo

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { formatDateShortPtBR, computeExpiryDays, formatBRL, formatDoseUnit } from '@dosiq/core'

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
export default function PurchaseCard({ purchase, remaining = 0, isLatest = false, onPress }) {
  // States (R-010 — ordem critica antes de derivações)
  // Nenhum hook complexo — apenas useMemo se houver heavy computation

  // Derivações
  const isInUse = remaining > 0
  const expiryDays = purchase.expiration_date ? computeExpiryDays(purchase.expiration_date) : null
  const purchaseDateFormatted = formatDateShortPtBR(purchase.purchase_date)
  const totalCost = purchase.unit_price * purchase.quantity_bought
  // Grátis: medicamentos distribuídos pelo SUS / Farmácia Popular (preço zero/nulo)
  const isFree = !(purchase.unit_price > 0)
  const expiryStatusColor = expiryDays === null
    ? colors.neutral[400] // sem data
    : expiryDays < 30
    ? colors.status.error    // <30 dias — vermelho
    : expiryDays < 90
    ? colors.status.warning  // <90 dias — amarelo
    : colors.text.secondary  // >=90 dias — neutro

  // Contagem de dias só ajuda para validade próxima (<=60d). Para datas longas,
  // "vence em 680 dias" não é projetável — mostra a data formatada.
  const expiryLabel = !purchase.expiration_date
    ? null
    : expiryDays === null || expiryDays < 0
    ? 'Vencido'
    : expiryDays <= 60
    ? `Vence em ${expiryDays} ${expiryDays === 1 ? 'dia' : 'dias'}`
    : `Vence em ${formatDateShortPtBR(purchase.expiration_date)}`

  const card = (
    <View
      style={[
        styles.card,
        isLatest && styles.cardLatest,
      ]}
    >
      {/* Header: data + badge de status */}
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

      {/* Quantidades: "30 un. compradas · 16 restantes" */}
      <View style={styles.quantityRow}>
        <Text style={styles.quantityText}>
          {formatDoseUnit(purchase.quantity_bought)} compradas
        </Text>
        <Text style={styles.quantityDot}> · </Text>
        <Text style={[styles.quantityText, { color: isInUse ? colors.status.success : colors.text.muted }]}>
          {remaining} restantes
        </Text>
      </View>

      {/* Custo: "R$ 0,89 por un. · Total R$ 26,70" — ou "Grátis" (SUS/Farmácia Popular) */}
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Custo: </Text>
        {isFree ? (
          <Text style={styles.costValue}>Grátis</Text>
        ) : (
          <>
            <Text style={styles.costValue}>
              {formatBRL(purchase.unit_price)} por un.
            </Text>
            <Text style={styles.costDot}> · </Text>
            <Text style={styles.costValue}>Total {formatBRL(totalCost)}</Text>
          </>
        )}
      </View>

      {/* Farmácia + Laboratório (se presentes) */}
      {(purchase.pharmacy || purchase.laboratory) && (
        <View style={styles.bottomInfo}>
          {purchase.pharmacy && (
            <Text style={styles.bottomInfoText}>{purchase.pharmacy}</Text>
          )}
          {purchase.pharmacy && purchase.laboratory && (
            <Text style={styles.bottomInfoDot}> · </Text>
          )}
          {purchase.laboratory && (
            <Text style={styles.bottomInfoText}>{purchase.laboratory}</Text>
          )}
        </View>
      )}

      {/* Validade (se expiration_date) */}
      {expiryLabel && (
        <View style={styles.expiryChip}>
          <Text style={[styles.expiryText, { color: expiryStatusColor }]}>
            {expiryLabel}
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

  // Feedback de tap
  pressed: {
    opacity: 0.7,
  },
})
