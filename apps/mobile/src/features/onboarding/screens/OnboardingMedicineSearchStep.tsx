// OnboardingMedicineSearchStep — passo "Seu primeiro remédio", tela 2 de 3 (spec 066 Slice E, US7 cen. 5).
//
// Busca 2C em tela cheia: o campo filtra a base ANVISA e a lista aparece logo abaixo (o "autocomplete"
// que o passo tinha antes). Nome com várias concentrações abre o passo 2 (`CmedPresentationStep`) na
// mesma tela. O fluxo é o MESMO do sheet do cadastro (`useMedicineSearchFlow`); aqui só muda o layout.
// Escolha feita ⇒ "Confira" preenchido; "Não achei" ⇒ "Confira" em branco. Nada é gravado (INV-1).

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
import { CmedPresentationStep } from '@medications/components/CmedPresentationStep'
import { MedicineSearchResultItem } from '@medications/components/MedicineSearchResultItem'
import { useMedicineSearchFlow } from '@medications/hooks/useMedicineSearchFlow'
import { MIN_SEARCH_CHARS } from '@shared/hooks/useMedicineDatabase'
import { ROUTES } from '@navigation/routes'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES, ENTRY_POINTS } from '@platform/analytics/analyticsEvents'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import OnboardingAnvisaSeal from '@features/onboarding/components/OnboardingAnvisaSeal'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const { Search, X, Pencil } = LucideIcons as any

export default function OnboardingMedicineSearchStep() {
  // States (R-010)
  const navigation = useNavigation<any>()
  const { skip } = useOnboarding()
  // Saída por escolha/"Não achei" não conta como desistência da busca.
  const leavingWithResult = useRef(false)

  // O objeto da escolha é novo a cada seleção — o "Confira" aplica uma vez por objeto.
  const flow = useMedicineSearchFlow({
    active: true,
    onSelect: (selection) => {
      leavingWithResult.current = true
      navigation.popTo(ROUTES.ONBOARDING_MEDICINE_FORM, { searchSelection: selection }, { merge: true })
    },
  })
  const { query, setQuery, trimmed, results, hint, presentationStep, presentationKey } = flow

  // Memos
  const headerProps = useMemo(
    () => ({
      step: 1,
      totalSteps: 4,
      // "‹" no passo 2 volta à lista (C-C9); na lista, volta à escolha.
      onBack: () => (presentationStep ? flow.handleBack() : navigation.goBack()),
      onSkip: () => skip(1),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presentationStep, navigation, skip],
  )

  // Effects
  useEffect(() => {
    logEvent(EVENTS.MEDICINE_SEARCH_OPENED, { surface: SURFACES.MOBILE, entry_point: ENTRY_POINTS.ONBOARDING })
  }, [])

  // Voltar do Android no passo 2 volta à lista, como o "‹" (C-C9). Saindo sem escolher: desistência.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leavingWithResult.current) return
        if (presentationStep) {
          e.preventDefault()
          flow.handleBack()
          return
        }
        logEvent(EVENTS.MEDICINE_SEARCH_DISMISSED, {
          surface: SURFACES.MOBILE,
          had_query: trimmed.length > 0,
          step: 'search',
          exit: 'back',
        })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, presentationStep, trimmed],
  )

  // Handlers
  // "Não achei" é a busca falhando — sai como desistência com `exit: 'manual'` (≠ voltou à escolha).
  const handleManual = useCallback(() => {
    logEvent(EVENTS.MEDICINE_SEARCH_DISMISSED, {
      surface: SURFACES.MOBILE,
      had_query: trimmed.length > 0,
      step: 'search',
      exit: 'manual',
    })
    leavingWithResult.current = true
    navigation.popTo(ROUTES.ONBOARDING_MEDICINE_FORM, { manualEntry: Date.now() }, { merge: true })
  }, [navigation, trimmed])

  const renderItem = useCallback(
    ({ item, index }) => <MedicineSearchResultItem item={item} onPress={() => flow.handleSelect(item, index)} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.handleSelect],
  )

  const manualRow = (
    <Pressable
      style={({ pressed }) => [styles.manualRow, pressed && styles.manualRowPressed]}
      onPress={handleManual}
      accessibilityRole="button"
      accessibilityLabel="Não achei. Digitar à mão"
    >
      <Pencil size={20} color={colors.primary[700]} strokeWidth={2.2} />
      <Text style={styles.manualText}>Não achei. Digitar à mão</Text>
    </Pressable>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...(headerProps as any)} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {presentationStep ? (
          <View style={styles.presentation}>
            <CmedPresentationStep key={presentationKey} {...presentationStep} />
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.title}>Qual é o nome do remédio?</Text>
            <Text style={styles.subtitle}>Digite só o começo. Está escrito na frente da caixa.</Text>

            <View style={styles.searchBox}>
              <Search size={22} color={colors.primary[700]} strokeWidth={2.2} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Ex.: Losartana"
                placeholderTextColor={colors.text.muted}
                autoFocus
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                accessibilityLabel="Buscar remédio pelo nome"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Limpar">
                  <X size={20} color={colors.text.muted} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            {trimmed.length < MIN_SEARCH_CHARS ? <Text style={styles.hint}>{hint}</Text> : null}

            <FlatList
              data={results}
              keyExtractor={(item, idx) => `${item.id ?? item.name}-${idx}`}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={trimmed.length >= MIN_SEARCH_CHARS ? <Text style={styles.hint}>{hint}</Text> : null}
              ListFooterComponent={manualRow}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <OnboardingAnvisaSeal compact />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: spacing[3],
  },
  presentation: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 22,
    marginTop: -spacing[1],
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.card,
    marginTop: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: colors.text.primary,
    padding: 0,
  },
  hint: {
    fontSize: 13,
    color: colors.text.muted,
  },
  listContent: {
    paddingBottom: spacing[4],
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 52,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
  },
  manualRowPressed: {
    backgroundColor: colors.primary[50],
  },
  manualText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[700],
  },
})
