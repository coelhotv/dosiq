import React, { useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors } from '@shared/styles/tokens'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { navigateCrossTab } from '@navigation/navigateCrossTab'
import { ROUTES } from '@navigation/routes'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { PackageSearch, AlertTriangle } = LucideIcons as any

/**
 * StockAlertInline - Banner compacto de alerta de estoque
 * @param {Object} props
 * @param {Array} props.alerts - Lista de alertas de estoque
 */
export default function StockAlertInline({ alerts = [] }) {
  const count = alerts?.length ?? 0
  // Pegamos o alerta mais crítico (menor quantidade restante). Cópia antes do sort: ordenar a
  // prop in-place mutava o array do pai a cada render.
  const criticalItem = count > 0 ? [...alerts].sort((a, b) => a.daysRemaining - b.daysRemaining)[0] : null
  // 103 G1: saldo menor que 1 dose (floor ⇒ 0) é falta de estoque em qualquer cadência. Não depender de
  // isDailyStock: com saldo 0 o core (stockDoseMetrics) devolve isDaily=true e o texto caía em "0 dias".
  const noDoseLeft = criticalItem?.dosesRemaining === 0
  const isCritical = criticalItem != null && (criticalItem.daysRemaining <= 2 || noDoseLeft)
  const kind = criticalItem == null ? null : isCritical ? 'critical' : 'low'

  // 065 C2 — `stock_low_viewed` nasce NA TELA: é evento de visualização (exceção declarada do
  // FR-13). Uma vez por foco do Hoje com o banner visível; re-emite só se o nível ou a contagem
  // mudar enquanto focado (dados que chegam depois do foco). Sem `treatment_id` nem nome (Decisão 6,
  // R-042): nível do banner + quantos itens.
  useFocusEffect(
    useCallback(() => {
      if (!kind) return
      logEvent(EVENTS.STOCK_LOW_VIEWED, { surface: SURFACES.MOBILE, kind, count })
    }, [kind, count])
  )

  if (!criticalItem) return null

  // 103 G1: plano não diário fala em doses, como a aba Estoque (ADR-067). Sem a métrica, mantém dias.
  const { daysRemaining, dosesRemaining, isDailyStock } = criticalItem
  const headline = noDoseLeft ? 'Sem estoque' : 'Estoque Baixo'
  const remainingText = noDoseLeft
    ? 'Não há estoque para a próxima dose.'
    : isDailyStock === false && Number.isFinite(dosesRemaining)
    ? dosesRemaining === 1 ? 'Resta apenas 1 dose.' : `Restam apenas ${dosesRemaining} doses.`
    : `Resta apenas para ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}.`

  // 090 S-6: o toque leva ao estoque do remédio do aviso (aba Estoque → detalhe), onde se registra
  // a compra — não ao cadastro do remédio.
  const openStock = () =>
    navigateCrossTab(ROUTES.STOCK, ROUTES.STOCK_DETAIL, {
      medicineId: criticalItem.medicineId,
      medicineName: criticalItem.medicineName,
    })

  return (
    <Pressable
      onPress={openStock}
      accessibilityRole="button"
      accessibilityLabel={`${headline}: ${criticalItem.medicineName}. Abrir estoque`}
      testID="stock-alert-banner"
      style={({ pressed }) => [
        styles.container,
        isCritical ? styles.critical : styles.warning,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconContainer}>
        {isCritical ? (
          <AlertTriangle size={20} color={colors.status.error} />
        ) : (
          <PackageSearch size={20} color={colors.status.warning} />
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, isCritical ? styles.titleCritical : styles.titleWarning]}>
          {headline}: {criticalItem.medicineName}
        </Text>
        <Text style={styles.description}>
          {remainingText}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  warning: {
    backgroundColor: colors.status.warningLight,
    borderColor: colors.status.warning,
  },
  critical: {
    backgroundColor: colors.status.errorLight,
    borderColor: colors.status.error,
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  titleWarning: {
    color: colors.status.warning,
  },
  titleCritical: {
    color: colors.status.error,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
})
