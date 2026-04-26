/**
 * NotificationInboxScreen — Central de Avisos v1 (Mobile).
 *
 * SectionList com agrupamento temporal (Hoje / Ontem / Esta semana / Mais antigos).
 * Cruza dose_reminder com medicine_logs para exibir "✓ Tomada" sem navegação extra.
 * R-169: SafeAreaView obrigatório. R-180: header 28/800 padrão Santuário.
 * R-184: auto-refresh no useNotificationLog. R-187: cache key por userId.
 */
import { useEffect, useCallback, useMemo, useState } from 'react'
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Bell, WifiOff } from 'lucide-react-native'
import { z } from 'zod'
import { getTodayLocal } from '@dosiq/core'
import { ROUTES } from '../../../navigation/routes'
import { useNotificationLog } from '../../../shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '../../../shared/hooks/useUnreadNotificationCount'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import NotificationItem from '../components/NotificationItem'
import { colors } from '../../../shared/styles/tokens'

// Schema para validar medicine_logs (R-010)
const doseLogSchema = z.array(z.object({
  id:          z.string(),
  protocol_id: z.string().nullable(),
  taken_at:    z.string(),
}))

const DEEP_LINK_TARGETS = {
  dashboard:  ROUTES.TODAY,
  stock:      ROUTES.STOCK,
  treatment:  ROUTES.TREATMENTS,
  history:    ROUTES.TODAY,
  'bulk-plan': ROUTES.TODAY,
  'bulk-misc': ROUTES.TODAY,
}

// ─── Agrupamento temporal ──────────────────────────────────────────────────────

function groupByDay(notifications) {
  const now              = new Date()
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday - 86_400_000)
  const startOfWeek      = new Date(startOfToday - 6 * 86_400_000)

  const buckets = [
    { title: 'Hoje',         data: [] },
    { title: 'Ontem',        data: [] },
    { title: 'Esta semana',  data: [] },
    { title: 'Mais antigos', data: [] },
  ]

  for (const n of notifications) {
    const d = new Date(n.sent_at)
    if      (d >= startOfToday)     buckets[0].data.push(n)
    else if (d >= startOfYesterday) buckets[1].data.push(n)
    else if (d >= startOfWeek)      buckets[2].data.push(n)
    else                            buckets[3].data.push(n)
  }

  return buckets.filter(b => b.data.length > 0)
}

// ─── Cruzamento dose tomada ────────────────────────────────────────────────────

