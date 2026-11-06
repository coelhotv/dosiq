import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { navigateCrossTab } from '@navigation/navigateCrossTab'
import { ROUTES } from '@navigation/routes'
import { formatSupplyDateShort } from '@stock/hooks/_stockDataTransformer'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Box } = LucideIcons as any

/** Título e dica do aviso (105 Fatia B, smoke 2026-11-06: mesmo tom do card da titulação). */
export function supplyNoticeCopy(notice) {
  const short = formatSupplyDateShort(notice?.date)
  if (!notice || !short) return null
  if (notice.reason === 'step_switch') {
    return {
      title: `A próxima etapa usa ${notice.buyMedicineName ?? 'outro medicamento'}`,
      hint: `Garanta até ${short} — você ainda não tem estoque dela.`,
    }
  }
  return {
    title: `Dose mensal de ${notice.buyMedicineName ?? notice.medicineName} em ${short}`,
    hint: 'Você ainda não tem estoque para ela.',
  }
}

/**
 * Aviso de próxima compra no Hoje (spec 105, Fatia B · G-B5, revisado no smoke 2026-11-06).
 *
 * Remédio que zera de propósito (mensal / etapa de passagem) não tem "estoque baixo": tem uma data de
 * compra. Mostra o mais próximo, faltando ≤ 7 dias, no tom ÂMBAR do aviso de estoque da titulação
 * (`TitrationTimeline` PrepStockBanner) — atenção, nunca o vermelho de falta (AC-G1). O nome do
 * remédio aparece aqui (dentro do app); só as notificações são neutras (INV-7).
 *
 * @param props.notices saída de `deriveSupplyNotices` (já filtrada e ordenada)
 */
export default function SupplyNoticeInline({ notices = [] }) {
  const first = notices?.[0]
  const copy = supplyNoticeCopy(first)
  if (!first || !copy) return null

  // Toque abre o estoque do remédio a COMPRAR (escada: o da próxima etapa), onde se registra a compra.
  const openStock = () =>
    navigateCrossTab(ROUTES.STOCK, ROUTES.STOCK_DETAIL, {
      medicineId: first.buyMedicineId,
      medicineName: first.buyMedicineName ?? '',
    })

  return (
    <Pressable
      onPress={openStock}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${copy.hint} Abrir estoque`}
      testID="supply-notice-banner"
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <Box size={18} color={colors.status.warning} strokeWidth={1.9} />
      <View style={styles.content}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.hint}>{copy.hint}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  container: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: 12,
    borderRadius: borderRadius.md,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.status.warningLight,
    borderWidth: 1,
    borderColor: colors.status.warningLight,
  },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.status.warning },
  hint: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
})
