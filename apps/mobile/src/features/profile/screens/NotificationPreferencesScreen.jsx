import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react'
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
  AppState,
} from 'react-native'
import { Bell, Smartphone, Send, Globe, ChevronRight, Check, AlertTriangle } from 'lucide-react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { useProfile } from '@profile/hooks/useProfile'
import { getPushPermissionStatus, enablePushAtIntent } from '@platform/notifications/pushPermission'
import { registerPushToken } from '@platform/notifications/registerPushToken'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { updateNotificationSettings } from '../services/profileService'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import AlarmToggleSection from '@profile/components/AlarmToggleSection'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { parseLocalDate } from '@dosiq/core'
import { debugLog, errorLog } from '@shared/utils/debugLog'

// Horas disponíveis para o picker inline
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0')
  return `${h}:00`
})

// Constrói o payload de configurações de notificação para o banco
function _buildNotificationSettingsPayload(patch, state) {
  // Design A (inbox-first): sem master global. Cada canal persiste sozinho; os
  // lembretes do inbox independem disto. notification_preference é derivado dos
  // canais (legado — api/notify ainda usa como fallback): 'none' só se tudo off.
  const { mobilePushEnabled, isTelegramConnected, webPushEnabled, notificationMode,
          quietHoursEnabled, quietHoursStart, quietHoursEnd, digestTime } = state
  const mobile = patch.mobilePushEnabled ?? mobilePushEnabled
  const telegram = isTelegramConnected
  const web = patch.webPushEnabled ?? webPushEnabled
  const mode = patch.notificationMode ?? notificationMode
  const qEnabled = patch.quietHoursEnabled ?? quietHoursEnabled
  const qStart = patch.quietHoursStart ?? quietHoursStart
  const qEnd = patch.quietHoursEnd ?? quietHoursEnd
  const dTime = patch.digestTime ?? digestTime

  return {
    notification_mode: mode,
    quiet_hours_start: qEnabled ? qStart : null,
    quiet_hours_end: qEnabled ? qEnd : null,
    quiet_hours_enabled: qEnabled,
    digest_time: dTime,
    channel_mobile_push_enabled: mobile,
    channel_web_push_enabled: web,
    channel_telegram_enabled: telegram,
    notification_preference: deriveLegacyPreference({
      channel_mobile_push_enabled: mobile,
      channel_telegram_enabled: telegram,
    }),
  }
}

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
                  {item === value && <Check size={16} color={colors.brand.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

// Seção de canais de aviso (entrega): App Push + Telegram + Web + Email.
// Inbox-first: NÃO gateados por master. O push reflete a PERMISSÃO real do SO —
// se negada, mostra OFF + legenda "bloqueado" e o tap dispara o CTA p/ Configs.
function NotificationChannelsSection({
  mobilePushEnabled,
  hasPermission,
  webPushEnabled,
  isTelegramConnected,
  onMobilePushToggle,
  onTelegramPress,
}) {
  return (
    <View style={styles.card}>
      {!hasPermission ? (
        // Bloqueado no SO: linha em destaque âmbar, tocável → abre Configurações
        // (via onMobilePushToggle → Alert/openSettings). Chip "Ativar" deixa a
        // ação óbvia para a dona Maria.
        <TouchableOpacity
          style={[styles.channelRow, styles.channelRowBlocked]}
          onPress={() => onMobilePushToggle(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Notificações no celular bloqueadas. Toque para ativar nas Configurações."
        >
          <View style={styles.rowLeft}>
            <AlertTriangle size={20} color={colors.status.warning} strokeWidth={2} />
            <View style={styles.flexShrink}>
              <Text style={styles.rowLabel}>Celular</Text>
              <Text style={styles.rowHintWarning}>Bloqueado — toque para ativar nas Configurações</Text>
            </View>
          </View>
          <View style={styles.activateChip}>
            <Text style={styles.activateChipText}>Ativar</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.channelRow}>
          <View style={styles.rowLeft}>
            <Smartphone size={20} color={colors.brand.primary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Celular</Text>
          </View>
          <Switch
            value={mobilePushEnabled}
            onValueChange={onMobilePushToggle}
            trackColor={{ false: colors.neutral[200], true: colors.brand.primary }}
            thumbColor={colors.bg.card}
            accessibilityLabel="Ativar notificações no celular"
          />
        </View>
      )}

      <View style={styles.divider} />

      <TouchableOpacity style={styles.channelRow} onPress={onTelegramPress} activeOpacity={0.7} accessibilityLabel="Configurar Telegram">
        <View style={styles.rowLeft}>
          <Send size={20} color={colors.brand.primary} strokeWidth={2} />
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
    </View>
  )
}

// Seção de modo de envio (radio buttons)
function NotificationModeSection({ notificationMode, onModeSelect }) {
  const MODES = [
    { value: 'realtime', label: 'Alertas unitários' },
    { value: 'digest_morning', label: 'Resumo diário' },
    { value: 'silent', label: 'Silencioso' },
  ]
  return (
    <View style={styles.card}>
      {MODES.map((m, idx) => (
        <React.Fragment key={m.value}>
          <TouchableOpacity
            style={styles.modeRow}
            onPress={() => onModeSelect(m.value)}
            activeOpacity={0.7}
            accessibilityLabel={`Modo: ${m.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: notificationMode === m.value }}
          >
            <View style={[styles.radio, notificationMode === m.value && styles.radioActive]}>
              {notificationMode === m.value && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.rowLabel}>
              {m.label}
            </Text>
          </TouchableOpacity>
          {idx < MODES.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  )
}

// Render principal da tela de preferências (pós-carregamento)
function NotificationPreferencesContent({
  navigation, mobilePushEnabled, hasPermission, webPushEnabled, isTelegramConnected,
  showChannelWarning, notificationMode, digestTime, quietHoursEnabled, quietHoursStart, quietHoursEnd,
  handleMobilePushToggle, handleTelegramPress, handleModeSelect,
  handleQuietHoursToggle, setDigestTime, setQuietHoursStart, setQuietHoursEnd, persist,
}) {
  const showDigest = notificationMode === 'digest_morning'

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Voltar">
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Preferências</Text>
          <Text style={styles.subtitle}>Escolha onde e quando ser avisado.</Text>
        </View>

        {/* Inbox-first: lembretes sempre existem no app; canais abaixo são extras. */}
        <View style={[styles.card, styles.globalRow]}>
          <View style={styles.rowLeft}>
            <Bell size={20} color={colors.brand.primary} strokeWidth={2} />
            <View style={styles.flexShrink}>
              <Text style={styles.rowLabel}>Lembretes sempre ligados</Text>
              <Text style={styles.rowHint}>
                Sempre no app. Escolha abaixo como também ser avisada.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>CANAIS DE AVISO</Text>
        <NotificationChannelsSection
          mobilePushEnabled={mobilePushEnabled} hasPermission={hasPermission}
          webPushEnabled={webPushEnabled} isTelegramConnected={isTelegramConnected}
          onMobilePushToggle={handleMobilePushToggle} onTelegramPress={handleTelegramPress}
        />

        {showChannelWarning && (
          <Text style={styles.channelWarning}>
            Ative ao menos um canal para ser avisada fora do app.
          </Text>
        )}

        {/* Alarme nativo persistente (Spec 001) — toggle auto-contido, default OFF. */}
        <AlarmToggleSection />

        <Text style={styles.sectionLabel}>MODO DE ENVIO</Text>
        <NotificationModeSection
          notificationMode={notificationMode} onModeSelect={handleModeSelect}
        />

        {showDigest && (
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

        <NotificationQuietHoursSection
          quietHoursEnabled={quietHoursEnabled}
          quietHoursStart={quietHoursStart} quietHoursEnd={quietHoursEnd}
          onToggle={handleQuietHoursToggle}
          onStartChange={(v) => { setQuietHoursStart(v); persist({ quietHoursStart: v }) }}
          onEndChange={(v) => { setQuietHoursEnd(v); persist({ quietHoursEnd: v }) }}
        />

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </ScreenContainer>
  )
}

// Seção de horas silenciosas
function NotificationQuietHoursSection({
  quietHoursEnabled,
  quietHoursStart,
  quietHoursEnd,
  onToggle,
  onStartChange,
  onEndChange,
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>NÃO ME INCOMODE</Text>
      <View style={[styles.card, styles.globalRow]}>
        <Text style={styles.rowLabel}>
          Silenciar por período
        </Text>
        <Switch
          value={quietHoursEnabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.neutral[200], true: colors.brand.primary }}
          thumbColor={colors.bg.card}
          accessibilityLabel="Ativar horas de silêncio"
        />
      </View>

      {quietHoursEnabled && (
        <View style={[styles.card, styles.timeRow]}>
          <Text style={styles.rowLabel}>Das</Text>
          <TimePicker value={quietHoursStart} label="Início do silêncio" onChange={onStartChange} />
          <Text style={styles.rowLabel}>às</Text>
          <TimePicker value={quietHoursEnd} label="Fim do silêncio" onChange={onEndChange} />
        </View>
      )}
    </>
  )
}

export default function NotificationPreferencesScreen({ navigation }) {
  const { user } = useAuth()
  const { settings, refresh } = useProfile()
  const isTelegramConnected = !!settings?.telegram_chat_id

  const [mobilePushEnabled, setMobilePushEnabled] = useState(true)
  const [webPushEnabled, setWebPushEnabled] = useState(false)
  const [notificationMode, setNotificationMode] = useState('realtime')
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00')
  const [digestTime, setDigestTime] = useState('07:00')
  const [hasPermission, setHasPermission] = useState(false)
  // Ref de permissão (R-010: declarado junto aos states, antes de effects/handlers).
  // null = ainda não sabido; usado p/ agir só na transição negado→concedido.
  const wasGrantedRef = useRef(null)

  // Carregar valores do banco ao montar
  useEffect(() => {
    debugLog('NotificationPreferencesScreen', `settings: ${JSON.stringify(settings)}`)
    if (!settings) return

    startTransition(() => {
      const pref = settings.notification_preference
      setQuietHoursEnabled(settings.quiet_hours_enabled ?? !!(settings.quiet_hours_start || settings.quiet_hours_end))
      setQuietHoursStart(settings.quiet_hours_start ?? '22:00')
      setQuietHoursEnd(settings.quiet_hours_end ?? '07:00')
      setDigestTime(settings.digest_time ?? '07:00')
      setNotificationMode(settings.notification_mode ?? 'realtime')

      // Design A: canais independentes, sempre sincronizados (sem master global).
      setMobilePushEnabled(
        settings.channel_mobile_push_enabled ??
        (pref === 'mobile_push' || pref === 'both')
      )
      setWebPushEnabled(settings.channel_web_push_enabled ?? false)
    })
  }, [settings])

  const hasAnyChannel = (mobilePushEnabled && hasPermission) || isTelegramConnected || webPushEnabled
  const showChannelWarning = !hasAnyChannel

  // Salvar no banco (debounce manual: chama após cada alteração)
  const persist = useCallback(async (patch) => {
    if (!user?.id) return
    const state = {
      mobilePushEnabled, isTelegramConnected, webPushEnabled, notificationMode,
      quietHoursEnabled, quietHoursStart, quietHoursEnd, digestTime,
    }
    try {
      const payload = _buildNotificationSettingsPayload(patch, state)
      const result = await updateNotificationSettings(user.id, payload)
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
      quietHoursEnabled, quietHoursStart, quietHoursEnd, digestTime, refresh])

  const checkPermission = useCallback(async () => {
    try {
      // Leitura PURA do status — NUNCA dispara o prompt do SO.
      const { granted } = await getPushPermissionStatus()
      setHasPermission(granted)
      // Transição real negado→concedido (ex.: voltou das Configs do SO autorizando):
      // registra o device E liga o canal — autorizar é intenção clara de receber push.
      // userId explícito evita getUser() redundante (já temos user do useAuth).
      if (wasGrantedRef.current === false && granted) {
        registerPushToken({ supabase, userId: user?.id }).catch(() => {})
        setMobilePushEnabled(true)
        persist({ mobilePushEnabled: true })
      }
      wasGrantedRef.current = granted
    } catch (err) {
      debugLog('NotificationPreferencesScreen', `Erro permissão: ${err.message}`)
    }
  }, [persist, user])

  // Re-checa permissão ao focar a tela (navegação)...
  useFocusEffect(
    useCallback(() => {
      startTransition(() => { checkPermission() })
    }, [checkPermission])
  )

  // ...e ao voltar do background (ex.: retorno das Configurações do SO). Isto NÃO
  // é foco de navegação — a tela nunca perdeu foco; só o app foi pro background.
  // Sem este listener o toggle não atualizava ao reconceder a permissão no SO.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkPermission()
    })
    return () => sub.remove()
  }, [checkPermission])

  async function handleMobilePushToggle(val) {
    if (val && !hasPermission) {
      // Ponto de intenção: pede permissão e registra o token se concedido.
      const { granted, blocked } = await enablePushAtIntent({ supabase })
      if (!granted) {
        if (blocked) {
          Alert.alert(
            'Permissão necessária',
            'Abrir Configurações para ativar notificações?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
            ]
          )
        }
        return
      }
      setHasPermission(true)
    }
    setMobilePushEnabled(val)
    persist({ mobilePushEnabled: val })
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

  return (
    <NotificationPreferencesContent
      navigation={navigation}
      mobilePushEnabled={mobilePushEnabled} hasPermission={hasPermission}
      webPushEnabled={webPushEnabled} isTelegramConnected={isTelegramConnected}
      showChannelWarning={showChannelWarning} notificationMode={notificationMode}
      digestTime={digestTime} quietHoursEnabled={quietHoursEnabled}
      quietHoursStart={quietHoursStart} quietHoursEnd={quietHoursEnd}
      handleMobilePushToggle={handleMobilePushToggle}
      handleTelegramPress={handleTelegramPress} handleModeSelect={handleModeSelect}
      handleQuietHoursToggle={handleQuietHoursToggle}
      setDigestTime={setDigestTime} setQuietHoursStart={setQuietHoursStart}
      setQuietHoursEnd={setQuietHoursEnd} persist={persist}
    />
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
    color: colors.brand.primary,
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
  rowHintWarning: {
    fontSize: 12,
    color: colors.status.warning,
    marginTop: 2,
  },
  flexShrink: {
    flex: 1,
  },
  channelRowBlocked: {
    // Banda âmbar preenchendo todo o row (full-width); conteúdo segue no padding
    // padrão do channelRow, alinhado com Telegram/Web.
    backgroundColor: colors.supplement[50],
  },
  activateChip: {
    backgroundColor: colors.status.warning,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  activateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg.card,
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
    borderColor: colors.brand.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.primary,
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
    color: colors.brand.primary,
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
    backgroundColor: colors.brand.primary + '11', // Opacidade leve para o item ativo
  },
  hourItemText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  hourItemTextActive: {
    fontWeight: '700',
    color: colors.brand.primary,
  },
})
