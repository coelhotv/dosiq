import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native'
import { useProfile } from '@profile/hooks/useProfile'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'

/**
 * Tela de vinculação do Telegram — Sprint 2.7 Wave N2 Redesign
 * Fluxo visual: Passo 1 (Abrir bot) → Passo 2 (Enviar código) → Status conectado
 */
export default function TelegramLinkScreen({ navigation }) {
  const { settings, generateToken } = useProfile()
  const [isGenerating, setIsGenerating] = useState(false)
  const isConnected = !!settings?.telegram_chat_id
  const token = settings?.verification_token
  const chatIdMasked = isConnected ? String(settings.telegram_chat_id).slice(-4).padStart(7, '*') : null

  const handleGenerateToken = async () => {
    setIsGenerating(true)
    try {
      await generateToken()
    } catch (err) {
      if (__DEV__) console.error('Erro ao gerar token:', err)
      Alert.alert('Erro', 'Não foi possível gerar o código. Verifique sua conexão.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleOpenBot = async () => {
    const url = `https://t.me/dosiq_bot?start=${token || ''}`
    const supported = await Linking.canOpenURL(url)
    if (supported) {
      await Linking.openURL(url)
    } else {
      Alert.alert('Erro', 'Não foi possível abrir o Telegram. Verifique se ele está instalado.')
    }
  }

  const handleCopyToken = () => {
    if (token) {
      const fullCommand = `/start ${token}`
      Alert.alert('Código copiado!', fullCommand, [{ text: 'OK' }])
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isConnected ? (
          // Estado conectado
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Conectado</Text>
            <Text style={styles.successMessage}>
              Sua conta está vinculada ao Telegram. Você receberá lembretes e poderá registrar doses pelo chat.
            </Text>
            {chatIdMasked && (
              <View style={styles.chatIdContainer}>
                <Text style={styles.chatIdLabel}>Chat ID</Text>
                <Text style={styles.chatIdValue}>{chatIdMasked}</Text>
              </View>
            )}
          </View>
        ) : (
          // Estado não conectado
          <>
            {/* Ícone Telegram grande */}
            <View style={styles.iconContainer}>
              <Text style={styles.telegramIcon}>📱</Text>
            </View>

            {/* Título e descrição */}
            <Text style={styles.mainTitle}>Conectar ao Telegram</Text>
            <Text style={styles.mainDescription}>
              Receba lembretes e registre doses direto pelo chat. Vai levar uns 30 segundos.
            </Text>

            {/* Passo 1: Abrir bot */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepNumber}>Passo 1</Text>
              </View>
              <Text style={styles.stepTitle}>Abra o bot no Telegram</Text>
              <TouchableOpacity
                style={styles.telegramButton}
                onPress={handleOpenBot}
              >
                <Text style={styles.telegramButtonText}>Abrir @dosiq_bot</Text>
              </TouchableOpacity>
            </View>

            {/* Passo 2: Enviar código */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepNumber}>Passo 2</Text>
              </View>
              <Text style={styles.stepTitle}>Envie este código no chat</Text>

              {!token ? (
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={handleGenerateToken}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator color={colors.brand.primary} size="small" />
                  ) : (
                    <Text style={styles.generateButtonText}>Gerar código</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>/start {token}</Text>
                    <TouchableOpacity style={styles.copyButton} onPress={handleCopyToken}>
                      <Text style={styles.copyButtonText}>copiar</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={handleGenerateToken}
                    disabled={isGenerating}
                  >
                    <Text style={styles.regenerateButtonText}>
                      {isGenerating ? '...' : 'Gerar novo código'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Nota de segurança */}
            <View style={styles.securityNote}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>
                O bot nunca pede sua senha. O código é temporário e só serve para vincular sua conta.
              </Text>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  backButton: {
    paddingVertical: spacing[2],
  },
  backButtonText: {
    color: colors.brand.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
    flex: 1,
  },
  // Ícone Telegram grande
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  telegramIcon: {
    fontSize: 64,
  },
  // Título e descrição principais
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  mainDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[8],
  },
  // Cards de passo
  stepCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.md,
  },
  stepHeader: {
    marginBottom: spacing[3],
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  // Botão "Abrir bot"
  telegramButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  telegramButtonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
  // Botão "Gerar código"
  generateButton: {
    backgroundColor: colors.bg.screen,
    borderWidth: 2,
    borderColor: colors.border.default,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  generateButtonText: {
    color: colors.brand.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  // Code box com copiar
  codeBox: {
    backgroundColor: colors.neutral[900],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  codeText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    flex: 1,
  },
  copyButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.sm,
  },
  copyButtonText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  // Botão "Gerar novo código"
  regenerateButton: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  regenerateButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Nota de segurança
  securityNote: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginTop: spacing[2],
  },
  securityIcon: {
    fontSize: 18,
    marginRight: spacing[3],
  },
  securityText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    flex: 1,
  },
  // Estado conectado
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  successIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.status.success,
    marginBottom: spacing[4],
  },
  successMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[6],
  },
  chatIdContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    marginTop: spacing[6],
    alignItems: 'center',
    ...shadows.sm,
  },
  chatIdLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    marginBottom: spacing[1],
    letterSpacing: 0.5,
  },
  chatIdValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 1,
  },
})
