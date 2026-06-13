import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Plus, Syringe } from 'lucide-react-native'
import SectionCard from '../../../shared/components/ui/SectionCard'
import StockLevelBadge from './StockLevelBadge'
import { formatStockQuantity, formatConcentration } from '@dosiq/core'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * Item de lista para exibição de estoque.
 */
export default function StockItem({ medicine }) {
  const {
    name,
    laboratory,
    totalQuantity,
    hasPurchases,
    dosage_unit,
    dosage_per_pill,
    concentration_volume_ml,
    status,
    daysRemaining,
    dosesRemaining,
    isDailyStock,
    hasActiveProtocol,
    ttlExpired,
    ttlDaysLeft,
    ttlAlertActive,
  } = medicine

  const showInitialStockHint = !hasPurchases && totalQuantity === 0

  // Líquido → "X ml"; sólido → hint princípio ativo / "X un." (formatStockQuantity)
  const saldoText = formatStockQuantity(totalQuantity, { dosage_unit, dosage_per_pill })

  return (
    <SectionCard 
      title={
        <View style={styles.titleWrapper}>
          <Text style={styles.titleText}>{name}</Text>
          {dosage_per_pill && (
            <View style={styles.dosagePill}>
              <Text style={styles.dosagePillText}>
                {formatConcentration(dosage_per_pill, dosage_unit, concentration_volume_ml)}
              </Text>
            </View>
          )}
        </View>
      }
    >
      <View style={styles.container}>
        <View style={styles.infoRow}>
          <View style={styles.mainInfo}>
            {laboratory ? (
              <Text style={styles.lab}>{laboratory}</Text>
            ) : null}
            <Text style={styles.quantity}>
              Saldo: <Text style={styles.bold}>{saldoText}</Text>
            </Text>
          </View>

          {showInitialStockHint ? (
            <View style={styles.ctaBadge}>
              <Plus size={12} color={colors.status.error} strokeWidth={2.5} />
              <Text style={styles.ctaBadgeText}>Nova compra</Text>
            </View>
          ) : hasActiveProtocol ? (
            <StockLevelBadge
              status={status}
              daysRemaining={daysRemaining}
              dosesRemaining={dosesRemaining}
              isDailyStock={isDailyStock}
            />
          ) : null}
        </View>

        {/* Alerta TTL pós-abertura (012 Fase A) — eixo paralelo, não substitui badge volume */}
        {ttlAlertActive && (
          <View style={[styles.ttlRow, ttlExpired ? styles.ttlRowExpired : styles.ttlRowWarning]}>
            <Syringe
              size={11}
              color={colors.status.error}
              strokeWidth={2.5}
            />
            <Text style={[styles.ttlText, { color: colors.status.error }]}>
              {ttlExpired
                ? 'Vencido (validade após aberto)'
                : ttlDaysLeft === 0
                ? 'Vence hoje (validade após aberto)'
                : ttlDaysLeft === 1
                ? 'Vence amanhã (validade após aberto)'
                : `Vence em ${ttlDaysLeft} dias (validade após aberto)`}
            </Text>
          </View>
        )}
      </View>
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosagePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  container: {
    paddingTop: 4
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  mainInfo: {
    flex: 1,
    marginRight: 10
  },
  lab: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4
  },
  quantity: {
    fontSize: 14,
    color: colors.text.primary
  },
  bold: {
    fontWeight: '700',
    color: colors.text.primary
  },
  ctaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.errorLight,
  },
  ctaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.status.error,
  },
  // Linha de alerta TTL pós-abertura (012 Fase A)
  ttlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
    minHeight: 26,
  },
  ttlRowExpired: {
    backgroundColor: colors.status.errorLight,
    borderColor: colors.status.error,
  },
  ttlRowWarning: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  ttlText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
