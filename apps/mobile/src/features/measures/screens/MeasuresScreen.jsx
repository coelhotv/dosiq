// MeasuresScreen.jsx — Área de Medidas (012 Fase C · US3b, FR-011b).
// Perfil › Ferramentas › Medidas. Hub v1: TypeChips (glicemia/peso) + tendência (ScatterTrend 7d)
// + histórico cronológico (MeasureCard) + estado-zero. FAB registra; sheet detalhe edita/exclui.
// SaMD (ADR-062): sem zona/meta/linha; cor diferencia tipo, nunca qualidade.

import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ArrowLeft, Plus, Ruler } from 'lucide-react-native'
import { BIOMARKER_TYPE_LABELS, BIOMARKER_TYPE_UNITS } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'
import { useMeasures } from '@measures/hooks/useMeasures'
import MeasureCard from '@measures/components/MeasureCard'
import MeasureLogSheet from '@measures/components/MeasureLogSheet'
import MeasureDetailSheet from '@measures/components/MeasureDetailSheet'
import ScatterTrend from '@measures/components/ScatterTrend'

// Chips de tipo — SEM ícone (IconRuler é a marca única de medida; chips só texto). v1 = 2 tipos.
const HUB_TYPES = ['glicemia', 'peso']

export default function MeasuresScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  // Tipo inicial via deeplink (card "Última medida" do dashboard); default glicemia.
  const [type, setType] = useState(route.params?.type ?? 'glicemia')
  const { items, loading, error, create, update, remove } = useMeasures({ type })

  const [logOpen, setLogOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [detailItem, setDetailItem] = useState(null)

  const openCreate = useCallback(() => { setEditItem(null); setLogOpen(true) }, [])
  const openEdit = useCallback((item) => { setDetailItem(null); setEditItem(item); setLogOpen(true) }, [])

  const handleSaved = useCallback(async (payload) => {
    if (payload.id) {
      const { id, ...patch } = payload
      return update(id, patch)
    }
    return create(payload)
  }, [create, update])

  const handleDelete = useCallback(async (item) => { await remove(item.id) }, [remove])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Medidas</Text>
        <View style={styles.iconButton} />
      </View>

      {/* TypeChips — sem ícone (handoff §4.2) */}
      <View style={styles.chips}>
        {HUB_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => { selectionTap(); setType(t) }}
            style={[styles.chip, type === t && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: type === t }}
            accessibilityLabel={BIOMARKER_TYPE_LABELS[t]}
          >
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{BIOMARKER_TYPE_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScatterTrend items={items} unit={BIOMARKER_TYPE_UNITS[type]} typeLabel={BIOMARKER_TYPE_LABELS[type]} />

        <Text style={styles.sectionTitle}>Histórico</Text>
        {loading ? (
          <Text style={styles.muted}>Carregando…</Text>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ruler size={28} color={colors.status.info} strokeWidth={1.5} /></View>
            <Text style={styles.emptyTitle}>Nenhuma medida ainda</Text>
            <Text style={styles.emptyMsg}>Toque em + para registrar sua primeira medida de {BIOMARKER_TYPE_LABELS[type].toLowerCase()}.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <MeasureCard key={item.id} item={item} onPress={setDetailItem} showLabel={false} />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={openCreate}
        accessibilityRole="button"
        accessibilityLabel="Registrar medida"
      >
        <Plus size={24} color={colors.text.inverse} strokeWidth={3} />
      </Pressable>

      <MeasureLogSheet
        key={editItem?.id || `create-${type}`}
        open={logOpen}
        editItem={editItem}
        defaultType={type}
        lockedType={editItem ? null : type}
        onClose={() => { setLogOpen(false); setEditItem(null) }}
        onSaved={handleSaved}
      />

      <MeasureDetailSheet
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.screen },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: colors.bg.card,
    borderBottomWidth: 1, borderBottomColor: colors.border.light,
  },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: colors.bg.card },
  chip: { paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: borderRadius.full, backgroundColor: colors.neutral[100], minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.status.info },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  chipTextActive: { color: colors.text.inverse },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: 96, gap: spacing[4] },
  error: { fontSize: 13, color: colors.status.error, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  muted: { fontSize: 13, color: colors.text.muted },
  list: { gap: spacing[2] },
  empty: { alignItems: 'center', paddingVertical: spacing[6], gap: spacing[2] },
  emptyIcon: { width: 56, height: 56, borderRadius: borderRadius.full, backgroundColor: colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  emptyMsg: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing[4] },
  fab: {
    position: 'absolute', right: spacing[5], bottom: spacing[6], width: 56, height: 56,
    borderRadius: 28, backgroundColor: colors.status.info, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
})
