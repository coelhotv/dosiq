// ResetPasswordScreen.jsx — definição de nova senha após link de recuperação
// Fluxo: nova senha + confirmação → updatePassword → feedback "Senha alterada!" → onComplete

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
import { updatePassword } from '../platform/auth/authService'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function ResetPasswordScreen({ route }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const { success, error: updateError } = await updatePassword(password, confirmPassword)

    setLoading(false)

    if (!success) {
      setError(updateError)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Ionicons
            name="checkmark-circle"
            size={80}
            color={colors.brand.primary}
            style={styles.successIcon}
          />
          <Text style={styles.successTitle}>Senha alterada!</Text>
          <Text style={styles.successDescription}>
            Sua senha foi alterada com sucesso.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => route.params?.onComplete?.()}
          >
            <Text style={styles.buttonText}>Continuar</Text>
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
        <Text style={styles.subtitle}>Nova senha</Text>

        <Text style={styles.description}>
          Escolha uma nova senha para sua conta.
        </Text>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Nova senha"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <Pressable
            style={styles.eyeIcon}
            onPress={() => setShowPassword((v) => !v)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.text.muted}
            />
          </Pressable>
        </View>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirmar nova senha"
            placeholderTextColor={colors.text.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <Pressable
            style={styles.eyeIcon}
            onPress={() => setShowConfirm((v) => !v)}
          >
            <Ionicons
              name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.text.muted}
            />
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>Definir nova senha</Text>
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
    paddingVertical: 12,
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
