// OnboardingMedicineChoiceStep — passo "Seu primeiro remédio", tela 1 de 3 (spec 066 Slice E, US7 cen. 1).
//
// Escolha do caminho: ler a caixa (ação principal) ou buscar pelo nome. Os dois terminam no "Confira"
// (`OnboardingMedicineStep`), que também é o fallback em branco quando a caixa ou a busca não servem.
// Nada é gravado aqui (INV-1): quem grava é o passo de estoque. Referência visual: mocks do designer
// (2026-10-18) — não são spec de pixel nem de texto.

import { useCallback, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
import { ROUTES } from '@navigation/routes'
import { ENTRY_POINTS } from '@platform/analytics/analyticsEvents'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import OnboardingAnvisaSeal from '@features/onboarding/components/OnboardingAnvisaSeal'
import OnboardingBrandmark from '@features/onboarding/components/OnboardingBrandmark'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const { ScanBarcode, Search, ChevronRight } = LucideIcons as any

// Círculo do ícone sobre o card verde: branco translúcido (sem token equivalente).
const ON_PRIMARY_TINT = 'rgba(255,255,255,0.18)'

export default function OnboardingMedicineChoiceStep() {
  // States (R-010)
  const navigation = useNavigation<any>()
  const { skip } = useOnboarding()

  // Memos
  // 1ª tela pós-login do wizard: sem voltar.
  const headerProps = useMemo(() => ({ step: 1, totalSteps: 4, onSkip: () => skip(1) }), [skip])

  // Handlers
  // A leitura volta ao "Confira" (`returnTo`); a saída manual do leitor cai nele em branco.
  const openScanner = useCallback(
    () =>
      navigation.navigate(ROUTES.MEDICINE_SCAN, {
        entryPoint: ENTRY_POINTS.ONBOARDING,
        returnTo: ROUTES.ONBOARDING_MEDICINE_FORM,
      }),
    [navigation],
  )
  const openSearch = useCallback(() => navigation.navigate(ROUTES.ONBOARDING_MEDICINE_SEARCH), [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...(headerProps as any)} />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <OnboardingBrandmark />
        <Text style={styles.title}>Qual remédio você toma?</Text>
        <Text style={styles.subtitle}>Comece por um só. Os outros você adiciona depois. Tem a caixa por perto?</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryCard, pressed && styles.primaryCardPressed]}
          onPress={openScanner}
          accessibilityRole="button"
          accessibilityLabel="Ler o código de barras da caixa"
        >
          <View style={[styles.iconCircle, styles.iconCirclePrimary]}>
            <ScanBarcode size={28} color={colors.text.inverse} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>MAIS FÁCIL</Text>
            </View>
            <Text style={[styles.cardTitle, styles.textInverse]}>Ler o código de barras</Text>
            <Text style={[styles.cardText, styles.textInverse]}>Aponte a câmera para a caixa. A gente preenche tudo.</Text>
          </View>
          <ChevronRight size={22} color={colors.text.inverse} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryCard, pressed && styles.secondaryCardPressed]}
          onPress={openSearch}
          accessibilityRole="button"
          accessibilityLabel="Buscar pelo nome"
        >
          <View style={[styles.iconCircle, styles.iconCircleSecondary]}>
            <Search size={26} color={colors.primary[700]} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Buscar pelo nome</Text>
            <Text style={styles.cardText}>Digite o começo do nome e escolha na lista.</Text>
          </View>
          <ChevronRight size={22} color={colors.text.muted} />
        </Pressable>
      </ScrollView>

      <OnboardingAnvisaSeal />
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
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    gap: spacing[4],
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
    marginTop: -spacing[2],
    marginBottom: spacing[2],
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    // Verde Dosiq do CTA principal (o mesmo do PrimaryButton); `primary[600]` é azul.
    backgroundColor: colors.brand.primary,
  },
  primaryCardPressed: {
    backgroundColor: colors.brand.forest,
  },
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  secondaryCardPressed: {
    backgroundColor: colors.primary[50],
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePrimary: {
    backgroundColor: ON_PRIMARY_TINT,
  },
  iconCircleSecondary: {
    backgroundColor: colors.primary[50],
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bg.card,
    marginBottom: spacing[1],
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.primary[700],
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    marginTop: 2,
  },
  textInverse: {
    color: colors.text.inverse,
  },
})
