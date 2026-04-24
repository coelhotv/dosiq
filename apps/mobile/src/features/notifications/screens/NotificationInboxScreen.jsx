/**
 * NotificationInboxScreen — Central de Avisos (Mobile Native).
 *
 * R-169: SafeAreaView obrigatório. R-180: header 28/800 padrão Santuário.
 * R-184: auto-refresh já no useNotificationLog. R-187: cache key por userId no hook.
 */
import { useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Bell, WifiOff } from 'lucide-react-native'
import { ROUTES } from '../../../navigation/routes'
import { useNotificationLog } from '../../../shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '../../../shared/hooks/useUnreadNotificationCount'
import NotificationItem from '../components/NotificationItem'
import { colors } from '../../../shared/styles/tokens'

// Mapa estático fora do componente — evita recriação por render (perf) e usa constantes canônicas de rota
const DEEP_LINK_TARGETS = {
  dashboard: ROUTES.TODAY,
  stock:     ROUTES.STOCK,
  treatment: ROUTES.TREATMENTS,
  history:   ROUTES.TODAY, // Mobile não tem tela de histórico — fallback para Hoje
}

export default function NotificationInboxScreen({ navigation, route }) {
  const userId = route?.params?.userId

  const { data, loading, error, stale, refresh } = useNotificationLog({ userId, limit: 30 })
  const { unreadCount, markAllRead } = useUnreadNotificationCount(data, userId)

  useEffect(() => {
    if (!loading && data) markAllRead()
  }, [loading, data, markAllRead])

  const renderItem = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onNavigate={(view) => {
        const target = DEEP_LINK_TARGETS[view]
        if (target) navigation.navigate(target)
      }}
    />
  ), [navigation])

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
          Quando você receber lembretes ou alertas, eles aparecerão aqui.
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
        <FlatList
          data={data ?? []}
          keyExtractor={(item, i) => item.id ?? String(i)}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading && !!data}
              onRefresh={refresh}
              tintColor={colors.primary?.[600] ?? '#006a5e'}
            />
          }
          contentContainerStyle={data?.length === 0 ? styles.emptyList : styles.listContent}
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
  errorText:        { fontSize: 14, color: colors.status?.error ?? '#dc2626', fontWeight: '400' },
  listContent:      { paddingTop: 8, paddingBottom: 40 },
  emptyList:        { flex: 1 },
  separator:        { height: 1, marginHorizontal: 20, backgroundColor: colors.border?.light ?? '#e5e7eb' },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 12 },
  emptyIconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg?.card ?? '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: colors.text?.primary ?? '#111827', textAlign: 'center' },
  emptyBody:        { fontSize: 14, fontWeight: '400', color: colors.text?.muted ?? '#6b7280', textAlign: 'center', lineHeight: 21 },
})
