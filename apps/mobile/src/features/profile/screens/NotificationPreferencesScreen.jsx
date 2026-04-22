import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native'
import { Send, MessageSquareDot, TrendingUpDown, MessageSquareOff } from 'lucide-react-native'
import { useAuth } from '../../../platform/auth/hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { requestPushPermission } from '../../../platform/notifications/requestPushPermission'
import { getExpoPushToken } from '../../../platform/notifications/getExpoPushToken'
import { syncNotificationDevice } from '../../../platform/notifications/syncNotificationDevice'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

// Cópia dos labels da web conforme R-166
const PREFERENCE_LABELS = {
  telegram: 'Telegram',
  mobile_push: 'App (push nativo)',
  both: 'Ambos',
  none: 'Desativar notificações',
}

export default function NotificationPreferencesScreen({ navigation }) {
  const { supabase, user } = useAuth()
  const { settings, loading: settingsLoading, refresh } = useProfile()
  const [preference, setPreference] = useState(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Sincronizar preferência com servidor ao carregar
  useEffect(() => {
    if (__DEV__) console.log('[NotificationPreferencesScreen] settings atualizado:', settings)
    if (settings?.notification_preference) {
      if (__DEV__) console.log('[NotificationPreferencesScreen] Sincronizando preferência do servidor:', settings.notification_preference)
      setPreference(settings.notification_preference)
    }
  }, [settings])

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
      if (__DEV__) console.log('[NotificationPreferencesScreen] Salvando preferência:', newPreference, 'para user:', user.id)

      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ notification_preference: newPreference })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      if (__DEV__) console.log('[NotificationPreferencesScreen] Preferência salva no banco com sucesso')

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

      // Recarregar dados do servidor para confirmar persistência
      if (__DEV__) console.log('[NotificationPreferencesScreen] Refetchando dados do servidor...')
      await refresh()
    } catch (err) {
      if (__DEV__) console.error('[NotificationPreferencesScreen] Erro ao salvar preferência:', err)
      setError(err.message)
      Alert.alert('Erro', 'Não foi possível salvar a preferência: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (value, isDangerous) => {
    const iconProps = { size: 20, strokeWidth: 2, style: { marginRight: spacing[2] } }
    let iconColor = colors.primary[600]

    if (isDangerous) {
      iconColor = colors.status.error
    } else if (preference === value) {
      iconColor = colors.text.inverse
    }

    switch (value) {
      case 'telegram':
        return <Send {...iconProps} color={iconColor} />
      case 'mobile_push':
        return <MessageSquareDot {...iconProps} color={iconColor} />
      case 'both':
        return <TrendingUpDown {...iconProps} color={iconColor} />
      case 'none':
        return <MessageSquareOff {...iconProps} color={iconColor} />
      default:
        return null
    }
  }

  const PreferenceButton = ({ value, isDangerous }) => {
    const isActive = preference === value
    const isDeactivateButton = isDangerous

    return (
      <TouchableOpacity
        style={[
          styles.button,
          isActive && styles.buttonActive,
          isDeactivateButton && styles.buttonDeactivate,
        ]}
        onPress={() => handlePreferenceChange(value)}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          {getIcon(value, isDangerous)}
          <Text style={[
            styles.buttonText,
            isActive && !isDeactivateButton && styles.buttonTextActive,
            isDeactivateButton && styles.buttonDeactivateText,
          ]}>
            {PREFERENCE_LABELS[value]}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preferências de Notificação</Text>
        </View>

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

        {/* Status atual da preferência — 3 estados com cores diferentes */}
        {preference === 'none' && (
          <View style={[styles.statusBadge, styles.statusBadgeDisabled]}>
            <Text style={[styles.statusText, styles.statusTextDisabled]}>✓ Notificações desativadas</Text>
          </View>
        )}

        {hasPermission && preference && preference !== 'none' && (
          <View style={[styles.statusBadge, styles.statusBadgeEnabled]}>
            <Text style={[styles.statusText, styles.statusTextEnabled]}>✓ Notificações habilitadas</Text>
          </View>
        )}

        {!hasPermission && preference !== 'none' && (
          <View style={[styles.statusBadge, styles.statusBadgeUnauthorized]}>
            <Text style={[styles.statusText, styles.statusTextUnauthorized]}>⚠ Permissão não concedida</Text>
          </View>
        )}

        {/* Seletor de preferência */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escolha como receber notificações</Text>
          <View style={styles.buttonsContainer}>
            <PreferenceButton value="telegram" />
            <PreferenceButton value="mobile_push" />
            <PreferenceButton value="both" />
          </View>
        </View>

        {/* Botão desativar separado */}
        <View style={styles.section}>
          <PreferenceButton value="none" isDangerous />
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
              Navegue para Aplicativos › Dosiq › Notificações e ative as notificações.
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
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
  },
  header: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    marginBottom: spacing[6],
  },
  backButton: {
    marginBottom: spacing[4],
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    padding: spacing[4],
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  statusBadge: {
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginBottom: spacing[6],
    borderLeftWidth: 4,
  },
  statusBadgeEnabled: {
    backgroundColor: colors.status.success + '20',
    borderLeftColor: colors.status.success,
  },
  statusBadgeDisabled: {
    backgroundColor: colors.text.secondary + '15',
    borderLeftColor: colors.text.secondary,
  },
  statusBadgeUnauthorized: {
    backgroundColor: colors.status.error + '20',
    borderLeftColor: colors.status.error,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextEnabled: {
    color: colors.status.success,
  },
  statusTextDisabled: {
    color: colors.text.secondary,
  },
  statusTextUnauthorized: {
    color: colors.status.error,
  },
  buttonsContainer: {
    gap: spacing[3],
  },
  button: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.screen,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  buttonDeactivate: {
    backgroundColor: colors.bg.card,
    borderColor: colors.status.error + '50',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  buttonTextActive: {
    color: colors.text.inverse,
  },
  buttonDeactivateText: {
    color: colors.status.error,
    fontWeight: '700',
    fontSize: 16,
  },
  settingsButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  settingsHint: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: colors.status.error + '20',
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginTop: spacing[6],
    borderLeftWidth: 4,
    borderLeftColor: colors.status.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.status.error,
  },
})
