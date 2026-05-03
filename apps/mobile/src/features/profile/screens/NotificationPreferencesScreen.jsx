import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Modal,
  FlatList,
} from 'react-native'
import { Bell, Smartphone, Send, Globe, Mail, ChevronRight, Check } from 'lucide-react-native'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { useProfile } from '@profile/hooks/useProfile'
import { requestPushPermission } from '@platform/notifications/requestPushPermission'
import { getExpoPushToken } from '@platform/notifications/getExpoPushToken'
import { syncNotificationDevice } from '@platform/notifications/syncNotificationDevice'
import { updateNotificationSettings } from '../services/profileService'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { parseLocalDate } from '@dosiq/core'
import { debugLog, errorLog } from '@shared/utils/debugLog'

// Horas disponíveis para o picker inline
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0')
  return `${h}:00`
})

// Derivar notification_preference legado
function deriveLegacyPreference({ channel_mobile_push_enabled, channel_telegram_enabled }) {
  if (channel_mobile_push_enabled && channel_telegram_enabled) return 'both'
  if (channel_mobile_push_enabled) return 'mobile_push'
  if (channel_telegram_enabled) return 'telegram'
  return 'none'
}

// Detecta formato 12/24h com fallback seguro para Hermes/Android antigo
let IS_24H_FORMAT = true // fallback: Brasil usa 24h
try {
  const testDate = parseLocalDate('2024-01-01')
  testDate.setHours(13)
  IS_24H_FORMAT = !new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
    .format(testDate)
    .match(/am|pm/i)
  debugLog('NotificationPreferences', 'Intl.DateTimeFormat indisponível, usando 24h')
} catch {
  // Hermes sem Intl completo em Android ≤ 7 — fallback 24h (padrão BR)
}

