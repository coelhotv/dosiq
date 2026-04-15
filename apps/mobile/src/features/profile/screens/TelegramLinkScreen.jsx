import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native'
import { useProfile } from '../hooks/useProfile'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import { colors, spacing, borderRadius, shadows } from '../../../shared/styles/tokens'

/**
 * Tela de vinculação do Telegram (H5.7)
 * Exibe as instruções de vinculação e gera o token de verificação.
 */
export default function TelegramLinkScreen({ navigation }) {
  const { settings, generateToken } = useProfile()
  const [isGenerating, setIsGenerating] = useState(false)
  const isConnected = !!settings?.telegram_chat_id
  const token = settings?.verification_token

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
    const url = `https://t.me/meus_remedios_bot?start=${token || ''}`
    const supported = await Linking.canOpenURL(url)
    if (supported) {
      await Linking.openURL(url)
    } else {
      Alert.alert('Erro', 'Não foi possível abrir o Telegram. Verifique se ele está instalado.')
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Integração Telegram</Text>
      </View>

      <View style={styles.content}>
        {isConnected ? (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Bot Vinculado!</Text>
            <Text style={styles.successMessage}>
              Sua conta já está conectada ao Telegram. Você receberá notificações de medicamentos lá.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.introText}>
              Vincule sua conta para receber avisos de doses e gerenciar seu estoque diretamente pelo Telegram.
            </Text>

            {!token ? (
              <View style={styles.setupContainer}>
                <Text style={styles.stepTitle}>Para começar:</Text>
                <Text style={styles.stepDescription}>
                  Gere um código de vínculo único para autenticar o bot na sua conta com segurança.
                </Text>
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={handleGenerateToken}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator color={colors.text.inverse} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Gerar Código de Vínculo</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tokenContainer}>
                <Text style={styles.stepTitle}>Próximo Passo:</Text>
                <Text style={styles.stepDescription}>
                  Abra o nosso bot no Telegram e envie o comando abaixo:
                </Text>
                
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>COMANDO:</Text>
                  <Text style={styles.codeText}>/start {token}</Text>
                </View>

                <TouchableOpacity 
                  style={[styles.primaryButton, { backgroundColor: colors.primary[600] }]} 
                  onPress={handleOpenBot}
                >
                  <Text style={styles.primaryButtonText}>Abrir Bot no Telegram</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.ghostButton} 
                  onPress={handleGenerateToken}
                  disabled={isGenerating}
                >
                  <Text style={styles.ghostButtonText}>Gerar novo código</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>Nota de privacidade:</Text>
              <Text style={styles.noteText}>
                O bot nunca pedirá sua senha. O vínculo é feito através de um token temporário.
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
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    marginBottom: spacing[4],
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  content: {
    padding: spacing[6],
    flex: 1,
  },
  introText: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing[8],
  },
  setupContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    ...shadows.md,
  },
  tokenContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    ...shadows.md,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  stepDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing[6],
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  codeBox: {
    backgroundColor: colors.neutral[900],
    padding: spacing[4],
    borderRadius: borderRadius.md,
    marginBottom: spacing[6],
    alignItems: 'center',
  },
  codeLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing[1],
  },
  codeText: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ghostButton: {
    marginTop: spacing[4],
    alignItems: 'center',
    padding: spacing[2],
  },
  ghostButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: spacing[10],
  },
  successIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.status.success,
    marginBottom: spacing[4],
  },
  successMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  noteBox: {
    marginTop: 'auto',
    backgroundColor: colors.neutral[100],
    padding: spacing[4],
    borderRadius: borderRadius.md,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  noteText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  }
})
