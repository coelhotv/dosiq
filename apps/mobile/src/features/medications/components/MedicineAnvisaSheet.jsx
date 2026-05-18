import { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search, X, Pill, PillBottle } from 'lucide-react-native'
import { useMedicineDatabase } from '@shared/hooks/useMedicineDatabase'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// Bottom sheet modal de busca na base ANVISA. Reutilizável em formulários
// de criação/edição de medicamentos. Overlay leve com altura máxima 85%.

export function MedicineAnvisaSheet({ open, onClose, onSelect }) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const [query, setQuery] = useState('')
  const { search, isReady } = useMedicineDatabase()

  // Memos
  const trimmed = query.trim()
  const results = useMemo(() => {
    if (!isReady || trimmed.length < 2) return []
    return search(trimmed, 40)
  }, [search, trimmed, isReady])

  const hint = useMemo(() => {
    if (trimmed.length < 2) return 'Digite ao menos 2 caracteres'
    if (results.length === 0) return 'Nenhum resultado'
    return `${results.length} resultados — toque para preencher`
  }, [trimmed, results.length])

  // Handlers
  function handleClose() {
    setQuery('')
    onClose?.()
  }

  function handleSelect(item) {
    selectionTap()
    onSelect?.(item)
    setQuery('')
  }

  function renderItem({ item }) {
    const isSupplement = item.type === 'suplemento'
    const Icon = isSupplement ? PillBottle : Pill
    const iconColor = isSupplement
      ? colors.supplement[500]
      : colors.primary[500]
    const iconBg = isSupplement
      ? colors.supplement[50]
      : colors.primary[50]

    return (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>
          <Icon size={18} color={iconColor} strokeWidth={2} />
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
          {item.laboratory ? (
            <Text style={styles.itemLab} numberOfLines={1}>
              {item.laboratory}
            </Text>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      // Android: cobre o stack inteiro (sem isso inputs do form parent vazam
      // por cima do overlay no Android 7/API 24).
      statusBarTranslucent
    >
      <View style={styles.root}>
        {Platform.OS === 'android' ? (
          <View style={{ height: StatusBar.currentHeight ?? 0 }} />
        ) : null}
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Base ANVISA</Text>

          <View style={styles.searchBox}>
            <Search size={18} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Digite o nome ou princípio ativo"
              placeholderTextColor={colors.text.muted}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              accessibilityLabel="Buscar medicamento"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Limpar"
              >
                <X size={18} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.hint}>{hint}</Text>

          <FlatList
            data={results}
            keyExtractor={(item, idx) => `${item.id ?? item.name}-${idx}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
          />
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[5],
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 44,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  hint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  listContent: {
    paddingBottom: spacing[6],
  },
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

export default MedicineAnvisaSheet