function buildWasTakenMap(notifications, doseLogs) {
  if (!doseLogs?.length) return {}
  const map = {}
  for (const n of notifications) {
    if (n.notification_type === 'dose_reminder') {
      if (!n.protocol_id) continue
      map[n.id] = doseLogs.some(
        log =>
          log.protocol_id === n.protocol_id &&
          new Date(log.taken_at) > new Date(n.sent_at)
      )
    } else if (
      n.notification_type === 'dose_reminder_by_plan' ||
      n.notification_type === 'dose_reminder_misc'
    ) {
      const protocolIds = n.provider_metadata?.protocol_ids ?? []
      if (!protocolIds.length) continue
      const taken = protocolIds.filter(pid =>
        doseLogs.some(
          log => log.protocol_id === pid &&
                 new Date(log.taken_at) > new Date(n.sent_at)
        )
      ).length
      map[n.id] = { taken, total: protocolIds.length }
    }
  }
  return map
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NotificationInboxScreen({ navigation, route }) {
  const userId = route?.params?.userId

  const { data, loading, error, stale, refresh } = useNotificationLog({ userId, limit: 30 })
  const { unreadCount, markAllRead } = useUnreadNotificationCount(data, userId)

  // localDay: detecta virada de dia via AppState + timer de meia-noite (R5-008)
  const [localDay, setLocalDay] = useState(getTodayLocal)
  useEffect(() => {
    let midnightTimer
    const schedule = () => {
      const now = new Date()
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(0, 0, 0, 0)
      midnightTimer = setTimeout(() => {
        setLocalDay(getTodayLocal())
        schedule()
      }, next.getTime() - now.getTime() + 1000)
    }
    schedule()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setLocalDay(getTodayLocal())
    })
    return () => { sub.remove(); clearTimeout(midnightTimer) }
  }, [])

  // Busca medicine_logs dos últimos 7 dias para cruzar com dose_reminders (R-010, R-028)
  const [doseLogs, setDoseLogs] = useState([])
  const loadDoseLogs = useCallback(async () => {
    if (!userId) return
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data: rows, error: fetchErr } = await supabase
      .from('medicine_logs')
      .select('id, protocol_id, taken_at')
      .eq('user_id', userId)
      .gte('taken_at', since)
    if (fetchErr) {
      if (__DEV__) console.warn('[NotificationInboxScreen] doseLogs fetch error', fetchErr.message)
      return
    }
    const parsed = doseLogSchema.safeParse(rows ?? [])
    setDoseLogs(parsed.success ? parsed.data : [])
  }, [userId])

  useEffect(() => { loadDoseLogs() }, [loadDoseLogs])

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadDoseLogs()])
  }, [refresh, loadDoseLogs])

  // Marca tudo como lido ao abrir
  useEffect(() => {
    if (!loading && data) markAllRead()
  }, [loading, data, markAllRead])

  const sections = useMemo(
    () => groupByDay(data ?? []),
    [data, localDay]
  )

  const wasTakenMap = useMemo(
    () => buildWasTakenMap(data ?? [], doseLogs),
    [data, doseLogs]
  )

  const renderItem = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      wasTaken={wasTakenMap[item.id]}
      onNavigate={(view) => {
        const target = DEEP_LINK_TARGETS[view]
        if (!target) return
        const params = {}
        if (item.notification_type === 'dose_reminder_by_plan') {
          params.bulkMode = 'plan'
          params.planId = item.treatment_plan_id
          params.treatmentPlanName = item.treatment_plan_name
          const d = new Date(item.sent_at)
          params.at = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        } else if (item.notification_type === 'dose_reminder_misc') {
          params.bulkMode = 'misc'
          params.protocolIds = item.provider_metadata?.protocol_ids ?? []
          const d = new Date(item.sent_at)
          params.at = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        }
        navigation.navigate(target, params)
      }}
    />
  ), [navigation, wasTakenMap])

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  ), [])

  const renderSeparator = useCallback(() => <View style={styles.separator} />, [])

  const renderEmpty = useCallback(() => {
    if (loading) return null
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Bell size={36} color={colors.text?.muted ?? '#9ca3af'} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Nenhuma notificação ainda</Text>
        <Text style={styles.emptyBody}>
          Seus lembretes de dose, alertas de estoque e resumos diários aparecerão aqui.
        </Text>
      </View>
    )
  }, [loading])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={colors.text?.primary ?? '#111827'} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Central de Avisos</Text>
          {unreadCount > 0 && !loading && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {stale && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color={colors.status?.warning ?? '#d97706'} strokeWidth={2} />
          <Text style={styles.offlineText}>Exibindo dados salvos localmente</Text>
        </View>
      )}

      {loading && !data && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary?.[600] ?? '#006a5e'} size="large" />
        </View>
      )}

      {error && !data && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erro ao carregar: {error}</Text>
        </View>
      )}

      {(!loading || data) && !error && (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => item.id ?? String(i)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={loading && !!data}
              onRefresh={refreshAll}
              tintColor={colors.primary?.[600] ?? '#006a5e'}
            />
          }
          contentContainerStyle={sections.length === 0 ? styles.emptyList : styles.listContent}
          showsVerticalScrollIndicator={false}
          accessibilityRole="list"
          accessibilityLabel="Lista de notificações"
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.bg?.default ?? '#f9fafb' },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border?.light ?? '#e5e7eb' },
  backButton:       { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg?.card ?? '#f3f4f6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:            { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.text?.primary ?? '#111827' },
  unreadBadge:      { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 100, backgroundColor: colors.status?.error ?? '#dc2626', alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText:  { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  offlineBanner:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(217, 119, 6, 0.20)' },
  offlineText:      { fontSize: 13, fontWeight: '500', color: colors.status?.warning ?? '#d97706' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer:   { margin: 20, padding: 16, borderRadius: 12, backgroundColor: 'rgba(220, 38, 38, 0.06)' },
  errorText:        { fontSize: 14, color: colors.status?.error ?? '#dc2626' },
  sectionHeader:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  sectionTitle:     { fontSize: 12, fontWeight: '600', color: colors.text?.muted ?? '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  separator:        { height: 1, marginHorizontal: 20, backgroundColor: colors.border?.light ?? '#e5e7eb' },
  listContent:      { paddingBottom: 40 },
  emptyList:        { flex: 1 },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 12 },
  emptyIconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg?.card ?? '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: colors.text?.primary ?? '#111827', textAlign: 'center' },
  emptyBody:        { fontSize: 14, fontWeight: '400', color: colors.text?.muted ?? '#6b7280', textAlign: 'center', lineHeight: 21 },
})
