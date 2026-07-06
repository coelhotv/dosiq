// ForgotPasswordScreen.jsx — recuperação de senha com email validado
// Fluxo: email → sendPasswordReset → feedback visual "email enviado" → botão voltar

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
import { Mail } from 'lucide-react-native'
import { sendPasswordReset, verifyOtpWithEmail } from '../platform/auth/authService'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState(null)

  async function handleSendReset() {
    setLoading(true)
    setError(null)

    const { success, error: resetError } = await sendPasswordReset(email)

    setLoading(false)

    if (!success) {
      setError(resetError)
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

    try {
      // Salva a flag temporária de recuperação de senha no cache local
      await AsyncStorage.setItem('@dosiq/recovery-flow', 'true')

      const { success, error: verifyError } = await verifyOtpWithEmail(email, tokenClean, 'recovery')

      if (!success) {
        await AsyncStorage.removeItem('@dosiq/recovery-flow')
        setOtpError(verifyError)
        setVerifying(false)
        return
      }
    } catch {
      await AsyncStorage.removeItem('@dosiq/recovery-flow')
      setOtpError('Erro inesperado ao validar código.')
      setVerifying(false)
    }
  }

  if (emailSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.successContainer} keyboardShouldPersistTaps="handled">
          <Mail
            size={80}
            color={colors.brand.primary}
            style={styles.successIcon}
          />
          <Text style={styles.successTitle}>E-mail enviado!</Text>
          <Text style={styles.successDescription}>
            Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha diretamente. Você também pode inserir o código de confirmação recebido abaixo:
          </Text>

          {/* Campo de Inserção de OTP */}
          <View style={styles.otpContainer}>
            <Text style={styles.otpLabel}>
              Digite o código de confirmação enviado:
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
            {otpError ? <Text style={styles.error}>{otpError}</Text> : null}
          </View>

          <Pressable
            style={[styles.button, styles.verifyButton, verifying && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Confirmar Código e Continuar</Text>
            )}
          </Pressable>

          <Pressable style={[styles.button, styles.backButton]} onPress={() => navigation.goBack()}>
            <Text style={[styles.buttonText, styles.backButtonText]}>Voltar para Login</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
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
        <Text style={styles.subtitle}>Recuperar senha</Text>

        <Text style={styles.description}>
          Digite seu email para receber um link de recuperação de senha.
        </Text>

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

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>Enviar link de recuperação</Text>
          )}
        </Pressable>

        <Pressable style={styles.footerLink} onPress={() => navigation.goBack()}>
          <Text style={styles.footerLinkText}>Lembrei minha senha</Text>
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
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontSize: 40,
    lineHeight: 40,
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
    marginBottom: spacing[3],
    textAlign: 'center',
    fontFamily: typography.fontFamily.medium || 'System',
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing[6],
    textAlign: 'center',
    lineHeight: 20,
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
  footerLink: {
    marginTop: spacing[6],
    alignItems: 'center',
  },
  footerLinkText: {
    color: colors.brand.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  successIcon: {
    marginBottom: spacing[4],
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[2],
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold || 'System',
  },
  successDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing[2],
    marginBottom: spacing[8],
  },
  otpContainer: {
    width: '100%',
    marginBottom: spacing[4],
    gap: 6,
  },
  otpLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 6,
    fontFamily: typography.fontFamily.bold || 'System',
    marginBottom: 0,
  },
  verifyButton: {
    alignSelf: 'stretch',
    marginBottom: spacing[3],
  },
  backButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  backButtonText: {
    color: colors.text.primary,
  },
})
