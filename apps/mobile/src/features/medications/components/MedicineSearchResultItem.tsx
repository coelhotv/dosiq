// MedicineSearchResultItem — uma linha do resultado da busca na base ANVISA (spec 066 Slice C, C5.1).
// Extraído do `MedicineAnvisaSheet` na Slice E: o sheet e a tela de busca do onboarding mostram a
// mesma linha. Componente puro (sem state, sem effects).

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { normalizeRegulatoryCategory, REGULATORY_CATEGORY_LABELS } from '@dosiq/core'
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// 3ª linha: laboratório da marca; sem laboratório, a categoria do item ("Genérico",
// "Específico"…) — o pipeline traz a categoria clínica real (C5.1 R-7).
function itemCaption(item: any): string | null {
  if (item.laboratory) return item.laboratory
  const category = normalizeRegulatoryCategory(item.regulatoryCategory)
  return category ? ((REGULATORY_CATEGORY_LABELS as Record<string, string>)[category] ?? category) : null
}

interface MedicineSearchResultItemProps {
  item: any
  onPress: () => void
}

export function MedicineSearchResultItem({ item, onPress }: MedicineSearchResultItemProps) {
  const isSupplement = item.type === 'suplemento'
  const iconColor = isSupplement ? colors.supplement[500] : colors.primary[500]
  const iconBg = isSupplement ? colors.supplement[50] : colors.primary[50]
  const caption = itemCaption(item)

  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>
        <MedicineIcon medicine={item} size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={styles.itemText}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.activeIngredient ? (
          <Text style={styles.itemIngredient} numberOfLines={1}>
            {item.activeIngredient}
          </Text>
        ) : null}
        {caption ? (
          <Text style={styles.itemLab} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export default MedicineSearchResultItem

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  itemPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemIngredient: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemLab: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
})
