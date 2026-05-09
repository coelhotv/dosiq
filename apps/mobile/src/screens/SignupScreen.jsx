// SignupScreen.jsx — cadastro de nova conta com confirmação por email
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
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { signUpWithEmail } from '../platform/auth/authService'
import { ROUTES } from '../navigation/routes'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSignup() {
    setLoading(true)
    setError(null)

    const { success, error: signupError } = await signUpWithEmail(email, password, confirmPassword)

    setLoading(false)

    if (!success) {
      setError(signupError)
      return
    }

    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIconWrapper}>
            <Ionicons name="mail-outline" size={56} color={colors.brand.primary} />
          </View>
          <Text style={styles.successTitle}>Verifique seu email</Text>
          <Text style={styles.successDescription}>
            Enviamos um link de confirmação para{'\n'}
            <Text style={styles.successEmail}>{email}</Text>
          </Text>
          <Text style={styles.successHint}>
            Após confirmar seu email, faça login para acessar o Dosiq.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate(ROUTES.LOGIN)}
          >
            <Text style={styles.buttonText}>Ir para Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text.secondary} />
        <Text style={styles.backButtonText}>Voltar</Text>
      </Pressable>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>dosiq</Text>
          <Text style={styles.subtitle}>Crie sua conta</Text>

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
              placeholder="Senha (mínimo 8 caracteres)"
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
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirmar senha"
              placeholderTextColor={colors.text.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <Pressable
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.loginLink}
            onPress={() => navigation.navigate(ROUTES.LOGIN)}
          >
            <Text style={styles.loginLinkText}>Já tenho conta</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.brand,
  },
  keyboardView: {
    flex: 1,
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
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: spacing[3],
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
  error: {
    color: colors.status.error,
    fontSize: 14,
    marginBottom: spacing[2],
    textAlign: 'center',
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
  loginLink: {
    marginTop: spacing[5],
    alignItems: 'center',
  },
  loginLinkText: {
    color: colors.brand.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Estado pós-signup
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
    marginBottom: spacing[3],
  },
  successEmail: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  successHint: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[8],
  },
})
