// MedicineDeleteBlockedSheet.jsx — bottom sheet exibido quando delete é bloqueado
// por dependências (tratamentos vinculados ou estoque positivo).
//
// Layout: mock-medicamentos-apagar-bloqueio.png
// - Ícone alerta + título + descrição
// - Lista "EM USO POR" com cards de cada tratamento + card de estoque
// - Footer: Voltar + Abrir tratamentos (CTA verde)

import { useMemo } from 'react'
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, Platform, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
import * as LucideIcons from 'lucide-react-native'
const { AlertCircle, Layers, Package, ChevronRight, Trash2, BarChart3 } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

export function MedicineDeleteBlockedSheet({
  visible,
  medicineName,
  protocols = [],
  titrationSteps = [],
  stockUnits = 0,
  stockLots = 0,
  stockTrackingEnabled = true,
  onCancel,
  onOpenProtocol,
  onOpenStock,
}) {
  const protocolItems = useMemo(
    () =>
      protocols.map((p, idx) => ({
        key: p?.id ?? `protocol-${idx}`,
        title: p?.active === false ? 'Tratamento pausado' : 'Tratamento ativo',
        name: p?.name ?? p?.short_name ?? `Tratamento #${idx + 1}`,
        subtitle: buildProtocolSubtitle(p),
      })),
    [protocols]
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      // Android: cobre window stack inteiro (parent inputs/tab bar vazam sem isso no API 24).
      statusBarTranslucent
    >
      {Platform.OS === 'android' ? (
        <View style={{ height: StatusBar.currentHeight ?? 0 }} />
      ) : null}
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerIcon}>
          <AlertCircle size={28} color={colors.status.warning} />
        </View>

        <Text style={styles.title}>
          Não é possível excluir{medicineName ? ` ${medicineName}` : ''}
        </Text>
        <Text style={styles.description}>
          Este medicamento está em uso. Desative ou exclua as dependências abaixo
          antes de continuar.
        </Text>

        <Text style={styles.sectionTitle}>EM USO POR</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {protocolItems.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.depCard, pressed && styles.depCardPressed]}
              onPress={() => onOpenProtocol?.(item.key)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${item.name}`}
            >
              <View style={[styles.depIconWrap, styles.depIconWrapPrimary]}>
                <Layers size={18} color={colors.primary[700]} />
              </View>
              <View style={styles.depBody}>
                <Text style={styles.depKicker}>{item.title}</Text>
                <Text style={styles.depName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.depSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={18} color={colors.text.muted} />
            </Pressable>
          ))}

          {/* Bloco de estoque some por completo quando o controle de estoque está
              desligado — o bloqueio por tratamento (protocolItems acima) continua. */}
          {stockTrackingEnabled && stockUnits > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.depCard, pressed && styles.depCardPressed]}
              onPress={onOpenStock}
              accessibilityRole="button"
              accessibilityLabel="Abrir estoque"
            >
              <View style={[styles.depIconWrap, styles.depIconWrapSupplement]}>
                <Package size={18} color={colors.supplement[700]} />
              </View>
              <View style={styles.depBody}>
                <Text style={styles.depKicker}>Estoque</Text>
                <Text style={styles.depName}>
                  {stockUnits} unidade{stockUnits === 1 ? '' : 's'}
                  {stockLots > 0 ? ` · ${stockLots} lote${stockLots === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.text.muted} />
            </Pressable>
          ) : null}

          {/* 029 F5 (T026 / §7.3): etapas da Evolução do tratamento. Sem este bloco, um
              medicamento usado SÓ por uma etapa futura (protocol_id NULL, sem estoque) parecia
              excluível e a exclusão morria no FK com erro cru. Não é clicável: a etapa se edita
              pela tela do tratamento, não daqui — um destino errado seria pior que nenhum. */}
          {titrationSteps.length > 0 ? (
            <View style={styles.depCard}>
              <View style={[styles.depIconWrap, styles.depIconWrapSupplement]}>
                <BarChart3 size={18} color={colors.supplement[700]} />
              </View>
              <View style={styles.depBody}>
                <Text style={styles.depKicker}>Evolução do tratamento</Text>
                <Text style={styles.depName}>
                  {titrationSteps.length === 1
                    ? '1 etapa usa este medicamento'
                    : `${titrationSteps.length} etapas usam este medicamento`}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Text style={styles.btnSecondaryText}>Voltar</Text>
          </Pressable>
          <Pressable
            disabled
            style={[styles.btnPrimary, styles.btnPrimaryDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Apagar medicamento (bloqueado)"
          >
            <Trash2 size={16} color={colors.text.inverse} />
            <Text style={styles.btnPrimaryText}>Apagar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

function buildProtocolSubtitle(p) {
  const parts = []
  if (p?.frequency) parts.push(humanFrequency(p.frequency))
  const times = Array.isArray(p?.time_schedule) ? p.time_schedule.length : 0
  if (times > 0) parts.push(`${times} horário${times === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function humanFrequency(freq) {
  switch (freq) {
    case 'diario':
      return 'Diário'
    case 'dias_alternados':
      return 'Dias alternados'
    case 'semanal':
      return 'Semanal'
    case 'personalizado':
      return 'Personalizado'
    case 'quando_necessario':
      return 'Quando necessário'
    default:
      return freq
  }
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  depCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  depCardPressed: {
    opacity: 0.7,
  },
  depIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depIconWrapPrimary: {
    backgroundColor: colors.primary[50],
  },
  depIconWrapSupplement: {
    backgroundColor: colors.supplement[50],
  },
  depBody: {
    flex: 1,
  },
  depKicker: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 2,
  },
  depName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  depSub: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  btnPrimary: {
    flex: 2,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  btnPrimaryDisabled: {
    opacity: 0.4,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  pressed: {
    opacity: 0.85,
  },
})
