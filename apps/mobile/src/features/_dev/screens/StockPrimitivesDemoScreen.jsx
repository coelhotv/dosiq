// StockPrimitivesDemoScreen — playground primitivos/telas Estoque (Sprint S3.1 Wave 3).
// DEV-only. Valida PurchaseCard isolado + navega pras telas Form/History antes do
// entrypoint real (StockScreen chega na Wave 4). Permite smoke PO sem fluxo completo.

import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { getTodayLocal, parseLocalDate, formatLocalDate } from '@dosiq/core'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '../../../navigation/routes'
import { colors, spacing, typography } from '@shared/styles/tokens'
import PurchaseCard from '../../stock/components/PurchaseCard'

// Medicamento real de produção — PurchaseHistory/Form carregam dados reais
// (user_id vem do useAuth no runtime). Trocar por outro id se necessário.
const FAKE_MED = { id: 'b9d23ad4-b72b-4f02-96de-6c25957c6e02', name: 'Medicamento (real)' }

// Datas relativas pra exercitar chips de validade (red <30d / yellow <90d / neutro)
const todayIso = getTodayLocal()
function addDaysIso(days) {
  const d = parseLocalDate(todayIso)
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

// 4 estados de PurchaseCard
const FAKE_PURCHASES = [
  {
    label: 'ÚLTIMA + validade próxima (<30d → vermelho)',
    remaining: 18,
    isLatest: true,
    purchase: {
      id: 'p1', medicine_id: FAKE_MED.id, quantity_bought: 30, unit_price: 1.5,
      purchase_date: addDaysIso(-5), expiration_date: addDaysIso(20),
      pharmacy: 'Drogasil', laboratory: 'AstraZeneca', notes: 'compra recente',
    },
  },
  {
    label: 'Em uso + validade média (<90d → amarelo)',
    remaining: 5,
    isLatest: false,
    purchase: {
      id: 'p2', medicine_id: FAKE_MED.id, quantity_bought: 30, unit_price: 1.42,
      purchase_date: addDaysIso(-40), expiration_date: addDaysIso(75),
      pharmacy: 'Pague Menos', laboratory: null, notes: null,
    },
  },
  {
    label: 'Consumida (0 restante) + validade longa (neutro)',
    remaining: 0,
    isLatest: false,
    purchase: {
      id: 'p3', medicine_id: FAKE_MED.id, quantity_bought: 30, unit_price: 1.38,
      purchase_date: addDaysIso(-120), expiration_date: addDaysIso(200),
      pharmacy: null, laboratory: 'EMS', notes: null,
    },
  },
  {
    label: 'Sem data de validade (cinza)',
    remaining: 12,
    isLatest: false,
    purchase: {
      id: 'p4', medicine_id: FAKE_MED.id, quantity_bought: 20, unit_price: 1.6,
      purchase_date: addDaysIso(-10), expiration_date: null,
      pharmacy: 'Farmácia São Paulo', laboratory: null, notes: 'sem lote informado',
    },
  },
]

export default function StockPrimitivesDemoScreen({ navigation }) {
  // Telas Stock vivem em StockStack → Tab Estoque
  const goStock = (screen, params) => {
    lightTap()
    navigation?.navigate(ROUTES.TABS, {
      screen: ROUTES.STOCK,
      params: { screen, params },
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Estoque (S3.1 W3)</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Telas Wave 3 ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telas Wave 3</Text>

          <TouchableOpacity
            style={styles.buttonCard}
            onPress={() =>
              goStock(ROUTES.PURCHASE_FORM, {
                mode: 'create',
                medicineId: FAKE_MED.id,
                medicineName: FAKE_MED.name,
              })
            }
          >
            <Text style={styles.buttonText}>➕ PurchaseFormScreen (CREATE) — med travado, data hoje</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonCard}
            onPress={() =>
              goStock(ROUTES.PURCHASE_FORM, {
                mode: 'edit',
                medicineId: FAKE_MED.id,
                medicineName: FAKE_MED.name,
                purchaseId: FAKE_PURCHASES[0].purchase.id,
                purchase: {
                  quantity: FAKE_PURCHASES[0].purchase.quantity_bought,
                  unit_price: FAKE_PURCHASES[0].purchase.unit_price,
                  purchase_date: FAKE_PURCHASES[0].purchase.purchase_date,
                  expiration_date: FAKE_PURCHASES[0].purchase.expiration_date,
                  pharmacy: FAKE_PURCHASES[0].purchase.pharmacy,
                  laboratory: FAKE_PURCHASES[0].purchase.laboratory,
                  notes: FAKE_PURCHASES[0].purchase.notes,
                },
              })
            }
          >
            <Text style={styles.buttonText}>✏️ PurchaseFormScreen (EDIT) — pré-preenchido</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonCard}
            onPress={() =>
              goStock(ROUTES.PURCHASE_HISTORY, {
                medicineId: FAKE_MED.id,
                medicineName: FAKE_MED.name,
              })
            }
          >
            <Text style={styles.buttonText}>📜 PurchaseHistoryScreen — carrega dados reais do med fake</Text>
          </TouchableOpacity>
          <Text style={styles.caption}>
            History busca via stockService.getPurchasesByMedicine — med fake não tem
            registros, então mostra empty state. Use um med real pra ver lista populada.
          </Text>
        </View>

        {/* ── PurchaseCard (primitivo isolado) ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PurchaseCard — 4 estados</Text>
          <Text style={styles.caption}>
            Barra de consumo + chip de validade dinâmico + custo unit/total (formatBRL).
          </Text>
          {FAKE_PURCHASES.map((item) => (
            <View key={item.purchase.id} style={styles.cardWrap}>
              <Text style={styles.subLabel}>{item.label}</Text>
              <PurchaseCard
                purchase={item.purchase}
                remaining={item.remaining}
                isLatest={item.isLatest}
                onPress={() =>
                  goStock(ROUTES.PURCHASE_FORM, {
                    mode: 'edit',
                    medicineId: FAKE_MED.id,
                    medicineName: FAKE_MED.name,
                    purchaseId: item.purchase.id,
                    purchase: {
                      quantity: item.purchase.quantity_bought,
                      unit_price: item.purchase.unit_price,
                      purchase_date: item.purchase.purchase_date,
                      expiration_date: item.purchase.expiration_date,
                      pharmacy: item.purchase.pharmacy,
                      laboratory: item.purchase.laboratory,
                      notes: item.purchase.notes,
                    },
                  })
                }
              />
            </View>
          ))}
        </View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen || colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  backBtn: {
    padding: spacing[1],
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    padding: spacing[4],
    gap: spacing[6],
  },
  section: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.neutral[50],
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing[2],
  },
  caption: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  cardWrap: {
    marginTop: spacing[2],
  },
  buttonCard: {
    backgroundColor: colors.bg.card,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
})
