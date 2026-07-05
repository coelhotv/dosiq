import { View, Text, Pressable, StyleSheet } from 'react-native'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// Tabs do segmented control — Ativos / Pausados / Finalizados
const TABS = [
  { key: 'ativos', label: 'Ativos' },
  { key: 'pausados', label: 'Pausados' },
  { key: 'finalizados', label: 'Finalizados' },
]

export default function TreatmentTabBar({
  activeTab = 'ativos',
  counts = { ativos: 0, pausados: 0, finalizados: 0 },
  onChange,
}) {
  // States (R-010 — States → Memos → Effects → Handlers)
  // Componente controlado — sem state interno; activeTab/onChange via props

  // Handlers
  const handlePress = (key) => {
    if (key === activeTab) return
    selectionTap()
    onChange?.(key)
  }

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        const count = counts[tab.key] ?? 0
        const label = count > 0 ? `${tab.label} (${count})` : tab.label

        return (
          <Pressable
            key={tab.key}
            onPress={() => handlePress(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : styles.tabInactive,
              pressed && styles.tabPressed,
            ]}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {tab.label}
              {count > 0 && (
                <Text style={[styles.count, isActive ? styles.labelActive : styles.labelInactive]}>
                  {` (${count})`}
                </Text>
              )}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  tab: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: colors.primary[100],
  },
  tabInactive: {
    backgroundColor: undefined,
  },
  tabPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
  },
  labelActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  labelInactive: {
    color: colors.text.muted,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
  },
})
