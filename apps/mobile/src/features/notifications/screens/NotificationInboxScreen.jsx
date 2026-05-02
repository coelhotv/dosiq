/**
 * NotificationInboxScreen — Central de Avisos v2 (Mobile).
 *
 * SectionList com agrupamento temporal (Hoje / Ontem / Esta semana / Mais antigos).
 * Cruza dose_reminder com medicine_logs para exibir "✓ Tomada" sem navegação extra.
 * Filtros horizontais: Todos / Não lidos / Doses / Estoque.
 * R-169: SafeAreaView obrigatório. R-180: header 28/800 padrão Santuário.
 * R-184: auto-refresh no useNotificationLog. R-187: cache key por userId.
 */
import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, AppState, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, BellOff, Settings, WifiOff } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'
import { getTodayLocal, getNow, parseISO, daysDifference } from '@dosiq/core'
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
  dashboard:        ROUTES.TODAY,
  stock:            ROUTES.STOCK,
  treatment:        ROUTES.TREATMENTS,
  history:          ROUTES.TODAY,
  'bulk-plan':      ROUTES.TODAY,
  'bulk-misc':      ROUTES.TODAY,
  'dose-individual': ROUTES.TODAY,
}

// Tipos de notificação de dose (para filtro)
const DOSE_KINDS = [
  'dose_reminder',
  'dose_reminder_by_plan',
  'dose_reminder_misc',
  'missed_dose',
  'daily_digest',
]

// Chips de filtro
const FILTERS = [
  { key: 'all',    label: 'Todos' },
  { key: 'unread', label: 'Não lidos' },
  { key: 'doses',  label: 'Doses' },
  { key: 'stock',  label: 'Estoque' },
]

// Chave AsyncStorage para "último acesso" (R-187)
const getStorageKey = (userId) =>
  userId ? `@dosiq/notif-last-seen:${userId}` : '@dosiq/notif-last-seen'

// ─── Agrupamento temporal ──────────────────────────────────────────────────────

function groupByDay(notifications) {
  const now = getNow()
  const todayStr = getTodayLocal()

  const buckets = [
    { title: 'Hoje',         data: [] },
    { title: 'Ontem',        data: [] },
    { title: 'Esta semana',  data: [] },
    { title: 'Mais antigos', data: [] },
  ]

  for (const n of notifications) {
    if (!n.sent_at) continue
    const diff = daysDifference(n.sent_at.split('T')[0], todayStr)
    
    if      (diff === 0) buckets[0].data.push(n)
    else if (diff === 1) buckets[1].data.push(n)
    else if (diff <= 7)  buckets[2].data.push(n)
    else                 buckets[3].data.push(n)
  }

  return buckets.filter(b => b.data.length > 0)
}

// ─── Cruzamento dose tomada ────────────────────────────────────────────────────

