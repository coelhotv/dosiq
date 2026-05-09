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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { sendPasswordReset } from '../platform/auth/authService'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)

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

  if (emailSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Ionicons
            name="mail-outline"
            size={80}
            color={colors.brand.primary}
            style={styles.successIcon}
          />
          <Text style={styles.successTitle}>Email enviado!</Text>
          <Text style={styles.successDescription}>
            Se este email estiver cadastrado, você receberá um link para criar uma nova senha.
          </Text>
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Voltar para Login</Text>
          </Pressable>
        </View>
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
})
