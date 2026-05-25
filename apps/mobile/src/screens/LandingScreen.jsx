import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, UserPlus, LogIn, Bell, Package } from 'lucide-react-native';
import { colors, spacing, typography, shadows } from '@shared/styles/tokens';
import { ROUTES } from '@navigation/routes';
import AdherenceRing from '@features/dashboard/components/AdherenceRing';

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleCreateAccount = () => {
    navigation.navigate(ROUTES.SIGNUP);
  };

  const handleLogin = () => {
    navigation.navigate(ROUTES.LOGIN);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header Branding - Copied assets pattern from LoginScreen */}
        <View style={styles.header}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>dosiq</Text>
        </View>

        {/* 2. Hero Section Container */}
        <View style={styles.heroContainer}>
          {/* Adherence Card */}
          <View style={[styles.card, styles.adherenceCard]}>
            <View style={styles.adherenceContent}>
              <View style={styles.circularProgressContainer}>
                <AdherenceRing score={91} size={85} strokeWidth={8} />
              </View>
              <View style={styles.adherenceInfo}>
                <Text style={styles.adherenceLabel}>Hoje</Text>
                <Text style={styles.adherenceTitle}>Adesão excelente!</Text>
              </View>
            </View>
          </View>

          {/* Next Dose Card */}
          <View style={[styles.card, styles.doseCard]}>
            <View style={styles.doseIconContainer}>
              <Sun size={32} color="#f9a825" />
            </View>
            <View style={styles.doseInfo}>
              <Text style={styles.doseLabel}>PRÓXIMA DOSE</Text>
              <View style={styles.doseTimeRow}>
                <Text style={styles.doseTimeText}>08:00</Text>
              </View>
              <Text style={styles.medicationName}>Atorvastatina</Text>
              <Text style={styles.medicationDetails}>40mg • 1 Comprimido</Text>
            </View>
          </View>
        </View>

        {/* 3. Headline Section */}
        <View style={styles.textSection}>
          <Text style={styles.headlineContainer}>
            <Text style={styles.headlineText}>Nunca mais </Text>
            <Text style={[styles.headlineText, styles.highlightText]}>esqueça</Text>
            <Text style={styles.headlineText}> um remédio.</Text>
          </Text>

          <Text style={styles.descriptionText}>
            O Dosiq lembra você dos horários, controla o estoque e funciona offline. Gratuito, sem assinatura.
          </Text>
        </View>

        {/* 4. Feature Chips */}
        <View style={styles.featureRow}>
          <View style={[styles.card, styles.featureChip]}>
            <View style={styles.featureIcon}>
              <Bell size={22} color={colors.brand.primary} strokeWidth={1.75} />
            </View>
            <Text style={styles.featureTitle}>Lembretes</Text>
            <Text style={styles.featureCaption}>push + WhatsApp em breve</Text>
          </View>
          <View style={[styles.card, styles.featureChip]}>
            <View style={styles.featureIcon}>
              <Package size={22} color={colors.brand.primary} strokeWidth={1.75} />
            </View>
            <Text style={styles.featureTitle}>Estoque</Text>
            <Text style={styles.featureCaption}>avisa antes de acabar</Text>
          </View>
        </View>

        {/* 5. Sponsored Space - Suppressed until ads/partnerships are active
        <View style={styles.sponsorSection}>
          <View style={styles.sponsorBox}>
            <Text style={styles.sponsorLabel}>ESPAÇO PATROCINADO</Text>
            <View style={styles.sponsorLogos}>
              <View style={styles.sponsorBrand}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.text.muted} style={styles.brandIcon} />
                <Text style={styles.brandText}>BIO-HEALTH</Text>
              </View>
              <View style={styles.sponsorBrand}>
                <Ionicons name="medkit-outline" size={18} color={colors.text.muted} style={styles.brandIcon} />
                <Text style={styles.brandText}>PHARMA-CORE</Text>
              </View>
            </View>
          </View>
        </View>
        */}
      </ScrollView>

      {/* 6. Action Bar (Fixed at bottom) */}
      <View style={[
        styles.actionBar, 
        { paddingBottom: Math.max(insets.bottom, spacing[6]) }
      ]}>
        <Pressable 
          style={styles.createAccountBtn} 
          onPress={handleCreateAccount}
          accessibilityRole="button"
          accessibilityLabel="Criar conta"
        >
          <UserPlus size={20} color="#fff" />
          <Text style={styles.createAccountText}>Criar conta</Text>
        </Pressable>
        
        <Pressable 
          style={styles.loginBtn} 
          onPress={handleLogin}
          accessibilityRole="button"
          accessibilityLabel="Já tenho conta"
        >
          <LogIn size={24} color={colors.primary[600]} />
          <Text style={styles.loginBtnText}>Já tenho conta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  scrollContent: {
    paddingBottom: 140, // More space for the fixed bottom bar on iOS
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[4],
    marginBottom: spacing[6],
  },
  logo: {
    width: 52,
    height: 52,
    marginRight: spacing[2],
  },
  brandName: {
    fontSize: 36,
    fontFamily: typography.fontFamily.brand,
    color: colors.text.brand,
    includeFontPadding: false,
    letterSpacing: -1.5,
  },
  heroContainer: {
    backgroundColor: '#f1f3f4',
    marginHorizontal: spacing[6],
    borderRadius: 32,
    padding: spacing[6],
    marginBottom: spacing[8],
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 24,
    padding: spacing[4],
    width: '100%',
    ...shadows.sm,
  },
  adherenceCard: {
    marginBottom: spacing[4],
  },
  adherenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circularProgressContainer: {
    width: 85,
    height: 85,
    marginRight: spacing[4],
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  adherenceInfo: {
    flex: 1,
  },
  adherenceLabel: {
    fontSize: 14,
    color: colors.text.muted,
    marginBottom: 2,
  },
  adherenceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  doseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  doseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF', // white
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  doseInfo: {
    flex: 1,
  },
  doseLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  doseTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  doseTimeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  medicationDetails: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  textSection: {
    paddingHorizontal: spacing[6],
    marginBottom: spacing[8],
  },
  headlineContainer: {
    marginBottom: spacing[4],
  },
  headlineText: {
    // Match tipográfico do mock (dosiq-tokens display): peso forte, tracking
    // negativo (-0.02em) e leading apertado (~1.15). Família = System (mock usa
    // system-ui), o gap visual era só weight/letterSpacing/lineHeight.
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.text.primary,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  highlightWrapper: {
    position: 'relative',
  },
  highlightText: {
    color: colors.brand.primary,
  },
  thickUnderline: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.brand.primary,
    borderRadius: 3,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.secondary,
  },
  boldText: {
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  featureRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
    marginBottom: spacing[8],
  },
  featureChip: {
    flex: 1,
    alignItems: 'flex-start',
    padding: spacing[4],
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  featureCaption: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 16,
  },
  sponsorSection: {
    paddingHorizontal: spacing[6],
    marginBottom: spacing[6],
  },
  sponsorBox: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 16,
    padding: spacing[4],
    alignItems: 'center',
  },
  sponsorLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text.muted,
    marginBottom: spacing[3],
    letterSpacing: 1,
  },
  sponsorLogos: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[6],
  },
  sponsorBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    marginRight: 6,
  },
  brandText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text.muted,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[3],
  },
  createAccountBtn: {
    flex: 1.5,
    backgroundColor: colors.brand.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  createAccountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginBtn: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  loginBtnText: {
    color: colors.primary[600],
    fontSize: 16,
    fontWeight: 'bold',
  },
});
