// MedicineDemoScreen — playground para medicamentos (Sprint M1.1)
// DEV-only. Navegação para telas de cadastro e detalhes.

import { ScrollView, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '../../../navigation/routes'
import { colors, spacing } from '@shared/styles/tokens'

export default function MedicineDemoScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Medicamentos (M1.2)</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Seção Fase 2 — Primitivos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fase 2 — Primitivos T2.2</Text>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              navigation?.navigate(ROUTES.TREATMENT_PRIMITIVES_DEMO)
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>🧪 WeekdaySelector + MedicineSelectorRow + TimeSchedulePicker</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              // ProtocolForm vive em TreatmentsStack → Tab Tratamentos
              navigation?.navigate(ROUTES.TABS, {
                screen: ROUTES.TREATMENTS,
                params: { screen: ROUTES.PROTOCOL_FORM },
              })
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>📝 ProtocolFormScreen (CREATE) — composição completa T2.6</Text>
          </TouchableOpacity>
        </View>

        {/* Seção 1 — Telas Sprint M1.1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telas Sprint M1.1</Text>

          <TouchableOpacity
            onPress={() => {
              lightTap()
              // MedicinesList vive em TreatmentsStack → Tab Tratamentos → root Tabs
              navigation?.navigate(ROUTES.TABS, {
                screen: ROUTES.TREATMENTS,
                params: { screen: ROUTES.MEDICINES_LIST },
              })
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>📋 Listagem de Medicamentos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              lightTap()
              navigation?.navigate(ROUTES.TABS, {
                screen: ROUTES.TREATMENTS,
                params: { screen: ROUTES.MEDICINE_CREATE },
              })
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>➕ Novo Medicamento (Form)</Text>
          </TouchableOpacity>
        </View>

        {/* Seção 2 — Detalhe (requer ID) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhe (requer ID válido)</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Acesse via Listagem após cadastrar 1 medicamento. Detail screen recebe {'{'}id{'}'} em
              route.params.
            </Text>
          </View>
        </View>

        {/* Seção 3 — Status Sprint */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Sprint</Text>
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>✅ M1.1 Read (Service + List + Detail)</Text>
            <Text style={styles.statusText}>✅ M2.1 MedicineFormScreen (create/edit)</Text>
            <Text style={styles.statusText}>✅ M2.2 MedicineAnvisaSheet (bottom sheet)</Text>
            <Text style={styles.statusText}>✅ M2.4 useMedicineDelete (pre-check)</Text>
            <Text style={styles.statusText}>✅ M2.5 Delete via DeleteConfirmation</Text>
            <Text style={styles.statusText}>✅ M2.7 useMedicineMutation (C/U/D)</Text>
            <Text style={styles.statusText}>🔄 M1.3 Extract + Migrate (próxima sprint)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  buttonCard: {
    backgroundColor: colors.bg.card,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  infoBox: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  infoText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.bg.card,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statusText: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing[2],
    fontWeight: '500',
  },
})