function buildWasTakenMap(notifications, doseLogs) {
  if (!doseLogs?.length) return {}
  const map = {}
  for (const n of notifications) {
    const sentAtTime = parseISO(n.sent_at).getTime()
    if (n.notification_type === 'dose_reminder') {
      if (!n.protocol_id) continue
      map[n.id] = doseLogs.some(
        log =>
          log.protocol_id === n.protocol_id &&
          parseISO(log.taken_at).getTime() > sentAtTime
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
                 parseISO(log.taken_at).getTime() > sentAtTime
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

  // lastSeen local: necessário para filtro "Não lidos" (R-187)
  const [lastSeen, setLastSeen] = useState(null)
  useEffect(() => {
    AsyncStorage.getItem(getStorageKey(userId))
      .then((val) => setLastSeen(val))
      .catch((err) => {
        if (__DEV__) console.warn('[NotificationInboxScreen] lastSeen read error', err)
      })
  }, [userId])

  // Filtro ativo
  const [activeFilter, setActiveFilter] = useState('all')
  const hasMarkedRead = useRef(false)

  // localDay: detecta virada de dia via AppState + timer de meia-noite (R5-008)
  const [localDay, setLocalDay] = useState(getTodayLocal)
  useEffect(() => {
    let midnightTimer
    const schedule = () => {
      const now = getNow()
      const next = new Date(now.getTime())
      next.setDate(next.getDate() + 1)
      next.setHours(0, 0, 0, 0)
      
      const delay = next.getTime() - now.getTime()
      midnightTimer = setTimeout(() => {
        setLocalDay(getTodayLocal())
        schedule()
      }, delay + 1000)
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
    const since = new Date(getNow().getTime() - 7 * 86_400_000).toISOString()
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

  // Marca tudo como lido apenas no carregamento inicial (useRef garante execução única)
  useEffect(() => {
    if (!loading && data && !hasMarkedRead.current) {
      hasMarkedRead.current = true
      markAllRead()
      AsyncStorage.getItem(getStorageKey(userId))
        .then((val) => setLastSeen(val))
        .catch(() => {})
    }
  }, [loading, data, markAllRead, userId])

  // Sections sem filtro (agrupamento temporal)
  const sections = useMemo(
    () => groupByDay(data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, localDay]
  )

  // Sections com filtro aplicado
  const filteredSections = useMemo(() => {
    const lastSeenTime = lastSeen ? parseISO(lastSeen).getTime() : null

    const filterItem = (item) => {
      if (activeFilter === 'all')    return true
      if (activeFilter === 'unread') {
        if (!item.sent_at) return false
        // Antes de markAllRead ser persistido, lastSeenTime pode ser null → tudo é não lido
        if (!lastSeenTime) return true
        return parseISO(item.sent_at).getTime() > lastSeenTime
      }
      if (activeFilter === 'doses')  return DOSE_KINDS.includes(item.notification_type)
      if (activeFilter === 'stock')  return item.notification_type === 'stock_alert'
      return true
    }

    return sections
      .map(s => ({ ...s, data: s.data.filter(filterItem) }))
      .filter(s => s.data.length > 0)
  }, [sections, activeFilter, lastSeen])

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
        const d = parseISO(item.sent_at)
        const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

        if (item.notification_type === 'dose_reminder' && item.protocol_id) {
          params.screen = 'dose-individual'
          params.protocolId = item.protocol_id
          params.at = hhmm
        } else if (item.notification_type.startsWith('dose_reminder_')) {
          params.at = hhmm
          if (item.notification_type === 'dose_reminder_by_plan') {
            params.screen = 'bulk-plan'
            params.planId = item.treatment_plan_id
            params.treatmentPlanName = item.treatment_plan_name
          } else {
            params.screen = 'bulk-misc'
            params.protocolIds = item.provider_metadata?.protocol_ids ?? []
          }
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
      <View style={styles.emptyState}>
        <BellOff size={40} color={colors.text?.muted ?? '#9ca3af'} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Tudo em dia por aqui</Text>
        <Text style={styles.emptyBody}>
          {activeFilter === 'all'
            ? 'Quando houver lembretes, alertas de estoque ou resumos, eles aparecem aqui.'
            : 'Nenhum item nesta categoria.'}
        </Text>
      </View>
    )
  }, [loading, activeFilter])

  const primaryColor = colors.primary?.[600] ?? '#006a5e'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={colors.text?.primary ?? '#111827'} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Avisos</Text>
          {unreadCount > 0 && !loading && (
            <Text style={[styles.subtitle, { color: primaryColor }]}>
              {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate(ROUTES.NOTIFICATION_PREFERENCES)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Preferências de notificação"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Settings size={22} color={colors.text?.primary ?? '#111827'} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* ── Banner offline ── */}
      {stale && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color={colors.status?.warning ?? '#d97706'} strokeWidth={2} />
          <Text style={styles.offlineText}>Exibindo dados salvos localmente</Text>
        </View>
      )}

      {/* ── Chips de filtro ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: primaryColor, borderColor: primaryColor }
                  : styles.chipInactive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Conteúdo principal ── */}
      {loading && !data && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      )}

      {error && !data && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erro ao carregar: {error}</Text>
        </View>
      )}

      {(!loading || data) && !error && (
        <SectionList
          sections={filteredSections}
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
              tintColor={primaryColor}
            />
          }
          contentContainerStyle={filteredSections.length === 0 ? styles.emptyList : styles.listContent}
          showsVerticalScrollIndicator={false}
          accessibilityRole="list"
          accessibilityLabel="Lista de notificações"
        />
      )}
    </SafeAreaView>
  )
}

const PRIMARY = colors.primary?.[600] ?? '#006a5e'

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.bg?.default ?? '#f9fafb' },

  // Header
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border?.light ?? '#e5e7eb' },
  iconButton:       { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg?.card ?? '#f3f4f6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleBlock:       { flex: 1 },
  title:            { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.text?.primary ?? '#111827' },
  subtitle:         { fontSize: 13, fontWeight: '500', marginTop: 1 },

  // Banner offline
  offlineBanner:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(217, 119, 6, 0.20)' },
  offlineText:      { fontSize: 13, fontWeight: '500', color: colors.status?.warning ?? '#d97706' },

  // Chips de filtro
  filtersScroll:    { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border?.light ?? '#e5e7eb' },
  filtersContent:   { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip:             { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minHeight: 34, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  chipInactive:     { backgroundColor: colors.bg?.card ?? '#ffffff', borderColor: colors.border?.medium ?? '#d1d5db' },
  chipText:         { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  chipTextActive:   { color: '#ffffff' },
  chipTextInactive: { color: colors.text?.secondary ?? '#374151' },

  // Loading / error
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer:   { margin: 20, padding: 16, borderRadius: 12, backgroundColor: 'rgba(220, 38, 38, 0.06)' },
  errorText:        { fontSize: 14, color: colors.status?.error ?? '#dc2626' },

  // Lista
  sectionHeader:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  sectionTitle:     { fontSize: 12, fontWeight: '600', color: colors.text?.muted ?? '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  separator:        { height: 1, marginHorizontal: 20, backgroundColor: colors.border?.light ?? '#e5e7eb' },
  listContent:      { paddingBottom: 40 },
  emptyList:        { flex: 1 },

  // Zero state
  emptyState:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:       { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, textAlign: 'center', marginTop: 16 },
  emptyBody:        { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
})
