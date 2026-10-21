// OnboardingWelcomeStep — tela inicial de acolhimento premium ("welcome warm") pós-login (Fase 2).
// Apresenta a marca dosiq com visual elegante, copy humanizado simples (Opção A)
// e os 3 pilares principais com ícones Lucide de alta definição.

import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Bell, Package, ShieldCheck } = LucideIcons as any
import { useNavigation } from '@react-navigation/native'
import { ROUTES } from '@navigation/routes'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

export default function OnboardingWelcomeStep() {
  const navigation = useNavigation()

  function handleStart() {
    (navigation.navigate as any)(ROUTES.ONBOARDING_MEDICINE)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bloco de Branding Centralizado */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>dosiq</Text>
        </View>

        {/* Copy de Acolhimento Humano (Opção A) */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.title}>Que bom ter você aqui!</Text>
          <Text style={styles.subtitle}>
            O Dosiq ajuda você a lembrar de tomar seus remédios de forma simples e segura.
          </Text>
        </View>

        {/* Card com os 3 Pilares Principais (Usabilidade Simples "Dona Maria") */}
        <View style={styles.card}>
          {/* Pilar 1: Lembretes */}
          <View style={styles.pilarRow}>
            <View style={styles.iconWrapper}>
              <Bell size={24} color={colors.brand.primary} />
            </View>
            <View style={styles.pilarTextContainer}>
              <Text style={styles.pilarTitle}>Lembretes no Celular</Text>
              <Text style={styles.pilarDescription}>
                Notificações na hora certa para você nunca esquecer uma dose.
              </Text>
            </View>
          </View>

          {/* Pilar 2: Estoque */}
          <View style={styles.pilarRow}>
            <View style={styles.iconWrapper}>
              <Package size={24} color={colors.brand.primary} />
            </View>
            <View style={styles.pilarTextContainer}>
              <Text style={styles.pilarTitle}>Controle de Estoque</Text>
              <Text style={styles.pilarDescription}>
                Saiba quando seus remédios estão acabando para comprar antes.
              </Text>
            </View>
          </View>

          {/* Pilar 3: Privacidade */}
          <View style={styles.pilarRow}>
            <View style={styles.iconWrapper}>
              <ShieldCheck size={24} color={colors.brand.primary} />
            </View>
            <View style={styles.pilarTextContainer}>
              <Text style={styles.pilarTitle}>Seguro e Privado</Text>
              <Text style={styles.pilarDescription}>
                Suas informações protegidas e guardadas com total segurança.
              </Text>
            </View>
          </View>
        </View>

        {/* Botão de Ação Principal (CTA) */}
        <Pressable style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>Configurar meu primeiro remédio</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing[2],
  },
  brandTitle: {
    fontSize: 40,
    lineHeight: 40,
    fontFamily: typography.fontFamily.brand,
    color: colors.text.brand,
    fontWeight: '700',
    letterSpacing: -1,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing[2],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[8],
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pilarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    gap: spacing[4],
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pilarTextContainer: {
    flex: 1,
  },
  pilarTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  pilarDescription: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
})
