import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ROUTES } from '../../../navigation/routes'
import { colors, spacing, borderRadius, shadows } from '../../../shared/styles/tokens'

/**
 * Card de integração Telegram para a tela principal de Perfil (H5.6).
 * Mostra status e navega para a tela de vinculação detalhada (H5.7).
 */
export default function TelegramLinkCard({ settings }) {
  const navigation = useNavigation()
  const isConnected = !!settings?.telegram_chat_id

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Integração Telegram</Text>
        <View style={[
          styles.badge, 
          isConnected ? styles.badgeConnected : styles.badgeDisconnected
        ]}>
          <Text style={[
            styles.badgeText,
            isConnected ? { color: colors.status.success } : { color: colors.text.secondary }
          ]}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>
        {isConnected
          ? 'Sua conta está vinculada e você está recebendo notificações.'
          : 'Receba alertas de remédios e gerencie doses pelo Telegram.'
        }
      </Text>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => navigation.navigate(ROUTES.TELEGRAM_LINK)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {isConnected ? 'Ver detalhes' : 'Configurar Vínculo'}
        </Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
    marginBottom: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  badgeConnected: {
    backgroundColor: colors.status.success + '15',
  },
  badgeDisconnected: {
    backgroundColor: colors.neutral[100],
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing[4],
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing[3],
  },
  buttonText: {
    color: colors.primary[600],
    fontWeight: '600',
    fontSize: 14,
  },
  arrow: {
    color: colors.primary[600],
    fontSize: 18,
    fontWeight: '600',
  }
})
