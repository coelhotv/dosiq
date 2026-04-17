import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native'
import { useAuth } from '../../../platform/auth/hooks/useAuth'
import { requestPushPermission } from '../../../platform/notifications/requestPushPermission'
import { getExpoPushToken } from '../../../platform/notifications/getExpoPushToken'
import { syncNotificationDevice } from '../../../platform/notifications/syncNotificationDevice'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import { colors, spacing, borderRadius, typography } from '../../../shared/styles/tokens'

// Cópia dos labels da web conforme R-166
const PREFERENCE_LABELS = {
  telegram: 'Telegram',
  mobile_push: 'App (push nativo)',
  both: 'Ambos',
  none: 'Desativar notificações',
}

export default function NotificationPreferencesScreen() {
  const { supabase, user } = useAuth()
  const [preference, setPreference] = useState('telegram') // default
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkPermissionStatus()
  }, [])

  async function checkPermissionStatus() {
    try {
      const { granted } = await requestPushPermission()
      setHasPermission(granted)
    } catch (err) {
      if (__DEV__) console.warn('[NotificationPreferencesScreen] Erro ao verificar permissão:', err)
    }
  }

  async function handlePreferenceChange(newPreference) {
    if (newPreference === preference) return

    if (newPreference === 'mobile_push' && !hasPermission) {
      Alert.alert(
        'Permissão Necessária',
        'Para receber notificações do app, é preciso ativar a permissão no sistema.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ativar',
            onPress: async () => {
              const { granted } = await requestPushPermission()
              if (granted) {
                setHasPermission(true)
                await savePushPreference(newPreference)
              } else {
                Alert.alert(
                  'Permissão Negada',
                  'Abrir Configurações para ativar notificações?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Abrir Configurações',
                      onPress: () => Linking.openSettings(),
                    },
                  ]
                )
              }
            },
          },
        ]
      )
      return
    }

    if (newPreference === 'both' && !hasPermission) {
      Alert.alert(
        'Permissão Necessária',
        'A opção "Ambos" requer ativar notificações do app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ativar',
            onPress: async () => {
              const { granted } = await requestPushPermission()
              if (granted) {
                setHasPermission(true)
                await savePushPreference(newPreference)
              }
            },
          },
        ]
      )
      return
    }

    await savePushPreference(newPreference)
  }

  async function savePushPreference(newPreference) {
    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ notification_preference: newPreference })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      setPreference(newPreference)

      // Se selecionou push (mobile_push ou both), sincronizar device
      if ((newPreference === 'mobile_push' || newPreference === 'both') && hasPermission) {
        try {
          const token = await getExpoPushToken()
          await syncNotificationDevice({ supabase, userId: user.id, token })
        } catch (syncErr) {
          if (__DEV__) console.warn('[NotificationPreferencesScreen] Erro ao sincronizar device:', syncErr)
          // não falhar se sync falhar — preferência foi salva
        }
      }

      Alert.alert('Preferência Atualizada', `Notificações: ${PREFERENCE_LABELS[newPreference]}`)
    } catch (err) {
      setError(err.message)
      Alert.alert('Erro', 'Não foi possível salvar a preferência: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const PreferenceButton = ({ value }) => (
    <TouchableOpacity
      style={[
        styles.button,
        preference === value && styles.buttonActive,
      ]}
      onPress={() => handlePreferenceChange(value)}
      disabled={loading}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, preference === value && styles.buttonTextActive]}>
        {PREFERENCE_LABELS[value]}
      </Text>
    </TouchableOpacity>
  )

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Preferências de Notificação</Text>

        {/* Pre-prompt */}
        {!hasPermission && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Habilitar Notificações</Text>
            <View style={styles.card}>
              <Text style={styles.descriptionText}>
                Receba lembretes sobre seus medicamentos em tempo real. Você pode escolher receber via Telegram,
                notificação do app, ou ambas.
              </Text>
            </View>
          </View>
        )}

        {/* Status atual da permissão */}
        {hasPermission && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>✓ Notificações habilitadas</Text>
          </View>
        )}

        {!hasPermission && (
          <View style={[styles.statusBadge, styles.statusBadgeWarning]}>
            <Text style={styles.statusTextWarning}>⚠ Permissão não concedida</Text>
          </View>
        )}

        {/* Seletor de preferência */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escolha como receber notificações</Text>
          <View style={styles.buttonsContainer}>
            <PreferenceButton value="telegram" />
            <PreferenceButton value="mobile_push" />
            <PreferenceButton value="both" />
            <PreferenceButton value="none" />
          </View>
        </View>

        {/* Botão para abrir Configurações (se permissão negada) */}
        {!hasPermission && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsButtonText}>Abrir Configurações do Dispositivo</Text>
            </TouchableOpacity>
            <Text style={styles.settingsHint}>
              Navegue para Aplicativos › Meus Remédios › Notificações e ative as notificações.
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Erro: {error}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.headings.h1.size,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.headings.h3.size,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  descriptionText: {
    fontSize: typography.body.md.size,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  statusBadge: {
    backgroundColor: colors.status.success + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.success,
  },
  statusBadgeWarning: {
    backgroundColor: colors.status.warning + '20',
    borderLeftColor: colors.status.warning,
  },
  statusText: {
    fontSize: typography.body.sm.size,
    fontWeight: '500',
    color: colors.status.success,
  },
  statusTextWarning: {
    fontSize: typography.body.sm.size,
    fontWeight: '500',
    color: colors.status.warning,
  },
  buttonsContainer: {
    gap: spacing.md,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  buttonText: {
    fontSize: typography.body.md.size,
    fontWeight: '600',
    color: colors.text.primary,
  },
  buttonTextActive: {
    color: colors.background.primary,
  },
  settingsButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  settingsButtonText: {
    fontSize: typography.body.md.size,
    fontWeight: '600',
    color: colors.background.primary,
  },
  settingsHint: {
    fontSize: typography.body.sm.size,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: colors.status.error + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.error,
  },
  errorText: {
    fontSize: typography.body.sm.size,
    color: colors.status.error,
  },
})
