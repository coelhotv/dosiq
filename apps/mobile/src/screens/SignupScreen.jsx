// SignupScreen.jsx — criar conta (Fase 4 S4.2). UI alinhada ao mock
// mock-onboarding-passo1 (Step1_Account): é o "passo 1 de 3" visual do
// onboarding. Ao continuar, valida e mostra a tela "email enviado"; após
// confirmar o email + login, o wizard retoma no passo 2 (gate em Navigation).

import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Mail, ShieldCheck, Info } from 'lucide-react-native'
import { signUpWithEmail, verifyOtpWithEmail } from '../platform/auth/authService'
import { captureDeviceTimezone } from '@profile/services/profileService'
import { ROUTES } from '../navigation/routes'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import { colors, spacing, borderRadius, typography, shadows } from '@shared/styles/tokens'

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState(null)

  async function handleSignup() {
    setLoading(true)
    setError(null)
    // Campo único de senha: usamos o mesmo valor como confirmação (a validação
    // canônica de signup exige confirmPassword).
    const { success, error: signupError } = await signUpWithEmail(email, password, password)
    setLoading(false)
    if (!success) {
      setError(signupError)
      return
    }
    setEmailSent(true)
  }

  async function handleVerifyOtp() {
    const tokenClean = otpCode.trim()
    if ((tokenClean.length !== 6 && tokenClean.length !== 8) || isNaN(Number(tokenClean))) {
      setOtpError('O código deve conter 6 ou 8 dígitos numéricos')
      return
    }
    setVerifying(true)
    setOtpError(null)
    const { success, error: verifyError } = await verifyOtpWithEmail(email, tokenClean, 'signup')
    setVerifying(false)
    if (!success) {
      setOtpError(verifyError)
      return
    }
    // F4.3f.0: captura o fuso do device agora (conta confirmada, sessão ativa) —
    // antes do onboarding, cobre quem pula o wizard. Best-effort (R-253).
    await captureDeviceTimezone()
  }

  if (emailSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.successContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.successIconWrapper}>
            <Mail size={56} color={colors.brand.primary} />
          </View>
          <Text style={styles.successTitle}>Só falta confirmar seu e-mail</Text>
          <Text style={styles.successDescription}>
            Mandamos uma mensagem para{'\n'}
            <Text style={styles.successEmail}>{email}</Text>
          </Text>
          
          <Text style={styles.successBody}>
            Abra o e-mail e toque no link para ativar sua conta. É rapidinho!
          </Text>

          {/* Campo OTP Alternativo */}
          <View style={[styles.field, styles.otpField]}>
            <Text style={[styles.label, styles.otpLabel]}>
              Ou digite o código de confirmação recebido:
            </Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="Código"
              placeholderTextColor={colors.text.muted}
              value={otpCode}
              onChangeText={(text) => setOtpCode(text.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={8}
              textContentType="oneTimeCode"
              editable={!verifying}
            />
            {otpError ? <Text style={[styles.error, styles.otpError]}>{otpError}</Text> : null}
          </View>

          <Pressable 
            style={[styles.successButton, styles.successButtonMargin, verifying && styles.buttonDisabled]} 
            onPress={handleVerifyOtp}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Confirmar Código e Entrar</Text>
            )}
          </Pressable>

          <Text style={[styles.successHint, styles.successHintMargin]}>
            Não chegou em alguns minutos? Veja na pasta de spam. Se o link apresentar erro, a validação por código acima é o caminho mais seguro.
          </Text>

          <Pressable style={[styles.successButton, styles.successButtonBack]} onPress={() => navigation.navigate(ROUTES.LOGIN)}>
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Voltar ao Login</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader step={0} totalSteps={3} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandmark}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>dosiq</Text>
          </View>

          <Text style={styles.title}>Vamos criar sua conta</Text>
          <Text style={styles.subtitle}>
            Use um e-mail que você acessa fácil. A gente envia uma confirmação rapidinha.
          </Text>

          {/* Email */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Seu e-mail</Text>
              <Text style={styles.asterisk}> *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="seunome@exemplo.com"
              placeholderTextColor={colors.text.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Senha (campo único + Mostrar) */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Crie uma senha</Text>
              <Text style={styles.asterisk}> *</Text>
              <Text style={styles.hint}>Mínimo 8 caracteres</Text>
            </View>
            <View style={styles.passwordField}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={colors.text.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={styles.showToggle}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Card: Sua conta, suas regras */}
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <ShieldCheck size={18} color={colors.primary[700]} strokeWidth={2.2} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>Sua conta, suas regras</Text>
              <Text style={styles.infoText}>
                Seus dados ficam guardados em segurança e funcionam mesmo sem internet.
              </Text>
            </View>
          </View>

          {/* Hint confirmação por email (borda sólida soft — AP-163, RN sem dashed) */}
          <View style={styles.confirmHint}>
            <Info size={16} color={colors.text.muted} strokeWidth={2} />
            <Text style={styles.confirmHintText}>
              Vamos te enviar um link de confirmação por e-mail.
            </Text>
          </View>
        </ScrollView>

        {/* Sticky: Continuar + termos */}
        <View style={styles.sticky}>
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Continuar</Text>
            )}
          </Pressable>
          <Text style={styles.terms}>
            Ao continuar, você aceita os <Text style={styles.termsLink}>Termos</Text> e a{' '}
            <Text style={styles.termsLink}>Privacidade</Text>.
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    fontSize: 26,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 21,
    marginTop: -spacing[2],
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  asterisk: {
    fontSize: 13,
    color: colors.status.error,
  },
  hint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: colors.text.muted,
  },
  input: {
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text.primary,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  showToggle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  error: {
    color: colors.status.error,
    fontSize: 13,
    marginTop: -spacing[2],
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBody: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
  confirmHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  confirmHintText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 18,
  },
  sticky: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.bg.screen,
    gap: spacing[3],
  },
  button: {
    backgroundColor: colors.brand.primary,
    height: 54,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  terms: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: colors.brand.primary,
    fontWeight: '600',
  },
  // Estado pós-signup (email enviado)
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  successIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bg.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing[4],
  },
  successEmail: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  successBody: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing[3],
  },
  successHint: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[8],
  },
  successButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.brand.primary,
    height: 54,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandmark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    alignSelf: 'center',
  },
  brandIcon: {
    width: 28,
    height: 28,
  },
  brandText: {
    fontSize: 20,
    fontFamily: typography.fontFamily.brand || 'System',
    color: colors.text.brand || colors.brand.primary,
    marginLeft: spacing[1],
    fontWeight: '700',
  },
  otpField: {
    width: '100%',
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  otpLabel: {
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 6,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  otpError: {
    textAlign: 'center',
    marginTop: 4,
  },
  successButtonMargin: {
    marginBottom: spacing[3],
  },
  successHintMargin: {
    marginBottom: spacing[6],
  },
  successButtonBack: {
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  buttonTextPrimary: {
    color: colors.text.primary,
  },
})
