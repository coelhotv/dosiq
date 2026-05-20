// DevHubScreen — hub DEV-only de validação. Links pras telas de smoke da fase atual.

import { ScrollView, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '../../../navigation/routes'
import { colors, spacing } from '@shared/styles/tokens'

export default function DevHubScreen({ navigation }) {
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
        <Text style={styles.title}>Dev</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fase 3 — Estoque S3.1</Text>
          <TouchableOpacity
            onPress={() => {
              lightTap()
              navigation?.navigate(ROUTES.STOCK_PRIMITIVES_DEMO)
            }}
            style={styles.buttonCard}
          >
            <Text style={styles.buttonText}>📦 PurchaseCard + PurchaseFormScreen + PurchaseHistoryScreen</Text>
          </TouchableOpacity>
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
})
