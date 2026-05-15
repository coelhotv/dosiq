import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, Pill, Search, X } from 'lucide-react-native'
import { useMedicineDatabase } from '@shared/hooks/useMedicineDatabase'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// Tela dedicada de busca ANVISA. Layout único: input no topo + lista
// ocupando o resto da tela (sem overlay sobreposto). Para uso inline em
// formulários, prefira FormAutocomplete (overlay) ou um bottom sheet.

const DEBOUNCE_MS = 200
const MAX_RESULTS = 30
const MIN_CHARS = 3

export default function AnvisaSearchScreen({ navigation, route }) {
  // States
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { search, isReady, isLoading, error, lastUpdated } = useMedicineDatabase()

  // Memos (R-010: declarados antes de Effects)
  const trimmed = debouncedQuery.trim()
  const results = useMemo(() => {
    if (!isReady || trimmed.length < MIN_CHARS) return []
    return search(trimmed, MAX_RESULTS)
  }, [isReady, trimmed, search])

  // Effects
  // Debounce do termo de busca
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Retorna o medicamento via params serializáveis (React Navigation v7 best practice)
  function handleSelect(medicine) {
    Keyboard.dismiss()
    const returnRoute = route?.params?.returnRoute
    if (returnRoute) {
      navigation?.navigate({
        name: returnRoute,
        params: { selectedMedicine: medicine },
        merge: true,
      })
    } else {
      navigation?.goBack()
    }
  }

  function renderItem({ item }) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.cardIcon}>
          <Pill size={18} color={colors.primary[700]} strokeWidth={2} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.activeIngredient ? (
            <Text style={styles.cardSub} numberOfLines={1}>
              {item.activeIngredient}
            </Text>
          ) : null}
          {item.laboratory ? (
            <Text style={styles.cardLab} numberOfLines={1}>
              {item.laboratory}
            </Text>
          ) : null}
        </View>
      </Pressable>
    )
  }

  function renderEmpty() {
    if (!isReady) {
      if (isLoading) {
        return (
          <View style={styles.statusCenter}>
            <ActivityIndicator color={colors.primary[700]} />
            <Text style={styles.statusText}>Baixando base ANVISA…</Text>
          </View>
        )
      }
      if (error) {
        return (
          <Text style={styles.errorText}>
            {`Falha ao baixar base: ${error}. Verifique sua conexão e tente novamente.`}
          </Text>
        )
      }
      return null
    }
    if (trimmed.length < MIN_CHARS) {
      return (
        <Text style={styles.hintText}>
          Digite ao menos {MIN_CHARS} caracteres para buscar.
        </Text>
      )
    }
    return (
      <Text style={styles.hintText}>
        Nenhum medicamento encontrado para "{trimmed}".
      </Text>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          onPress={() => navigation?.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Buscar medicamento</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Input de busca */}
      <View style={styles.searchWrapper}>
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
      </View>

      {/* Lista única ocupando o restante da tela */}
      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.name}-${idx}`}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          isReady && lastUpdated ? (
            <Text style={styles.updatedText}>
              {`Base atualizada em ${lastUpdated.toLocaleDateString('pt-BR')}`}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: colors.neutral[100],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  searchWrapper: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
  listContent: {
    padding: spacing[5],
    paddingBottom: spacing[10],
    flexGrow: 1,
  },
  card: {
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
  cardPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cardSub: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  cardLab: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  statusCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
    gap: spacing[3],
  },
  statusText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  errorText: {
    fontSize: 14,
    color: colors.status.error,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  hintText: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing[8],
  },
  updatedText: {
    marginTop: spacing[4],
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