// Formata hora de forma amigável (22h ou 10PM)
function formatTimeFriendly(timeStr) {
  if (!timeStr) return ''
  const [hour] = timeStr.split(':')
  const h = parseInt(hour, 10)
  
  if (IS_24H_FORMAT) {
    return `${h}h`
  } else {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}${ampm}`
  }
}

// Picker de hora inline via Modal
function TimePicker({ value, onChange, label }) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <TouchableOpacity
        style={styles.timePickerButton}
        onPress={() => setVisible(true)}
        accessibilityLabel={`${label}: ${value}`}
        accessibilityRole="button"
      >
        <Text style={styles.timePickerValue}>{formatTimeFriendly(value)}</Text>
        <ChevronRight size={14} color={colors.text.muted} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={HOURS}
              keyExtractor={(item) => item}
              style={styles.hourList}
              initialScrollIndex={Math.max(0, HOURS.indexOf(value))}
              getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.hourItem, item === value && styles.hourItemActive]}
                  onPress={() => {
                    onChange(item)
                    setVisible(false)
                  }}
                  accessibilityLabel={item}
                  accessibilityRole="menuitem"
                >
                  <Text style={[styles.hourItemText, item === value && styles.hourItemTextActive]}>
                    {formatTimeFriendly(item)}
                  </Text>
                  {item === value && <Check size={16} color={colors.primary[600]} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

export default function NotificationPreferencesScreen({ navigation }) {
  const { user } = useAuth()
  const { settings, refresh } = useProfile()
  const isTelegramConnected = !!settings?.telegram_chat_id

  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [mobilePushEnabled, setMobilePushEnabled] = useState(true)
  const [webPushEnabled, setWebPushEnabled] = useState(false)
  const [notificationMode, setNotificationMode] = useState('realtime')
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00')
  const [digestTime, setDigestTime] = useState('07:00')
  const [hasPermission, setHasPermission] = useState(false)

  // Carregar valores do banco ao montar
  useEffect(() => {
    debugLog('NotificationPreferencesScreen', `settings: ${JSON.stringify(settings)}`)
    if (!settings) return

    const pref = settings.notification_preference
    setQuietHoursEnabled(settings.quiet_hours_enabled ?? !!(settings.quiet_hours_start || settings.quiet_hours_end))
    setQuietHoursStart(settings.quiet_hours_start ?? '22:00')
    setQuietHoursEnd(settings.quiet_hours_end ?? '07:00')
    setDigestTime(settings.digest_time ?? '07:00')

    const isGlobal = pref !== 'none'
    setGlobalEnabled(isGlobal)
    setNotificationMode(settings.notification_mode)

    // Apenas sincroniza canais individuais se o global estiver ON
    if (isGlobal) {
      setMobilePushEnabled(
        settings.channel_mobile_push_enabled ??
        (pref === 'mobile_push' || pref === 'both')
      )
      setWebPushEnabled(settings.channel_web_push_enabled ?? false)
    }
  }, [settings])

  useEffect(() => {
    checkPermission()
  }, [])

  async function checkPermission() {
    try {
      const { granted } = await requestPushPermission()
      setHasPermission(granted)
    } catch (err) {
      debugLog('NotificationPreferencesScreen', `Erro permissão: ${err.message}`)
    }
  }

  const hasAnyChannel = mobilePushEnabled || isTelegramConnected || webPushEnabled
  const showChannelWarning = globalEnabled && !hasAnyChannel

  // Salvar no banco (debounce manual: chama após cada alteração)
  const persist = useCallback(async (patch) => {
    if (!user?.id) return
    try {
      const mobile = patch.mobilePushEnabled ?? mobilePushEnabled
      const telegram = isTelegramConnected // Telegram segue o vínculo
      const web = patch.webPushEnabled ?? webPushEnabled
      const mode = patch.notificationMode ?? notificationMode
      const qEnabled = patch.quietHoursEnabled ?? quietHoursEnabled
      const qStart = patch.quietHoursStart ?? quietHoursStart
      const qEnd = patch.quietHoursEnd ?? quietHoursEnd
      const dTime = patch.digestTime ?? digestTime
      const global = patch.globalEnabled ?? globalEnabled

      const result = await updateNotificationSettings(user.id, {
        notification_mode: mode,
        quiet_hours_start: (global && qEnabled) ? qStart : null,
        quiet_hours_end: (global && qEnabled) ? qEnd : null,
        quiet_hours_enabled: global && qEnabled,
        digest_time: dTime,
        channel_mobile_push_enabled: global && mobile,
        channel_web_push_enabled: global && web,
        channel_telegram_enabled: global && telegram,
        notification_preference: global 
          ? deriveLegacyPreference({ 
              channel_mobile_push_enabled: mobile, 
              channel_telegram_enabled: telegram 
            }) 
          : 'none',
      })

      if (result.success) {
        debugLog('NotificationPreferencesScreen', 'Configurações salvas')
        await refresh()
      } else {
        throw new Error(result.error || 'Erro desconhecido ao salvar')
      }
    } catch (err) {
      errorLog('NotificationPreferencesScreen', 'Erro ao salvar', err)
      Alert.alert('Erro', 'Não foi possível salvar as preferências: ' + err.message)
    }
  }, [user, mobilePushEnabled, isTelegramConnected, webPushEnabled, notificationMode,
      quietHoursEnabled, quietHoursStart, quietHoursEnd, digestTime, globalEnabled, refresh])

  async function handleMobilePushToggle(val) {
    if (val && !hasPermission) {
      const { granted } = await requestPushPermission()
      if (!granted) {
        Alert.alert(
          'Permissão necessária',
          'Abrir Configurações para ativar notificações?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
          ]
        )
        return
      }
      setHasPermission(true)
      try {
        const token = await getExpoPushToken()
        await syncNotificationDevice({ supabase: user?.supabase, userId: user.id, token })
      } catch (syncErr) {
        debugLog('NotificationPreferencesScreen', `Erro sync device: ${syncErr.message}`)
      }
    }
    setMobilePushEnabled(val)
    persist({ mobilePushEnabled: val })
  }

  function handleGlobalToggle(val) {
    setGlobalEnabled(val)
    // Se está ativando e nada está ligado, ativa mobile_push como padrão
    // para evitar que o estado volte a 'none' no DB e dê snap-back para off
    if (val && !hasAnyChannel) {
      setMobilePushEnabled(true)
      persist({ globalEnabled: true, mobilePushEnabled: true })
    } else {
      persist({ globalEnabled: val })
    }
  }

  function handleModeSelect(mode) {
    setNotificationMode(mode)
    persist({ notificationMode: mode })
  }

  function handleQuietHoursToggle(val) {
    setQuietHoursEnabled(val)
    persist({ quietHoursEnabled: val })
  }

  function handleTelegramPress() {
    navigation.navigate(ROUTES.TELEGRAM_LINK)
  }

  // ── Seções de UI ──────────────────────────────────────────────────────────

  const MODES = [
    { value: 'realtime', label: 'Alertas unitários' },
    { value: 'digest_morning', label: 'Resumo diário' },
    { value: 'silent', label: 'Silencioso' },
  ]

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Voltar">
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Preferências</Text>
          <Text style={styles.subtitle}>Escolha onde e quando ser avisado.</Text>
        </View>

        {/* Global toggle */}
        <View style={[styles.card, styles.globalRow]}>
          <View style={styles.rowLeft}>
            <Bell size={20} color={globalEnabled ? colors.primary[600] : colors.text.muted} strokeWidth={2} />
            <Text style={styles.rowLabel}>Notificações ativas</Text>
          </View>
          <Switch
            value={globalEnabled}
            onValueChange={handleGlobalToggle}
            trackColor={{ false: colors.neutral[200], true: colors.primary[500] }}
            thumbColor={colors.bg.card}
            accessibilityLabel="Ativar ou desativar todas as notificações"
          />
        </View>

        {/* Canais */}
        <Text style={styles.sectionLabel}>CANAIS</Text>
        <View style={styles.card}>

          {/* App push */}
          <View style={styles.channelRow}>
            <View style={styles.rowLeft}>
              <Smartphone size={20} color={colors.primary[600]} strokeWidth={2} />
              <Text style={styles.rowLabel}>App (push)</Text>
            </View>
            <Switch
              value={mobilePushEnabled && globalEnabled}
              onValueChange={handleMobilePushToggle}
              disabled={!globalEnabled}
              trackColor={{ false: colors.neutral[200], true: colors.primary[500] }}
              thumbColor={colors.bg.card}
              accessibilityLabel="Ativar notificações push do aplicativo"
            />
          </View>

          <View style={styles.divider} />

          {/* Telegram */}
          <TouchableOpacity style={styles.channelRow} onPress={handleTelegramPress} activeOpacity={0.7} accessibilityLabel="Configurar Telegram">
            <View style={styles.rowLeft}>
              <Send size={20} color={colors.primary[600]} strokeWidth={2} />
              <Text style={styles.rowLabel}>Telegram</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={[styles.badge, isTelegramConnected ? styles.badgeConnected : styles.badgeDisconnected]}>
                <Text style={[styles.badgeText, isTelegramConnected ? styles.badgeTextConnected : styles.badgeTextDisconnected]}>
                  {isTelegramConnected ? 'CONECTADO' : 'DESCONECTADO'}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.text.muted} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Web PWA — informativo */}
          <View style={[styles.channelRow, styles.rowDisabled]} pointerEvents="none">
            <View style={styles.rowLeft}>
              <Globe size={20} color={colors.text.muted} strokeWidth={2} />
              <View>
                <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Web (PWA)</Text>
                <Text style={styles.rowHint}>Configure pelo navegador</Text>
              </View>
            </View>
            <View style={[styles.badge, styles.badgeDisconnected]}>
              <Text style={[styles.badgeText, styles.badgeTextDisconnected]}>
                {webPushEnabled ? 'ATIVO' : 'INATIVO'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Email — em breve */}
          <View style={[styles.channelRow, styles.rowSoon]} pointerEvents="none">
            <View style={styles.rowLeft}>
              <Mail size={20} color={colors.text.muted} strokeWidth={2} />
              <Text style={styles.rowLabel}>Email</Text>
            </View>
            <View style={[styles.badge, styles.badgeDisconnected]}>
              <Text style={[styles.badgeText, styles.badgeTextDisconnected]}>EM BREVE</Text>
            </View>
          </View>
        </View>

        {/* Aviso canal mínimo */}
        {showChannelWarning && (
          <Text style={styles.channelWarning}>
            Ative ao menos um canal para receber lembretes de dose.
          </Text>
        )}

        {/* Modo de envio */}
        <Text style={styles.sectionLabel}>MODO DE ENVIO</Text>
        <View style={styles.card}>
          {MODES.map((m, idx) => (
            <React.Fragment key={m.value}>
              <TouchableOpacity
                style={styles.modeRow}
                onPress={() => handleModeSelect(m.value)}
                disabled={!globalEnabled}
                activeOpacity={0.7}
                accessibilityLabel={`Modo: ${m.label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: notificationMode === m.value }}
              >
                <View style={[styles.radio, notificationMode === m.value && styles.radioActive]}>
                  {notificationMode === m.value && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.rowLabel, !globalEnabled && { color: colors.text.muted }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
              {idx < MODES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Hora do resumo — só quando digest_morning */}
        {notificationMode === 'digest_morning' && globalEnabled && (
          <>
            <Text style={styles.sectionLabel}>HORA DO RESUMO DIÁRIO</Text>
            <View style={[styles.card, styles.timeRow]}>
              <Text style={styles.rowLabel}>Enviar resumo às</Text>
              <TimePicker
                value={digestTime}
                label="Hora do resumo"
                onChange={(v) => { setDigestTime(v); persist({ digestTime: v }) }}
              />
            </View>
          </>
        )}

        {/* Não me incomode */}
        <Text style={styles.sectionLabel}>NÃO ME INCOMODE</Text>
        <View style={[styles.card, styles.globalRow]}>
          <Text style={[styles.rowLabel, !globalEnabled && { color: colors.text.muted }]}>
            Silenciar por período
          </Text>
          <Switch
            value={quietHoursEnabled && globalEnabled}
            onValueChange={handleQuietHoursToggle}
            disabled={!globalEnabled}
            trackColor={{ false: colors.neutral[200], true: colors.primary[500] }}
            thumbColor={colors.bg.card}
            accessibilityLabel="Ativar horas de silêncio"
          />
        </View>

        {quietHoursEnabled && globalEnabled && (
          <View style={[styles.card, styles.timeRow]}>
            <Text style={styles.rowLabel}>Das</Text>
            <TimePicker
              value={quietHoursStart}
              label="Início do silêncio"
              onChange={(v) => { setQuietHoursStart(v); persist({ quietHoursStart: v }) }}
            />
            <Text style={styles.rowLabel}>às</Text>
            <TimePicker
              value={quietHoursEnd}
              label="Fim do silêncio"
              onChange={(v) => { setQuietHoursEnd(v); persist({ quietHoursEnd: v }) }}
            />
          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
  },
  header: {
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.muted,
    lineHeight: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    marginTop: spacing[5],
    marginLeft: spacing[1],
  },

  // Card container
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    overflow: 'hidden',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing[4],
  },

  // Rows
  globalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: 56,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  rowSoon: {
    opacity: 0.4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  rowHint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },

  // Badges
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  badgeConnected: {
    backgroundColor: colors.status.success + '22',
  },
  badgeDisconnected: {
    backgroundColor: colors.neutral[200],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  badgeTextConnected: {
    color: colors.status.success,
  },
  badgeTextDisconnected: {
    color: colors.text.muted,
  },

  // Aviso canal mínimo
  channelWarning: {
    fontSize: 12,
    color: colors.status.error,
    marginTop: spacing[2],
    marginLeft: spacing[1],
  },

  // Modo radio
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: 52,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary[600],
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
  },

  // Time picker row
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.sm,
  },
  timePickerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[600],
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing[4],
    maxHeight: 360,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
  },
  hourList: {
    maxHeight: 300,
  },
  hourItem: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  hourItemActive: {
    backgroundColor: colors.primary[50],
  },
  hourItemText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  hourItemTextActive: {
    fontWeight: '700',
    color: colors.primary[600],
  },
})
