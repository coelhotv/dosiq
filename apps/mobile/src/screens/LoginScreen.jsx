// LoginScreen.jsx — autenticação com Supabase native
// R4-003: supabase client usa SecureStore via secureStoreAuthStorage
// R4-007: teclado e safe area já nascendo corretos
// Fluxo: email + senha → signInWithPassword → navega para Home

import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native'
import { signInWithEmail } from '../platform/auth/authService'
import { ROUTES } from '../navigation/routes'
import { supabase } from '../platform/supabase/nativeSupabaseClient'
import { logEvent, setUserId } from '../platform/analytics/firebaseAnalytics'
import { EVENTS } from '../platform/analytics/analyticsEvents'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)

    // Validação delegada ao authService com Zod
    const { success, error: loginError } = await signInWithEmail(email, password)

    setLoading(false)

    if (!success) {
      setError(loginError)
      return
    }

    // R-042: setUserId apenas com UUID interno — nunca PII
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) await setUserId(user.id)

    await logEvent(EVENTS.LOGIN, { method: 'email' })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft size={24} color={colors.text.secondary} />
        <Text style={styles.backButtonText}>Voltar</Text>
      </Pressable>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>dosiq</Text>
        <Text style={styles.subtitle}>Entre na sua conta</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.text.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Senha"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!loading}
          />
          <Pressable
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={22} color={colors.text.secondary} />
            ) : (
              <Eye size={22} color={colors.text.secondary} />
            )}
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}>
          <Text style={styles.forgotPasswordLink}>Esqueci minha senha</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.brand,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  backButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontSize: 48,
    lineHeight: 48,
    color: colors.text.brand,
    marginBottom: spacing[1],
    textAlign: 'center',
    fontFamily: typography.fontFamily.brand,
    letterSpacing: -1,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing[8],
    textAlign: 'center',
    fontFamily: typography.fontFamily.medium || 'System',
  },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  forgotPasswordLink: {
    textAlign: 'center',
    color: colors.brand.primary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing[4],
  },
  button: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold || 'System',
  },
  error: {
    color: colors.status.error,
    fontSize: 14,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
})
